// Payload du loader client : uniquement les plugins ACTIVÉS.
export default defineEventHandler((event) => {
  const auth = getAuth(event)
  if (!auth) throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  const state = readState()
  return {
    rev: state.rev,
    plugins: listInstalled()
      .filter((p) => p.enabled)
      .map(({ manifest }) => ({ id: manifest.id, name: manifest.name, icon: manifest.icon, client: manifest.client, settings: manifest.settings })),
  }
})
