import { describe, it, expect } from 'vitest'
import { workKey, workTitle, buildGroups } from '~/composables/useReleaseGroups'

describe('workKey', () => {
  it('privilégie les IDs externes (tmdb > imdb > tvdb)', () => {
    expect(workKey({ tmdb_id: 42, tmdb_type: 'movie', imdb_id: 'tt1' })).toBe('tm:movie:42')
    expect(workKey({ imdb_id: 'tt1', tvdb_id: 7 })).toBe('im:tt1')
    expect(workKey({ tvdb_id: 7 })).toBe('tv:7')
  })
  it('replie sur le titre nettoyé + année', () => {
    expect(workKey({ name: 'Dune.Part.Two.2024.2160p', year: 2024 })).toBe('wt:dune part two:2024')
  })
  it('isole les torrents sans rien de commun', () => {
    expect(workKey({ id: 9, name: 'X' })).toBe('one:9')
  })
})

describe('workTitle', () => {
  it('nettoie points/underscores et coupe à l’année ou au SxxEyy', () => {
    expect(workTitle({ name: 'The.Matrix.1999.1080p.x264' })).toBe('The Matrix')
    expect(workTitle({ name: 'Severance_S02E03_VOSTFR' })).toBe('Severance')
  })
  it('ne coupe pas si le motif est en tête', () => {
    expect(workTitle({ name: '1984 (1984)' })).toBe('1984 (1984)')
  })
})

describe('buildGroups', () => {
  const t = (over: any) => ({ id: 1, name: 'Film.2024', seeders: 0, size_bytes: 0, tags: [], created_at: '2026-01-01', ...over })

  it('désactivé : un groupe par torrent', () => {
    const g = buildGroups([t({ id: 1 }), t({ id: 2 })], false)
    expect(g).toHaveLength(2)
    expect(g.every((x) => x.count === 1)).toBe(true)
  })

  it('regroupe par œuvre et choisit le représentant le plus seedé', () => {
    const a = t({ id: 1, tmdb_id: 5, seeders: 3, size_bytes: 1024 ** 3, tags: ['1080p'], created_at: '2026-01-01' })
    const b = t({ id: 2, tmdb_id: 5, seeders: 9, size_bytes: 4 * 1024 ** 3, tags: ['2160p'], is_freeleech: true, created_at: '2026-02-01' })
    const c = t({ id: 3, tmdb_id: 6, seeders: 1 })
    const g = buildGroups([a, b, c])
    expect(g).toHaveLength(2)
    const grp = g.find((x) => x.count === 2)!
    expect(grp.rep.id).toBe(2)
    expect(grp.seedMax).toBe(9)
    expect(grp.hasFl).toBe(true)
    expect(grp.newest).toBe('2026-02-01')
    expect(grp.resolutions).toEqual(expect.arrayContaining(['1080p', '2160p']))
    expect(grp.sizeRange).toContain('–')
  })

  it('groupe singleton : pas de métadonnées agrégées', () => {
    const g = buildGroups([t({ id: 1, tmdb_id: 5 })])
    expect(g[0].count).toBe(1)
    expect(g[0].releases).toBeUndefined()
  })
})
