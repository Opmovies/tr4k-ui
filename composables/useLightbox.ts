// Agrandissement d'image plein écran, partagé par toute l'app.
const src = ref<string | null>(null)

export function useLightbox() {
  return {
    src,
    open: (url: string) => { src.value = url },
    close: () => { src.value = null },
  }
}
