import { PLUGIN_REGISTRY } from '../../utils/plugin-registry'
import { latestRelease, pickPluginAsset, cmpVersions } from '../../utils/updates'

// Marketplace : catalogue curé de plugins installables (cf. server/utils/plugin-registry.ts),
// enrichi de la dernière version publiée et de l'état d'installation local.
export default defineEventHandler(async (event) => {
  const auth = getAuth(event)
  if (!auth) throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })

  const installed = new Map(listInstalled().map(({ manifest }) => [manifest.id, manifest.version]))
  const items = []
  for (const e of PLUGIN_REGISTRY) {
    const rel = await latestRelease(e.repository)
    const asset = rel ? pickPluginAsset(rel.assets, e.id) : null
    const installedVersion = installed.get(e.id) || null
    items.push({
      id: e.id,
      name: e.name,
      description: e.description,
      author: e.author,
      icon: e.icon,
      repo: e.repository,
      homepage: e.homepage,
      latestVersion: rel?.version || null,
      installable: !!asset,
      installed: installed.has(e.id),
      installedVersion,
      updateAvailable: !!(asset && rel && installedVersion && cmpVersions(rel.version, installedVersion) > 0),
    })
  }
  return { items }
})
