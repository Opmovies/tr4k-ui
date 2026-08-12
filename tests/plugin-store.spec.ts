import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Répertoires isolés : à poser AVANT l'import (PLUGINS_DIR/PLUGIN_DATA_DIR sont
// résolus au chargement du module), d'où l'import dynamique ci-dessous.
const root = mkdtempSync(join(tmpdir(), 'tr4k-plugin-store-'))
process.env.NUXT_PLUGINS_DIR = join(root, 'plugins')
process.env.NUXT_PLUGIN_DATA_DIR = join(root, 'plugin-data')

const { savePluginSettings, loadPluginSettings } = await import('~/server/utils/plugin-store')
const AUTH = { mode: 'apikey', token: 'x', hash: 'cfg' } as const

function installManifest(id: string, extra: Record<string, any> = {}) {
  mkdirSync(join(root, 'plugins', id), { recursive: true })
  writeFileSync(
    join(root, 'plugins', id, 'plugin.json'),
    JSON.stringify({ id, name: id, version: '1.0.0', client: 'client.mjs', ...extra }),
  )
}

describe('savePluginSettings', () => {
  it('filtre sur les clés déclarées quand le manifest a des fields', () => {
    installManifest('with-fields', { settings: { fields: [{ key: 'host', label: 'Host', type: 'text' }] } })
    const saved = savePluginSettings('with-fields', AUTH, { host: 'seed.example', rogue: 'nope' })
    expect(saved).toEqual({ host: 'seed.example' })
    expect(loadPluginSettings('with-fields', AUTH)).toEqual({ host: 'seed.example' })
  })

  it('enregistre tel quel quand fields est vide (UI de réglages custom)', () => {
    installManifest('custom-ui', { settings: { fields: [] } })
    const values = { configs: [{ name: 'box1', url: 'https://qb1' }, { name: 'box2', url: 'https://qb2' }], active: 'box1' }
    expect(savePluginSettings('custom-ui', AUTH, values)).toEqual(values)
    expect(loadPluginSettings('custom-ui', AUTH)).toEqual(values)
  })

  it('enregistre tel quel quand le manifest ne déclare pas de settings du tout', () => {
    installManifest('no-settings')
    const values = { anything: true, nested: { a: 1 } }
    expect(savePluginSettings('no-settings', AUTH, values)).toEqual(values)
    expect(loadPluginSettings('no-settings', AUTH)).toEqual(values)
  })
})
