// Réglages du plugin pour l'utilisateur courant. Les champs `secret` sont masqués :
// le client reçoit la sentinelle '••••' s'il existe une valeur, jamais la valeur elle-même.
export default defineEventHandler((event) => {
  const auth = getAuth(event)
  if (!auth) throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  const id = event.context.params!.id as string
  const manifest = readManifest(id)
  if (!manifest) throw createError({ statusCode: 404, statusMessage: 'Plugin inconnu' })
  const values = loadPluginSettings(id, auth)
  for (const f of manifest.settings?.fields || []) {
    if (f.secret && values[f.key]) values[f.key] = SECRET_SENTINEL
  }
  return { values }
})
