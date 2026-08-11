/**
 * Marketplace de plugins : liste CURÉE de dépôts GitHub proposés à l'installation
 * depuis la page /plugins. Curée volontairement (pas d'URL arbitraire) car installer
 * un plugin = exécuter du code non sandboxé côté serveur ET client.
 *
 * Pour proposer un plugin : ajouter une entrée ici (dépôt public avec des releases
 * contenant l'archive `<id>-x.y.z.zip`, voir docs/PLUGINS.md).
 */
export type RegistryEntry = {
  id: string
  name: string
  description: string
  author?: string
  icon?: string // nom d'icône lucide ou emoji
  repository: string // "owner/repo" GitHub
  homepage?: string
}

export const PLUGIN_REGISTRY: RegistryEntry[] = [
  {
    id: 'seedbox-qbit',
    name: 'Seedbox qBittorrent',
    description: "Envoie les torrents vers un qBittorrent distant, affiche l'état de la seedbox et gère le cross-seed.",
    author: 'Opmovies',
    icon: 'HardDriveDownload',
    repository: 'Opmovies/tr4k-ui-seedbox-qbit',
    homepage: 'https://github.com/Opmovies/tr4k-ui-seedbox-qbit',
  },
]
