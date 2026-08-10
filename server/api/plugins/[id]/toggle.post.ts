// Active/désactive un plugin installé.
export default defineEventHandler((event) => {
  requirePluginAdmin(event)
  const id = event.context.params!.id as string
  if (!readManifest(id)) throw createError({ statusCode: 404, statusMessage: 'Plugin inconnu' })
  let enabled = false
  writeState((s) => {
    const cur = s.plugins[id] || { enabled: false, version: readManifest(id)!.version, installedAt: new Date().toISOString() }
    cur.enabled = !cur.enabled
    enabled = cur.enabled
    s.plugins[id] = cur
  })
  return { ok: true, id, enabled }
})
