/**
 * Vérification de mises à jour via les releases GitHub (app + plugins).
 * Aucune clé requise : l'API publique suffit (60 req/h/IP) grâce au cache 6 h
 * et au repli « stale » si GitHub est indisponible ou rate-limité.
 */

export const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/

/** Compare deux versions x.y.z (préfixe `v` toléré) : -1, 0 ou 1. */
export function cmpVersions(a?: string | null, b?: string | null): number {
  const norm = (v: string) => v.trim().replace(/^v/i, '').split('.').map((x) => parseInt(x, 10) || 0)
  const pa = norm(String(a || '0')), pb = norm(String(b || '0'))
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d) return d > 0 ? 1 : -1
  }
  return 0
}

export type ReleaseAsset = { name: string; url: string; size: number }
export type ReleaseInfo = {
  tag: string
  version: string
  url: string
  publishedAt: string
  assets: ReleaseAsset[]
}

const relCache = new Map<string, { at: number; data: ReleaseInfo | null }>()
const TTL = 6 * 3600_000

/** Dernière release d'un dépôt GitHub (`owner/repo`). null = pas de release / injoignable.
 *  `force` ignore le cache 6 h (vérification manuelle, installation, mise à jour) —
 *  le repli « stale » sur erreur GitHub reste actif. */
export async function latestRelease(repo: string, force = false): Promise<ReleaseInfo | null> {
  if (!REPO_RE.test(repo)) return null
  const hit = relCache.get(repo)
  if (!force && hit && Date.now() - hit.at < TTL) return hit.data
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'tr4k-ui-updater' },
      signal: AbortSignal.timeout(10_000),
    })
    if (res.status === 404) { relCache.set(repo, { at: Date.now(), data: null }); return null }
    if (!res.ok) throw new Error(`GitHub ${res.status}`)
    const j: any = await res.json()
    const data: ReleaseInfo = {
      tag: j.tag_name || '',
      version: String(j.tag_name || '').replace(/^v/i, ''),
      url: j.html_url || `https://github.com/${repo}/releases`,
      publishedAt: j.published_at || '',
      assets: (j.assets || []).map((a: any) => ({ name: String(a.name || ''), url: String(a.browser_download_url || ''), size: a.size || 0 })),
    }
    relCache.set(repo, { at: Date.now(), data })
    return data
  } catch {
    // rate-limit/panne GitHub → on ressert la dernière valeur connue, jamais d'erreur utilisateur
    return hit ? hit.data : null
  }
}

/** Choisit l'asset zip d'un plugin dans une release (préférence : `<id>-x.y.z.zip`). */
export function pickPluginAsset(assets: ReleaseAsset[], id: string): ReleaseAsset | null {
  const zips = assets.filter((a) => a.name.toLowerCase().endsWith('.zip'))
  return zips.find((a) => a.name.toLowerCase().startsWith(id.toLowerCase() + '-')) || zips[0] || null
}
