// Seule mutation POST autorisée : ouvrir/créer une conversation privée (MP).
// Renvoie {conv_id, username}. Rien ici ne peut dépenser de crédits.
const ALLOWED: RegExp[] = [/^dm\/[^/]+$/]

export default defineEventHandler(async (event) => {
  const path = (event.context.params?.path || '') as string
  if (!ALLOWED.some((re) => re.test(path))) {
    throw createError({ statusCode: 403, statusMessage: `Mutation non autorisée par le proxy : ${path}` })
  }
  const auth = getAuth(event)
  if (!auth) throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  return tr4kMutate('POST', path, auth)
})
