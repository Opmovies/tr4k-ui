import { describe, it, expect, vi, afterEach } from 'vitest'
import { fmtSize, fmtAge, fmtDuration, fmtInt, siteUrl, proxyImg, torrentStatus, resTag } from '~/composables/useFmt'

describe('fmtSize', () => {
  it('gère null/undefined', () => {
    expect(fmtSize(null)).toBe('—')
    expect(fmtSize(undefined)).toBe('—')
  })
  it('formate les octets avec la bonne unité', () => {
    expect(fmtSize(0)).toBe('0.00 o')
    expect(fmtSize(1023)).toBe('1023 o')
    expect(fmtSize(1024)).toBe('1.00 Ko')
    expect(fmtSize(1536)).toBe('1.50 Ko')
    expect(fmtSize(10 * 1024 ** 2)).toBe('10.0 Mo')
    expect(fmtSize(4.7 * 1024 ** 3)).toBe('4.70 Go')
    expect(fmtSize(250 * 1024 ** 3)).toBe('250 Go')
    expect(fmtSize(1024 ** 4)).toBe('1.00 To')
  })
  it('plafonne sur la dernière unité', () => {
    expect(fmtSize(1024 ** 6)).toMatch(/Po$/)
  })
})

describe('fmtAge', () => {
  afterEach(() => vi.useRealTimers())
  it('gère null', () => expect(fmtAge(null)).toBe('—'))
  it('formate les âges relatifs en français', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T12:00:00Z'))
    expect(fmtAge('2026-08-10T11:59:40Z')).toBe('à l’instant')
    expect(fmtAge('2026-08-10T11:45:00Z')).toBe('il y a 15 min')
    expect(fmtAge('2026-08-10T06:00:00Z')).toBe('il y a 6 h')
    expect(fmtAge('2026-08-05T12:00:00Z')).toBe('il y a 5 j')
    expect(fmtAge('2026-06-10T12:00:00Z')).toBe('il y a 2 mois')
    expect(fmtAge('2024-08-10T12:00:00Z')).toBe('il y a 2.0 ans')
  })
})

describe('fmtDuration', () => {
  it('gère 0/null', () => {
    expect(fmtDuration(0)).toBe('—')
    expect(fmtDuration(null)).toBe('—')
  })
  it('formate min / h / j', () => {
    expect(fmtDuration(59)).toBe('0 min')
    expect(fmtDuration(45 * 60)).toBe('45 min')
    expect(fmtDuration(3 * 3600 + 20 * 60)).toBe('3 h 20 min')
    expect(fmtDuration(2 * 86400 + 5 * 3600)).toBe('2 j 5 h')
  })
})

describe('fmtInt', () => {
  it('formate avec séparateurs fr-FR', () => {
    expect(fmtInt(null)).toBe('0')
    // séparateur de milliers = espace insécable (étroite selon ICU)
    expect(fmtInt(1234567).replace(/[\s  ]/g, ' ')).toBe('1 234 567')
  })
})

describe('siteUrl / proxyImg', () => {
  it('préfixe les chemins relatifs du site', () => {
    expect(siteUrl('/uploads/av.png')).toBe('https://tr4ker.net/uploads/av.png')
    expect(siteUrl('https://cdn.example.com/x.png')).toBe('https://cdn.example.com/x.png')
    expect(siteUrl(null)).toBe('')
  })
  it('proxifie uniquement les assets tr4ker.net', () => {
    expect(proxyImg('/uploads/av.png')).toBe('/api/img?u=' + encodeURIComponent('https://tr4ker.net/uploads/av.png'))
    expect(proxyImg('https://image.tmdb.org/t/p/w500/x.jpg')).toBe('https://image.tmdb.org/t/p/w500/x.jpg')
    expect(proxyImg(null)).toBe('')
  })
})

describe('torrentStatus', () => {
  it('mappe les statuts TR4KER', () => {
    expect(torrentStatus(0)).toEqual({ label: 'En attente de validation', kind: 'wait' })
    expect(torrentStatus(1)).toEqual({ label: 'En ligne', kind: 'ok' })
    expect(torrentStatus(2)).toEqual({ label: 'Supprimé', kind: 'bad' })
    expect(torrentStatus(4)).toEqual({ label: 'Rejeté', kind: 'bad' })
    expect(torrentStatus(99).kind).toBe('ok')
  })
})

describe('resTag', () => {
  it('extrait le tag de résolution', () => {
    expect(resTag(['x265', '1080p', 'MULTI'])).toBe('1080p')
    expect(resTag(['4K'])).toBe('4K')
    expect(resTag(['2160p', '1080p'])).toBe('2160p')
    expect(resTag(['MULTI'])).toBeNull()
    expect(resTag(null)).toBeNull()
  })
})
