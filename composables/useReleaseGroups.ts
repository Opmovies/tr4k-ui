import { resTag, fmtSize } from '~/composables/useFmt'

// Préférence « regrouper par œuvre » partagée par toutes les pages (persistée).
const groupByWork = ref(true)
let prefLoaded = false
export function useGroupPref() {
  if (import.meta.client && !prefLoaded) {
    prefLoaded = true
    groupByWork.value = localStorage.getItem('tr4kui.group') !== '0'
    watch(groupByWork, (v) => localStorage.setItem('tr4kui.group', v ? '1' : '0'))
  }
  return groupByWork
}

// clé d'œuvre : un ID externe partagé = même film/série ; sinon repli sur le titre nettoyé ;
// en dernier recours, chaque torrent reste seul
export function workKey(t: any): string {
  if (t.tmdb_id) return `tm:${t.tmdb_type || ''}:${t.tmdb_id}`
  if (t.imdb_id) return `im:${t.imdb_id}`
  if (t.tvdb_id) return `tv:${t.tvdb_id}`
  const wt = workTitle(t)
  if (wt && wt.length > 2) return `wt:${wt.toLowerCase()}:${t.year || ''}`
  return `one:${t.id}`
}

export function workTitle(t: any): string {
  let n = (t.name || t.title || '').replace(/[._]/g, ' ')
  const m = n.match(/\b(?:19|20)\d{2}\b|\bS\d{1,2}(?:E\d{1,3})?\b/i)
  if (m && m.index > 2) n = n.slice(0, m.index)
  return n.replace(/\s+/g, ' ').trim() || t.name || t.title || ''
}

export type ReleaseGroup = {
  key: string
  count: number
  rep: any
  releases?: any[]
  title?: string
  year?: number
  poster?: string
  seedMax?: number
  resolutions?: string[]
  hasFl?: boolean
  newest?: string
  sizeRange?: string
}

/** Regroupe une liste de torrents par œuvre. `enabled=false` → un groupe par torrent. */
export function buildGroups(items: any[], enabled = true): ReleaseGroup[] {
  if (!enabled) return items.map((t) => ({ key: `one:${t.id}`, count: 1, rep: t }))
  const map = new Map<string, any[]>()
  for (const t of items) {
    const k = workKey(t)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(t)
  }
  return [...map.entries()].map(([key, releases]) => {
    if (releases.length === 1) return { key, count: 1, rep: releases[0] }
    const rep = releases.reduce((a, b) => ((b.seeders || 0) > (a.seeders || 0) ? b : a), releases[0])
    const sizes = releases.map((r) => r.size_bytes || 0)
    const resSet = [...new Set(releases.map((r) => resTag(r.tags)).filter(Boolean))] as string[]
    return {
      key, releases, count: releases.length, rep,
      title: workTitle(rep),
      year: rep.year,
      poster: rep.poster_url || rep.classic_cover_url,
      seedMax: Math.max(...releases.map((r) => r.seeders || 0)),
      resolutions: resSet.slice(0, 4),
      hasFl: releases.some((r) => r.is_freeleech),
      newest: releases.reduce((a, b) => (b.created_at > a ? b.created_at : a), releases[0].created_at),
      sizeRange: sizes.length && Math.min(...sizes) !== Math.max(...sizes)
        ? `${fmtSize(Math.min(...sizes))} – ${fmtSize(Math.max(...sizes))}`
        : fmtSize(sizes[0]),
    }
  })
}
