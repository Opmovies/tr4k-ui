// Check de mises à jour partagé (app + plugins), mémoïsé au niveau module : la sidebar,
// la page Paramètres et la page Plugins consomment le MÊME état sans multiplier les appels.
const appUpdate = ref<any>(null) // release app si une MàJ est dispo, sinon null
const pluginUpdates = ref<any[]>([]) // plugins avec updateAvailable
const applyingApp = ref(false) // MàJ app en un clic en cours (conteneur en recréation)
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

  // Mise à jour de l'app en un clic (via watchtower). Le conteneur se recrée : on
  // déclenche, puis on sonde /api/updates jusqu'à ce qu'il revienne à jour, et on recharge.
  async function applyApp() {
    if (applyingApp.value) return
    applyingApp.value = true
    try { await $fetch('/api/update/apply', { method: 'POST', timeout: 8000 }) } catch { /* le conteneur peut couper la réponse */ }
    const deadline = Date.now() + 180_000
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 4000))
      try {
        const r = await $fetch<any>('/api/updates', { timeout: 4000 })
        if (r && r.updateAvailable === false) { window.location.reload(); return }
      } catch { /* conteneur en cours de recréation → on réessaie */ }
    }
    applyingApp.value = false // délai dépassé : on laisse l'utilisateur réessayer
  }

  const count = computed(() => (appUpdate.value ? 1 : 0) + pluginUpdates.value.length)
  return { appUpdate, pluginUpdates, applyingApp, count, ensure, refresh, applyApp }
}
