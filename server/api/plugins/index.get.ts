// Liste complète des plugins installés (pour la page /plugins).
export default defineEventHandler((event) => {
  const auth = getAuth(event)
  if (!auth) throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  const state = readState()
  return {
    rev: state.rev,
    plugins: listInstalled().map(({ manifest, enabled, installedAt }) => ({ ...manifest, enabled, installedAt })),
  }
})
