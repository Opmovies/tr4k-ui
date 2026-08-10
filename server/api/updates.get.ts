import { latestRelease, cmpVersions } from '../utils/updates'

// Mise à jour de l'app : compare la version locale à la dernière release GitHub.
export default defineEventHandler(async (event) => {
  const auth = getAuth(event)
  if (!auth) throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  const pub = useRuntimeConfig().public as any
  const current = String(pub.appVersion || '0.0.0')
  const repo = String(pub.appRepo || '')
  const rel = repo ? await latestRelease(repo) : null
  return {
    current,
    repo,
    latest: rel ? { version: rel.version, url: rel.url, publishedAt: rel.publishedAt } : null,
    updateAvailable: !!rel && cmpVersions(rel.version, current) > 0,
  }
})
