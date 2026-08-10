import { PLUGIN_REGISTRY } from '../../../utils/plugin-registry'
import { installFromRelease } from '../../../utils/plugin-fetch'

// Installe un plugin du marketplace par id. Curé uniquement : l'id doit exister dans
// le registre (pas d'installation d'un dépôt arbitraire), et l'action est admin-gated.
export default defineEventHandler(async (event) => {
  requirePluginAdmin(event)
  const id = String((await readBody(event))?.id || '').trim()
  const entry = PLUGIN_REGISTRY.find((e) => e.id === id)
  if (!entry) throw createError({ statusCode: 404, statusMessage: 'Plugin absent du marketplace' })

  const { manifest, release } = await installFromRelease(entry.repository, entry.id)
  return { ok: true, manifest, version: release.version }
})
