// Toasts éphémères (nouveau MP, mention…), partagés par toute l'app.
export type Toast = {
  id: number
  title: string
  body?: string
  avatar?: string | null
  icon?: 'dm' | 'mention'
  onClick?: () => void
}

const toasts = ref<Toast[]>([])
let seq = 1

export function useToast() {
  function push(t: Omit<Toast, 'id'>) {
    const id = seq++
    toasts.value = [...toasts.value, { ...t, id }]
    setTimeout(() => dismiss(id), 6000)
    return id
  }
  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }
  return { toasts, push, dismiss }
}
