import { describe, it, expect } from 'vitest'
import { cmpVersions, pickPluginAsset, REPO_RE } from '~/server/utils/updates'

describe('cmpVersions', () => {
  it('compare des versions x.y.z', () => {
    expect(cmpVersions('1.0.0', '1.0.0')).toBe(0)
    expect(cmpVersions('1.3.1', '1.3.0')).toBe(1)
    expect(cmpVersions('1.3.0', '1.3.1')).toBe(-1)
    expect(cmpVersions('2.0.0', '1.99.99')).toBe(1)
    expect(cmpVersions('1.10.0', '1.9.0')).toBe(1) // numérique, pas lexicographique
  })
  it('tolère le préfixe v et les longueurs différentes', () => {
    expect(cmpVersions('v1.3.1', '1.3.1')).toBe(0)
    expect(cmpVersions('1.3', '1.3.0')).toBe(0)
    expect(cmpVersions('1.3.0.1', '1.3.0')).toBe(1)
  })
  it('gère null/undefined/garbage sans jeter', () => {
    expect(cmpVersions(null, '1.0.0')).toBe(-1)
    expect(cmpVersions('1.0.0', undefined)).toBe(1)
    expect(cmpVersions('abc', 'abc')).toBe(0)
  })
})

describe('pickPluginAsset', () => {
  const A = (name: string) => ({ name, url: `https://github.com/x/y/releases/download/v1/${name}`, size: 1000 })
  it('préfère l’asset <id>-x.y.z.zip', () => {
    const assets = [A('autre.zip'), A('seedbox-qbit-1.3.1.zip'), A('notes.txt')]
    expect(pickPluginAsset(assets, 'seedbox-qbit')?.name).toBe('seedbox-qbit-1.3.1.zip')
  })
  it('replie sur le premier zip sinon', () => {
    expect(pickPluginAsset([A('notes.txt'), A('bundle.zip')], 'seedbox-qbit')?.name).toBe('bundle.zip')
  })
  it('null si aucun zip', () => {
    expect(pickPluginAsset([A('notes.txt')], 'x')).toBeNull()
    expect(pickPluginAsset([], 'x')).toBeNull()
  })
  it('insensible à la casse', () => {
    expect(pickPluginAsset([A('Seedbox-Qbit-1.3.1.ZIP')], 'seedbox-qbit')?.name).toBe('Seedbox-Qbit-1.3.1.ZIP')
  })
})

describe('REPO_RE', () => {
  it('accepte owner/repo et rejette le reste', () => {
    expect(REPO_RE.test('n-ramos/tr4k-ui')).toBe(true)
    expect(REPO_RE.test('a.b/c_d-e')).toBe(true)
    expect(REPO_RE.test('https://github.com/a/b')).toBe(false)
    expect(REPO_RE.test('a/b/c')).toBe(false)
    expect(REPO_RE.test('../../etc')).toBe(false)
  })
})
