// État de la bulle de chat flottante, partagé entre app.vue et ChatView.
const dockOpen = ref(false)

// total de messages non lus (alimenté par l'instance ChatView active) → badge de la bulle
const unreadTotal = ref(0)

// position/taille du dock, persistées ; x/y < 0 = ancrage par défaut (bas-droite, tailles CSS)
const RECT_KEY = 'tr4kui.dockRect'
const rect = reactive({ x: -1, y: -1, w: 0, h: 0 })
let rectLoaded = false

export function useChatDock() {
  if (import.meta.client && !rectLoaded) {
    rectLoaded = true
    try { Object.assign(rect, JSON.parse(localStorage.getItem(RECT_KEY) || '{}')) } catch {}
    watch(rect, (r) => localStorage.setItem(RECT_KEY, JSON.stringify(r)), { deep: true })
    // en dev : forcer le badge de la bulle depuis la console (__setChatUnread(3))
    if (import.meta.dev) (window as any).__setChatUnread = (n: number) => { unreadTotal.value = n }
  }
  return {
    dockOpen,
    rect,
    unreadTotal,
    open: () => { dockOpen.value = true },
    close: () => { dockOpen.value = false },
    toggle: () => { dockOpen.value = !dockOpen.value },
    setUnread: (n: number) => { unreadTotal.value = n },
    resetRect: () => { rect.x = -1; rect.y = -1; rect.w = 0; rect.h = 0 },
  }
}
