import { latestRelease, cmpVersions, pickPluginAsset, REPO_RE } from '../../../utils/updates'
import { installPluginZip, MAX_ZIP } from '../../../utils/plugin-install'

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

  const rel = await latestRelease(repo)
  if (!rel) throw createError({ statusCode: 404, statusMessage: `Aucune release GitHub trouvée pour ${repo}` })
  if (cmpVersions(rel.version, m.version) <= 0) return { ok: true, upToDate: true, version: m.version }

  const asset = pickPluginAsset(rel.assets, id)
  if (!asset) throw createError({ statusCode: 404, statusMessage: `La release ${rel.tag} ne contient pas d'archive .zip` })
  if (asset.size > MAX_ZIP) throw createError({ statusCode: 413, statusMessage: 'Archive de release > 5 Mo' })
  if (!/^https:\/\/(github\.com|objects\.githubusercontent\.com)\//.test(asset.url))
    throw createError({ statusCode: 400, statusMessage: 'URL d’asset inattendue (hors GitHub)' })

  let res: Response
  try {
    res = await fetch(asset.url, { headers: { 'User-Agent': 'tr4k-ui-updater' }, signal: AbortSignal.timeout(30_000) })
  } catch (e: any) {
    throw createError({ statusCode: 502, statusMessage: `Téléchargement impossible : ${e?.name || e?.message}` })
  }
  if (!res.ok) throw createError({ statusCode: 502, statusMessage: `GitHub a répondu ${res.status} au téléchargement` })
  const buf = new Uint8Array(await res.arrayBuffer())
  if (buf.length > MAX_ZIP) throw createError({ statusCode: 413, statusMessage: 'Archive de release > 5 Mo' })

  const manifest = installPluginZip(buf, { expectId: id })
  return { ok: true, manifest, from: m.version, to: manifest.version }
})
