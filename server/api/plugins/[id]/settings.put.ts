// Enregistre les réglages : une sentinelle '••••' reçue = « inchangé » (on garde la valeur stockée).
export default defineEventHandler(async (event) => {
  const auth = getAuth(event)
  if (!auth) throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  const id = event.context.params!.id as string
  const manifest = readManifest(id)
  if (!manifest) throw createError({ statusCode: 404, statusMessage: 'Plugin inconnu' })
  const incoming = (await readBody(event)) || {}
  const stored = loadPluginSettings(id, auth)
  const merged: Record<string, any> = { ...stored }
  for (const f of manifest.settings?.fields || []) {
    if (!(f.key in incoming)) continue
    const v = incoming[f.key]
    if (f.secret && v === SECRET_SENTINEL) continue // inchangé
    merged[f.key] = f.type === 'number' ? Number(v) || 0 : f.type === 'boolean' ? !!v : v
  }
  savePluginSettings(id, auth, merged)
  return { ok: true }
})
