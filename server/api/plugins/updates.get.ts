import { latestRelease, cmpVersions, pickPluginAsset, REPO_RE } from '../../utils/updates'

// Mises à jour des plugins : pour chaque plugin installé déclarant `repository`,
// compare sa version à la dernière release GitHub du dépôt (cache 6 h côté serveur).
export default defineEventHandler(async (event) => {
  const auth = getAuth(event)
  if (!auth) throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  const force = !!getQuery(event).force // vérification manuelle : ignore le cache 6 h
  const updates: any[] = []
  for (const { manifest } of listInstalled()) {
    const repo = manifest.repository
    if (!repo || !REPO_RE.test(repo)) continue
    const rel = await latestRelease(repo, force)
    if (!rel) continue
    const asset = pickPluginAsset(rel.assets, manifest.id)
    updates.push({
      id: manifest.id,
      repo,
      current: manifest.version,
      latest: rel.version,
      url: rel.url,
      updateAvailable: !!asset && cmpVersions(rel.version, manifest.version) > 0,
    })
  }
  return { updates }
})
