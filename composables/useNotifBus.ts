// Bus des événements `notification` reçus par le WebSocket du chat (une seule instance
// ChatView est connectée à la fois : elle pousse ici, la cloche consomme).
export type WsNotif = {
  id: number
  notif_type: string
  title: string
  body?: string
  link?: string
  at: string
}

const lastNotif = ref<WsNotif | null>(null)

export function useNotifBus() {
  function push(n: WsNotif) { lastNotif.value = n }
  return { lastNotif, push }
}

// en dev : simuler une notification depuis la console (__pushNotif({id:1, notif_type:'mention', ...}))
if (import.meta.dev && typeof window !== 'undefined') {
  ;(window as any).__pushNotif = (n: WsNotif) => { lastNotif.value = n }
}
