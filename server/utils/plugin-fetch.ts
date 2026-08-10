import { latestRelease, pickPluginAsset, REPO_RE, type ReleaseInfo } from './updates'
import { installPluginZip, MAX_ZIP } from './plugin-install'
import type { PluginManifest } from './plugins'

/**
 * Télécharge la dernière release GitHub d'un plugin et l'installe.
 * Partagé par la mise à jour (/api/plugins/:id/update) et le marketplace
 * (/api/plugins/marketplace/install). N'accepte que des assets hébergés par GitHub.
 */
export async function installFromRelease(repo: string, id: string): Promise<{ manifest: PluginManifest; release: ReleaseInfo }> {
  if (!REPO_RE.test(repo)) throw createError({ statusCode: 400, statusMessage: 'Dépôt invalide' })
  const rel = await latestRelease(repo)
  if (!rel) throw createError({ statusCode: 404, statusMessage: `Aucune release GitHub trouvée pour ${repo}` })

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

  return { manifest: installPluginZip(buf, { expectId: id }), release: rel }
}
