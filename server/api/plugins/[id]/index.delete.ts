import { rmSync } from 'node:fs'
import { join } from 'node:path'

// Désinstalle un plugin (supprime son dossier). ?purge=1 efface aussi ses données/réglages.
export default defineEventHandler((event) => {
  requirePluginAdmin(event)
  const id = event.context.params!.id as string
  const dir = pluginDir(id) // valide l'id (anti-traversée)
  rmSync(dir, { recursive: true, force: true })
  if (getQuery(event).purge === '1') rmSync(join(PLUGIN_DATA_DIR, id), { recursive: true, force: true })
  writeState((s) => { delete s.plugins[id] })
  return { ok: true, id }
})
