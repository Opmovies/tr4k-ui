import { latestRelease, cmpVersions, REPO_RE } from '../../../utils/updates'
import { installFromRelease } from '../../../utils/plugin-fetch'

// Met à jour un plugin depuis la dernière release GitHub de SON dépôt déclaré
// (champ `repository` du manifest installé — jamais une URL fournie par le client).
export default defineEventHandler(async (event) => {
  requirePluginAdmin(event)
  const id = getRouterParam(event, 'id')!
  const m = readManifest(id)
  if (!m) throw createError({ statusCode: 404, statusMessage: 'Plugin inconnu' })
  const repo = m.repository
  if (!repo || !REPO_RE.test(repo))
    throw createError({ statusCode: 400, statusMessage: 'Ce plugin ne déclare pas de dépôt GitHub (champ repository du manifest)' })

  const rel = await latestRelease(repo, true) // clic explicite → toujours re-vérifier GitHub
  if (rel && cmpVersions(rel.version, m.version) <= 0) return { ok: true, upToDate: true, version: m.version }

  const { manifest } = await installFromRelease(repo, id)
  return { ok: true, manifest, from: m.version, to: manifest.version }
})
