// Recherche de GIFs via la gateway Klipy communautaire de TR4KER (schéma Tenor v2).
// Hors quota API du tracker (worker Cloudflare séparé) ; cache 10 min par requête.
const GW = 'https://klipy-api-gateway.tr4ker-klipy-emoj-gateway-customer593.workers.dev'
const cache = new Map<string, { at: number; data: any }>()

export default defineEventHandler(async (event) => {
  const q = String(getQuery(event).q || '').trim().slice(0, 80)
  const key = q || '__trending__'
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.data

  const url = q ? `${GW}/search?q=${encodeURIComponent(q)}&limit=24` : `${GW}/trending?limit=24`
  const res = await fetch(url)
  if (!res.ok) throw createError({ statusCode: 502, statusMessage: `Gateway GIF ${res.status}` })
  const raw = await res.json()
  // on ne garde que le nécessaire (aperçu + URL à insérer)
  const data = {
    gifs: (raw.results || []).map((r: any) => ({
      id: r.id,
      title: r.title || r.content_description || '',
      preview: r.media_formats?.tinygif?.url || r.media_formats?.nanogif?.url,
      url: r.media_formats?.mediumgif?.url || r.media_formats?.gif?.url,
    })).filter((g: any) => g.preview && g.url),
  }
  cache.set(key, { at: Date.now(), data })
  if (cache.size > 100) for (const k of [...cache.keys()].slice(0, 20)) cache.delete(k)
  return data
})
