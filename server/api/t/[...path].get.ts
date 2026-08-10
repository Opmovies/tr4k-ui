// Proxy GET vers l'API TR4KER, limité à une liste blanche de routes en lecture.
const ALLOWED: RegExp[] = [
  /^torrents$/,
  /^torrents\/recent$/,
  /^exclu$/,
  /^torrents\/[a-z0-9-]+$/,
  /^torrents\/[a-z0-9-]+\/(related|comments|thanks)$/,
  /^me$/,
  /^me\/(stats|downloads|torrents|favorites|favorites\/ids|duplicates)$/,
  /^me\/(notifications|notifications\/unread|featured-badges|titles|sw-rewards)$/,
  /^public\/(categories|stats|config)$/,
  /^announcements$/,
  /^tmdb\/(credits|genres|search|suggest)$/,
  /^users\/[^/]+(\/uploads)?$/,
  /^users\/search$/, // autocomplétion des mentions
  /^shop(\/history)?$/, // lecture seule — l'achat (POST /shop/buy) n'est PAS proxifié
  /^badges$/,
  /^channels$/,
  /^conversations$/,
  /^conversations\/dms$/,
  /^conversations\/\d+\/messages$/,
]

export default defineEventHandler(async (event) => {
  const path = (event.context.params?.path || '') as string
  if (!ALLOWED.some((re) => re.test(path))) {
    throw createError({ statusCode: 403, statusMessage: `Route non autorisée par le proxy : ${path}` })
  }
  const auth = getAuth(event)
  if (!auth) throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  const { data, cache } = await tr4kGet(path, getQuery(event), auth)
  setHeader(event, 'X-Tr4k-Cache', cache)
  return data
})
