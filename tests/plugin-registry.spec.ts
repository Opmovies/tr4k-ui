import { describe, it, expect } from 'vitest'
import { PLUGIN_REGISTRY } from '~/server/utils/plugin-registry'
import { REPO_RE } from '~/server/utils/updates'

describe('PLUGIN_REGISTRY', () => {
  it('chaque entrée a les champs requis et un dépôt owner/repo valide', () => {
    for (const e of PLUGIN_REGISTRY) {
      expect(e.id, 'id').toMatch(/^[a-z0-9][a-z0-9-]{1,63}$/)
      expect(e.name, `name de ${e.id}`).toBeTruthy()
      expect(e.description, `description de ${e.id}`).toBeTruthy()
      expect(REPO_RE.test(e.repository), `repository de ${e.id}`).toBe(true)
    }
  })
  it('pas d’id en double', () => {
    const ids = PLUGIN_REGISTRY.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('référence le plugin seedbox-qbit', () => {
    expect(PLUGIN_REGISTRY.find((e) => e.id === 'seedbox-qbit')?.repository).toBe('n-ramos/tr4k-ui-seedbox-qbit')
  })
})
