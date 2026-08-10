// Check de mises à jour partagé (app + plugins), mémoïsé au niveau module : la sidebar,
// la page Paramètres et la page Plugins consomment le MÊME état sans multiplier les appels.
const appUpdate = ref<any>(null) // release app si une MàJ est dispo, sinon null
const pluginUpdates = ref<any[]>([]) // plugins avec updateAvailable
let started = false
let inflight: Promise<void> | null = null

async function load() {
  const [a, p] = await Promise.all([
    $fetch('/api/updates').catch(() => null),
    $fetch<{ updates: any[] }>('/api/plugins/updates').catch(() => ({ updates: [] })),
  ])
  appUpdate.value = a?.updateAvailable ? a : null
  pluginUpdates.value = (p?.updates || []).filter((u: any) => u.updateAvailable)
}

export function useUpdates() {
  // lance le check une seule fois par session (client only)
  function ensure() {
    if (!started && import.meta.client) { started = true; inflight = load() }
    return inflight
  }
  async function refresh() { inflight = load(); return inflight }
  const count = computed(() => (appUpdate.value ? 1 : 0) + pluginUpdates.value.length)
  return { appUpdate, pluginUpdates, count, ensure, refresh }
}
