// Cache client par TTL pour les GET qui reviennent souvent (catégories, boutique, exclus…).
// Nuxt ne réutilise PAS les réponses de useFetch entre deux visites d'une page (SPA) :
// chaque retour sur une page relançait la requête et raffichait un skeleton. Ce module
// mémorise les réponses au niveau module → retour instantané tant que le TTL n'est pas écoulé.
// (Le proxy serveur a son propre cache anti-quota ; celui-ci ne sert qu'à l'UX.)

type CacheEntry = { at: number; data: any }
const store = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<any>>()

function keyOf(url: string, query?: Record<string, any>) {
  const qs = new URLSearchParams(Object.entries(query || {}).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)]))
  qs.sort()
  return `${url}?${qs}`
}

/** GET avec cache TTL + déduplication des appels simultanés. Jette en cas d'erreur sans cache. */
export async function cachedFetch<T = any>(url: string, opts: { ttl?: number; query?: Record<string, any>; force?: boolean } = {}): Promise<T> {
  const { ttl = 60_000, query, force = false } = opts
  const key = keyOf(url, query)
  const hit = store.get(key)
  if (!force && hit && Date.now() - hit.at < ttl) return hit.data
  let p = inflight.get(key)
  if (!p) {
    p = $fetch(url, { query }).finally(() => inflight.delete(key))
    inflight.set(key, p)
  }
  try {
    const data = await p
    store.set(key, { at: Date.now(), data })
    return data
  } catch (e) {
    if (hit) return hit.data // stale-while-error, comme le proxy
    throw e
  }
}

export type UseCachedFetchOptions = {
  ttl?: number
  /** Query statique ou réactive (ref/computed) : un changement relance la requête. */
  query?: Record<string, any> | Ref<Record<string, any>>
}

/**
 * Enrobage réactif de cachedFetch : { data, pending, error, refresh }.
 * `pending` ne passe à true que s'il n'y a RIEN à afficher (pas de skeleton sur du stale).
 */
export function useCachedFetch<T = any>(url: string, opts: UseCachedFetchOptions = {}) {
  const { ttl = 60_000 } = opts
  const queryRef = computed(() => unref(opts.query) || {})

  const data = ref<T | null>(null)
  const pending = ref(true)
  const error = ref<any>(null)

  async function refresh(force = false) {
    const key = keyOf(url, queryRef.value)
    const hit = store.get(key)
    if (hit) { data.value = hit.data; pending.value = false } // stale affiché pendant le rafraîchissement
    else pending.value = true
    if (!force && hit && Date.now() - hit.at < ttl) return
    try {
      data.value = await cachedFetch<T>(url, { ttl, query: queryRef.value, force })
      error.value = null
    } catch (e) { error.value = e } finally { pending.value = false }
  }

  if (import.meta.client) watch(queryRef, () => refresh(), { immediate: true, deep: true })
  return { data, pending, error, refresh: () => refresh(true) }
}
