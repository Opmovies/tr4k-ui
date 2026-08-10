// Applique le thème sauvegardé le plus tôt possible (évite le flash de couleur).
export default defineNuxtPlugin(() => {
  const t = localStorage.getItem('tr4kui.theme') || 'dark'
  document.documentElement.dataset.theme = t
})
