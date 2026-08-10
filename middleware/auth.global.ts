// Garde d'authentification : hors /login, si la session n'est pas valide → page de connexion.
// (Avec le repli clé-config, `authed` est vrai même sans login → l'instance perso n'est pas gênée.)
// La session vient de useSession (mémorisée) : plus d'appel réseau à chaque navigation.
export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login') return
  const s = await getSession()
  if (!s?.authed) return navigateTo('/login')
})
