export function fmtSize(bytes?: number | null): string {
  if (bytes === undefined || bytes === null) return '—'
  const units = ['o', 'Ko', 'Mo', 'Go', 'To', 'Po']
  let v = bytes, i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v >= 100 ? Math.round(v) : v.toFixed(v >= 10 ? 1 : 2)} ${units[i]}`
}

export function fmtAge(iso?: string | null): string {
  if (!iso) return '—'
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'à l’instant'
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`
  if (s < 86400 * 30) return `il y a ${Math.floor(s / 86400)} j`
  if (s < 86400 * 365) return `il y a ${Math.floor(s / 86400 / 30)} mois`
  return `il y a ${(s / 86400 / 365).toFixed(1)} ans`
}

export function fmtDuration(secs?: number | null): string {
  if (!secs) return '—'
  const d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600)
  if (d > 0) return `${d} j ${h} h`
  const m = Math.floor((secs % 3600) / 60)
  return h > 0 ? `${h} h ${m} min` : `${m} min`
}

export function fmtInt(n?: number | null): string {
  return (n ?? 0).toLocaleString('fr-FR')
}

/** Préfixe les URLs relatives du site (avatars /uploads/…, badges /badges/…). */
export function siteUrl(u?: string | null): string {
  if (!u) return ''
  return /^https?:/.test(u) ? u : `https://tr4ker.net${u}`
}

/** Version proxifiée pour les assets que Cloudflare bloque en hotlink (/uploads/…). */
export function proxyImg(u?: string | null): string {
  const full = siteUrl(u)
  if (!full) return ''
  return full.startsWith('https://tr4ker.net/') ? `/api/img?u=${encodeURIComponent(full)}` : full
}

/** Statut d'un torrent uploadé (valeurs mesurées sur TR4KER). */
export function torrentStatus(status?: number | null): { label: string; kind: 'ok' | 'wait' | 'bad' } {
  switch (status) {
    case 0: return { label: 'En attente de validation', kind: 'wait' }
    case 1: return { label: 'En ligne', kind: 'ok' }
    case 2: return { label: 'Supprimé', kind: 'bad' }
    case 3: return { label: 'En révision', kind: 'wait' }
    case 4: return { label: 'Rejeté', kind: 'bad' }
    default: return { label: 'En ligne', kind: 'ok' }
  }
}

/** Extrait le badge de résolution d'une liste de tags ("2160p", "1080p"…). */
export function resTag(tags?: string[] | null): string | null {
  if (!tags) return null
  return tags.find((t) => /^\d{3,4}p$|^4k$/i.test(t)) || null
}
