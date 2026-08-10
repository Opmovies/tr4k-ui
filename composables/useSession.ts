// Session d'authentification partagée par toute l'app.
// Avant : /api/auth/session était appelé par le middleware À CHAQUE navigation, puis par
// app.vue, puis par le loader de plugins → 3 appels au boot + 1 par changement de page.
// Ici : un seul appel, mémorisé (TTL court), partagé par les trois consommateurs.

export type Session = { authed: boolean; mode?: 'jwt' | 'apikey'; user?: { id: number; username: string } }

const TTL = 60_000
const session = ref<Session | null>(null)
let fetchedAt = 0
let inflight: Promise<Session | null> | null = null

/** Session courante (mémorisée). `force` ignore le TTL (après login/logout). */
export async function getSession(force = false): Promise<Session | null> {
  if (!force && session.value && Date.now() - fetchedAt < TTL) return session.value
  if (!inflight) {
    inflight = $fetch<Session>('/api/auth/session')
      .then((s) => { session.value = s; fetchedAt = Date.now(); return s })
      .catch(() => (session.value = null))
      .finally(() => { inflight = null })
  }
  return inflight
}

export function invalidateSession() { fetchedAt = 0; session.value = null }

/** Ref réactive (peuplée par getSession) pour les templates. */
export function useSession() {
  return { session, getSession, invalidateSession }
}
