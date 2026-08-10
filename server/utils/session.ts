import { createCipheriv, createDecipheriv, randomBytes, createHash, scryptSync } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { H3Event } from 'h3'

/**
 * Session chiffrée côté serveur, sans base de données.
 * Le token TR4KER de l'utilisateur (JWT de session) est chiffré (AES-256-GCM) et déposé
 * dans un cookie HttpOnly. Seul ce serveur peut le déchiffrer ; rien n'est stocké au repos.
 */

const COOKIE = 'tr4kui_sess'

function deriveKey(): Buffer {
  const envSecret = process.env.NUXT_SESSION_SECRET
  if (envSecret) return scryptSync(envSecret, 'tr4kui.session', 32)
  // instance perso / dev : secret aléatoire persisté localement (stable entre redémarrages)
  const p = resolve(process.cwd(), '.session-secret')
  let raw = ''
  try { raw = readFileSync(p, 'utf8').trim() } catch {}
  if (!raw) { raw = randomBytes(32).toString('hex'); try { writeFileSync(p, raw, { mode: 0o600 }) } catch {} }
  return scryptSync(raw, 'tr4kui.session', 32)
}
const KEY = deriveKey()

export function encryptSession(obj: unknown): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', KEY, iv)
  const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()])
  return Buffer.concat([iv, c.getAuthTag(), data]).toString('base64url')
}
export function decryptSession<T = any>(token: string): T | null {
  try {
    const buf = Buffer.from(token, 'base64url')
    const d = createDecipheriv('aes-256-gcm', KEY, buf.subarray(0, 12))
    d.setAuthTag(buf.subarray(12, 28))
    return JSON.parse(Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8'))
  } catch { return null }
}

export type SessionPayload = { jwt: string; user?: { id: number; username: string } }

export function setSession(event: H3Event, payload: SessionPayload) {
  setCookie(event, COOKIE, encryptSession(payload), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: 30 * 24 * 3600,
  })
}
// nommé clearSessionCookie (pas clearSession) pour ne pas entrer en collision avec le
// clearSession exporté par h3 ≥ 1.14 (auto-importé par Nitro) — évite un warning au build.
export function clearSessionCookie(event: H3Event) { deleteCookie(event, COOKIE, { path: '/' }) }
export function readSession(event: H3Event): SessionPayload | null {
  const v = getCookie(event, COOKIE)
  return v ? decryptSession<SessionPayload>(v) : null
}

// ---- clé API du config (repli mono-compte / dev) ----
let cfgKey: string | null | undefined
function configKey(): string | null {
  if (cfgKey !== undefined) return cfgKey
  if (process.env.NUXT_TR4KER_API_KEY) return (cfgKey = process.env.NUXT_TR4KER_API_KEY)
  for (const p of ['../tr4ker.config.json', '../../tr4ker.config.json', '../../../tr4ker.config.json']) {
    try {
      const j = JSON.parse(readFileSync(resolve(process.cwd(), p), 'utf8'))
      if (j.apikey) return (cfgKey = j.apikey)
    } catch {}
  }
  return (cfgKey = null)
}
// Login OBLIGATOIRE par défaut : la clé du config n'est utilisée QUE si explicitement autorisée
// (NUXT_ALLOW_CONFIG_KEY=1, pour un usage mono-compte volontaire). Sinon, aucun repli.
const allowConfigKey = () => process.env.NUXT_ALLOW_CONFIG_KEY === '1'

export type Auth = { mode: 'jwt' | 'apikey'; token: string; hash: string; user?: { id: number; username: string } }

function hashToken(t: string): string { return createHash('sha256').update(t).digest('hex').slice(0, 16) }

/** Authentification de la requête courante : session utilisateur, sinon repli config (si autorisé). */
export function getAuth(event: H3Event): Auth | null {
  const s = readSession(event)
  if (s?.jwt) return { mode: 'jwt', token: s.jwt, hash: hashToken(s.jwt), user: s.user }
  if (allowConfigKey()) {
    const k = configKey()
    if (k) return { mode: 'apikey', token: k, hash: 'cfg' }
  }
  return null
}

/** Auth depuis des en-têtes bruts (pour le WebSocket, hors H3Event). */
export function authFromCookieHeader(cookieHeader?: string): Auth | null {
  const m = (cookieHeader || '').match(new RegExp('(?:^|; )' + COOKIE + '=([^;]+)'))
  if (m) {
    const s = decryptSession<SessionPayload>(decodeURIComponent(m[1]))
    if (s?.jwt) return { mode: 'jwt', token: s.jwt, hash: hashToken(s.jwt), user: s.user }
  }
  if (allowConfigKey()) {
    const k = configKey()
    if (k) return { mode: 'apikey', token: k, hash: 'cfg' }
  }
  return null
}

/** En-têtes d'authentification à envoyer à TR4KER selon le mode. */
export function authHeaders(auth: Auth): Record<string, string> {
  return auth.mode === 'jwt'
    ? { Cookie: `TR4KER_session=${auth.token}` }
    : { 'X-Api-Key': auth.token }
}
