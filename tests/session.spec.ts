import { describe, it, expect } from 'vitest'
import { encryptSession, decryptSession, authHeaders } from '~/server/utils/session'

describe('encryptSession / decryptSession', () => {
  it('chiffre puis déchiffre à l’identique (AES-256-GCM)', () => {
    const payload = { jwt: 'abc.def.ghi', user: { id: 12, username: 'nra' } }
    const token = encryptSession(payload)
    expect(token).not.toContain('abc.def.ghi')
    expect(decryptSession(token)).toEqual(payload)
  })
  it('produit un token différent à chaque appel (IV aléatoire)', () => {
    expect(encryptSession({ a: 1 })).not.toBe(encryptSession({ a: 1 }))
  })
  it('refuse un token altéré ou invalide', () => {
    const token = encryptSession({ jwt: 'x' })
    const tampered = token.slice(0, -4) + (token.endsWith('AAAA') ? 'BBBB' : 'AAAA')
    expect(decryptSession(tampered)).toBeNull()
    expect(decryptSession('garbage')).toBeNull()
    expect(decryptSession('')).toBeNull()
  })
})

describe('authHeaders', () => {
  it('mode jwt → cookie TR4KER, mode apikey → X-Api-Key', () => {
    expect(authHeaders({ mode: 'jwt', token: 'tok', hash: 'h' })).toEqual({ Cookie: 'TR4KER_session=tok' })
    expect(authHeaders({ mode: 'apikey', token: 'key', hash: 'cfg' })).toEqual({ 'X-Api-Key': 'key' })
  })
})
