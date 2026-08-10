// Proxy d'images statiques du site (avatars /uploads/, badges /badges/) :
// Cloudflare bloque le hotlink de /uploads/ depuis un autre origin (vérifié :
// Image() → error dans le navigateur, curl → 200). Ces fichiers ne passent pas
// par le quota API → pas de cadencement, mais cache mémoire + cache navigateur long.
const ALLOWED_HOSTS = new Set(['tr4ker.net', 'www.tr4ker.net'])
const cache = new Map<string, { at: number; type: string; body: Uint8Array }>()
const MAX = 400

export default defineEventHandler(async (event) => {
  const u = String(getQuery(event).u || '')
  let url: URL
  try { url = new URL(u) } catch { throw createError({ statusCode: 400, statusMessage: 'URL invalide' }) }
  if (!ALLOWED_HOSTS.has(url.hostname) || !/^\/(uploads|badges)\//.test(url.pathname)) {
    throw createError({ statusCode: 403, statusMessage: 'Hôte ou chemin non autorisé' })
  }
  const key = url.href
  let hit = cache.get(key)
  if (!hit || Date.now() - hit.at > 24 * 3600_000) {
    const res = await fetch(key)
    if (!res.ok) throw createError({ statusCode: res.status })
    hit = { at: Date.now(), type: res.headers.get('content-type') || 'image/jpeg', body: new Uint8Array(await res.arrayBuffer()) }
    cache.set(key, hit)
    if (cache.size > MAX) {
      for (const k of [...cache.keys()].slice(0, 50)) cache.delete(k)
    }
  }
  setHeader(event, 'Content-Type', hit.type)
  setHeader(event, 'Cache-Control', 'public, max-age=86400, immutable')
  return hit.body
})
