/**
 * Lien .torrent unifié : toutes les vues (recherche, Découvrir, fiche, Mes uploads, profil)
 * passent par ces helpers pour que les plugins puissent réécrire l'URL de téléchargement
 * (filtre `torrent.download.url` — ex. envoyer vers une seedbox) et réagir au clic
 * (action `torrent.download.clicked`).
 */
export function torrentDlUrl(t: any) {
  return usePluginHost().filters.applyFilters('torrent.download.url', `/api/download/${t?.slug}`, t)
}

export function torrentDlClick(t: any) {
  usePluginHost().hooks.doAction('torrent.download.clicked', t)
}
