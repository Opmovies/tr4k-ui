import { join } from 'node:path'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { encryptSession, decryptSession, type Auth } from './session'
import { PLUGIN_DATA_DIR, readManifest } from './plugins'

/**
 * Réglages de plugin PAR UTILISATEUR, chiffrés au repos (AES-256-GCM, même clé que les
 * sessions). Clé de fichier = id utilisateur (stable), PAS auth.hash (le JWT change à
 * chaque login et ferait « disparaître » les réglages).
 */

/** Sentinelle renvoyée au client à la place d'un champ secret non vide (jamais la valeur). */
export const SECRET_SENTINEL = '••••'

export function userKey(auth: Auth): string {
  return auth.mode === 'apikey' ? 'cfg' : `u${auth.user?.id ?? 'anon'}`
}
const settingsPath = (id: string, auth: Auth) => join(PLUGIN_DATA_DIR, id, `${userKey(auth)}.settings.enc`)

export function pluginDefaults(id: string): Record<string, any> {
  const m = readManifest(id)
  return Object.fromEntries((m?.settings?.fields || []).map((f) => [f.key, f.default ?? (f.type === 'boolean' ? false : '')]))
}

export function loadPluginSettings(id: string, auth: Auth): Record<string, any> {
  const defaults = pluginDefaults(id)
  try {
    const stored = decryptSession<Record<string, any>>(readFileSync(settingsPath(id, auth), 'utf8'))
    return { ...defaults, ...(stored || {}) }
  } catch { return defaults }
}

export function savePluginSettings(id: string, auth: Auth, values: Record<string, any>): Record<string, any> {
  const m = readManifest(id)
  const allowed = new Set((m?.settings?.fields || []).map((f) => f.key))
  const clean = Object.fromEntries(Object.entries(values || {}).filter(([k]) => allowed.has(k)))
  mkdirSync(join(PLUGIN_DATA_DIR, id), { recursive: true })
  writeFileSync(settingsPath(id, auth), encryptSession(clean), { mode: 0o600 })
  return clean
}
