// État partagé du tiroir de navigation mobile (sidebar off-canvas).
// Sur desktop la sidebar est toujours visible ; sur mobile elle s'ouvre par-dessus
// le contenu via le hamburger de la topbar, et se referme au clic sur un lien / le fond.
const mobileOpen = ref(false)

export function useSidebar() {
  return {
    mobileOpen,
    open: () => { mobileOpen.value = true },
    close: () => { mobileOpen.value = false },
    toggle: () => { mobileOpen.value = !mobileOpen.value },
  }
}
