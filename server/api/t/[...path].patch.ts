// Seules mutations autorisées : marquer les notifications comme lues.
// Rien ici ne peut dépenser de crédits ni modifier le compte.
const ALLOWED: RegExp[] = [
  /^me\/notifications\/\d+\/read$/,
  /^me\/notifications\/read$/,
]

export default defineEventHandler(async (event) => {
  const path = (event.context.params?.path || '') as string
  if (!ALLOWED.some((re) => re.test(path))) {
    throw createError({ statusCode: 403, statusMessage: `Mutation non autorisée par le proxy : ${path}` })
  }
  const auth = getAuth(event)
  if (!auth) throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  return tr4kMutate('PATCH', path, auth)
})
