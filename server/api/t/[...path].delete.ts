// Seule suppression autorisée : un message de chat (les siens ; le tracker vérifie l'auteur).
// Rien d'autre — impossible de supprimer un torrent, un compte, etc.
const ALLOWED: RegExp[] = [/^messages\/\d+$/]

export default defineEventHandler(async (event) => {
  const path = (event.context.params?.path || '') as string
  if (!ALLOWED.some((re) => re.test(path))) {
    throw createError({ statusCode: 403, statusMessage: `Suppression non autorisée par le proxy : ${path}` })
  }
  const auth = getAuth(event)
  if (!auth) throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  return tr4kMutate('DELETE', path, auth)
})
