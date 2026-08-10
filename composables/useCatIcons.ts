import { Film, Tv, Music, BookOpen, AppWindow, Gamepad2, Joystick, Printer, GraduationCap, Puzzle, Package } from 'lucide-vue-next'

// Icône lucide par catégorie parente TR4KER — partagée par la liste, les cartes et Découvrir.
export const CAT_ICONS: Record<string, any> = {
  films: Film,
  series: Tv,
  audio: Music,
  livres: BookOpen,
  applications: AppWindow,
  'jeux-video': Gamepad2,
  emulation: Joystick,
  'impression-3d': Printer,
  formations: GraduationCap,
  nulled: Puzzle,
  autres: Package,
}

/** Accepte un slug (`'films'`) ou un torrent (lit parent_cat_slug/cat_slug/category_slug). */
export function catIcon(x: any) {
  const slug = typeof x === 'string' ? x : x?.parent_cat_slug || x?.cat_slug || x?.category_slug
  return CAT_ICONS[slug] || Package
}
