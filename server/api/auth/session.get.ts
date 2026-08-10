// État de session pour le client : est-on authentifié, via quel mode, et qui.
export default defineEventHandler((event) => {
  const auth = getAuth(event)
  if (!auth) return { authed: false }
  return { authed: true, mode: auth.mode, user: auth.user || null }
})
