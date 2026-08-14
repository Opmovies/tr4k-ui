import type { Auth } from './session'
import { authHeaders } from './session'

/**
 * Client TR4KER multi-utilisateur.
 * Contraintes mesurées (cf. TR4KER_API.md) : quota Cloudflare à fenêtre glissante longue →
 * cache agressif + budget local + recul sur 429 (ne jamais insister).
 * Chaque utilisateur a SON cadencement/budget/blocage (quota tracker propre à chacun).
 * Le cache est global pour le catalogue public, mais cloisonné par utilisateur pour les
 * données personnelles (me/*, conversations, shop/history) → aucune fuite entre comptes.
 */

// ---- cadencement + budget PAR utilisateur ----
const MIN_INTERVAL_MS = 700
const BUDGET_WINDOW_MS = 60_000
const BUDGET_MAX = 20

type Rate = { sent: number[]; lastAt: number; chain: Promise<void>; blockedUntil: number }
const rates = new Map<string, Rate>()
function rateFor(hash: string): Rate {
  let r = rates.get(hash)
  if (!r) { r = { sent: [], lastAt: 0, chain: Promise.resolve(), blockedUntil: 0 }; rates.set(hash, r) }
  return r
}
function budgetLeft(r: Rate): number {
  const cutoff = Date.now() - BUDGET_WINDOW_MS
  while (r.sent.length && r.sent[0] < cutoff) r.sent.shift()
  return BUDGET_MAX - r.sent.length
}
function pace(r: Rate): Promise<void> {
  const p = r.chain.then(async () => {
    const wait = r.lastAt + MIN_INTERVAL_MS - Date.now()
    if (wait > 0) await new Promise((res) => setTimeout(res, wait))
    r.lastAt = Date.now()
  })
  r.chain = p.catch(() => {})
  return p
}

// ---- cache TTL + stale-while-error ----
type Entry = { at: number; ttl: number; data: any }
const cache = new Map<string, Entry>()
const inflight = new Map<string, Promise<any>>()
const CACHE_MAX = 800

// endpoints à données personnelles → cache cloisonné par utilisateur
function userScoped(path: string): boolean {
  return /^me(\/|$)/.test(path) || /^conversations(\/|$)/.test(path) || path === 'shop/history'
}

function ttlFor(path: string): number {
  const m = (re: RegExp) => re.test(path)
  if (m(/^users\/search/)) return 60_000
  if (m(/^conversations/)) return 20_000
  if (m(/^public\/categories/)) return 24 * 3600_000
  if (m(/^public\//) || m(/^announcements/)) return 15 * 60_000
  if (m(/^tmdb\//)) return 24 * 3600_000
  if (m(/^torrents\/recent/)) return 60_000
  if (m(/^exclu/)) return 5 * 60_000
  if (m(/^torrents\/[^/]+\/(related)/)) return 30 * 60_000
  if (m(/^torrents\/[^/]+\/(comments|thanks)/)) return 5 * 60_000
  if (m(/^torrents\/[^/]+$/)) return 15 * 60_000
  if (m(/^torrents$/)) return 90_000
  if (m(/^me\/notifications/)) return 5_000
  if (m(/^me\/stats/)) return 5 * 60_000
  if (m(/^me\/downloads/)) return 3 * 60_000
  if (m(/^me/)) return 10 * 60_000
  if (m(/^users\//)) return 10 * 60_000
  return 2 * 60_000
}

function base(): string { return useRuntimeConfig().tr4kerBase.replace(/\/$/, '') }

export type Tr4kResult = { data: any; cache: 'hit' | 'miss' | 'stale' }

/** GET JSON sur l'API TR4KER, avec cache (cloisonné si perso), cadencement, budget et repli « stale ». */
export async function tr4kGet(path: string, query: Record<string, any>, auth: Auth): Promise<Tr4kResult> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue
    qs.set(k, String(v))
  }
  const scope = userScoped(path) ? auth.hash : 'pub'
  const key = `${scope}|${path}?${qs.toString()}`
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && now - hit.at < hit.ttl) return { data: hit.data, cache: 'hit' }
  if (inflight.has(key)) return { data: await inflight.get(key)!, cache: 'miss' }

  const rate = rateFor(auth.hash)
  const doFetch = async (): Promise<any> => {
    if (Date.now() < rate.blockedUntil) throw createError({ statusCode: 429, statusMessage: `Tracker throttlé, réessaie dans ${Math.ceil((rate.blockedUntil - Date.now()) / 1000)} s` })
    if (budgetLeft(rate) <= 0) throw createError({ statusCode: 429, statusMessage: 'Budget local atteint (20 req/min) — le cache prend le relais' })
    await pace(rate)
    rate.sent.push(Date.now())
    const q = qs.toString()
    const url = `${base()}/api/${path}${q ? '?' + q : ''}`
    const res = await fetch(url, { headers: { ...authHeaders(auth), Accept: 'application/json' } })
    if (res.status === 429) { rate.blockedUntil = Date.now() + 90_000; throw createError({ statusCode: 429, statusMessage: 'HTTP 429 du tracker — pause de 90 s' }) }
    if (res.status === 401) throw createError({ statusCode: 401, statusMessage: 'Session TR4KER expirée — reconnecte-toi' })
    if (!res.ok) { const b = await res.text().catch(() => ''); throw createError({ statusCode: res.status, statusMessage: `TR4KER ${res.status}: ${b.slice(0, 200) || res.statusText}` }) }
    const data = res.status === 204 ? null : await res.json()
    cache.set(key, { at: Date.now(), ttl: ttlFor(path), data })
    if (cache.size > CACHE_MAX) for (const [k] of [...cache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 80)) cache.delete(k)
    return data
  }

  const p = doFetch().finally(() => inflight.delete(key))
  inflight.set(key, p)
  try { return { data: await p, cache: 'miss' } } catch (e) {
    if (hit) return { data: hit.data, cache: 'stale' }
    throw e
  }
}

/** Mutation cadencée (PATCH/POST/DELETE) — jamais mise en cache. */
export async function tr4kMutate(method: string, path: string, auth: Auth, body?: any): Promise<any> {
  const rate = rateFor(auth.hash)
  if (Date.now() < rate.blockedUntil) throw createError({ statusCode: 429, statusMessage: 'Tracker throttlé, réessaie dans un instant' })
  await pace(rate)
  rate.sent.push(Date.now())
  const res = await fetch(`${base()}/api/${path}`, {
    method,
    headers: { ...authHeaders(auth), Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 429) { rate.blockedUntil = Date.now() + 90_000; throw createError({ statusCode: 429, statusMessage: 'HTTP 429 du tracker' }) }
  if (res.status === 401) throw createError({ statusCode: 401, statusMessage: 'Session TR4KER expirée' })
  if (!res.ok) { const t = await res.text().catch(() => ''); throw createError({ statusCode: res.status, statusMessage: `TR4KER ${res.status}: ${t.slice(0, 150)}` }) }
  return res.status === 204 ? { ok: true } : res.json()
}

/** POST multipart vers le tracker (upload de torrent…) — cadencé, jamais mis en cache.
 *  `file.data` accepte Uint8Array/ArrayBuffer ; timeout long (l'upload d'un .torrent
 *  passe par la modération anti-doublon côté site). */
export async function tr4kMultipart(
  path: string,
  opts: { fields: Record<string, string>; file?: { field: string; name: string; data: Uint8Array | ArrayBuffer; type?: string } },
  auth: Auth,
): Promise<any> {
  const rate = rateFor(auth.hash)
  if (Date.now() < rate.blockedUntil) throw createError({ statusCode: 429, statusMessage: 'Tracker throttlé, réessaie dans un instant' })
  await pace(rate)
  rate.sent.push(Date.now())
  const fd = new FormData()
  for (const [k, v] of Object.entries(opts.fields)) fd.append(k, v)
  if (opts.file) {
    const data = opts.file.data instanceof Uint8Array ? opts.file.data : new Uint8Array(opts.file.data)
    fd.append(opts.file.field, new Blob([data], { type: opts.file.type || 'application/x-bittorrent' }), opts.file.name)
  }
  const res = await fetch(`${base()}/api/${path}`, {
    method: 'POST',
    headers: { ...authHeaders(auth), Accept: 'application/json' },
    body: fd,
    signal: AbortSignal.timeout(120_000),
  })
  if (res.status === 429) { rate.blockedUntil = Date.now() + 90_000; throw createError({ statusCode: 429, statusMessage: 'HTTP 429 du tracker' }) }
  if (res.status === 401) throw createError({ statusCode: 401, statusMessage: 'Session TR4KER expirée' })
  if (!res.ok) { const t = await res.text().catch(() => ''); throw createError({ statusCode: res.status, statusMessage: `TR4KER ${res.status}: ${t.slice(0, 300)}` }) }
  return res.status === 204 ? { ok: true } : res.json()
}

/** Téléchargement binaire (.torrent) — cadencé, jamais mis en cache. */
export async function tr4kDownload(slug: string, auth: Auth): Promise<Response> {
  const rate = rateFor(auth.hash)
  if (Date.now() < rate.blockedUntil) throw createError({ statusCode: 429, statusMessage: 'Tracker throttlé, réessaie dans un instant' })
  await pace(rate)
  rate.sent.push(Date.now())
  const res = await fetch(`${base()}/api/torrents/${encodeURIComponent(slug)}/download`, { headers: authHeaders(auth) })
  if (res.status === 429) { rate.blockedUntil = Date.now() + 90_000; throw createError({ statusCode: 429, statusMessage: 'HTTP 429 du tracker' }) }
  if (!res.ok) throw createError({ statusCode: res.status, statusMessage: `TR4KER ${res.status}` })
  return res
}
