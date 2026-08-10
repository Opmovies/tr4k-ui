import { resolve, join, normalize, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync } from 'node:fs'
import type { H3Event } from 'h3'
import { getAuth } from './session'

/**
 * Système de plugins « façon WordPress » : un plugin = un dossier extrait dans .data/plugins/<id>
 * contenant un plugin.json (manifest), un client.mjs (chargé par le navigateur via import()
 * dynamique) et optionnellement un server.mjs (routes dispatchées par /api/px/<id>/...).
 * L'état activé/désactivé vit dans .data/plugins/state.json ; son compteur `rev` sert de
 * cache-buster (modules ESM Node + assets navigateur).
 */

export const PLUGINS_DIR = resolve(process.cwd(), process.env.NUXT_PLUGINS_DIR || '.data/plugins')
export const PLUGIN_DATA_DIR = resolve(process.cwd(), process.env.NUXT_PLUGIN_DATA_DIR || '.data/plugin-data')

export type PluginSettingsField = {
  key: string
  label: string
  type: 'text' | 'password' | 'number' | 'boolean' | 'select'
  default?: any
  required?: boolean
  secret?: boolean // jamais renvoyé en clair au client (sentinelle '••••')
  options?: { value: string; label: string }[]
  placeholder?: string
  help?: string
}
export type PluginManifest = {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  icon?: string // nom d'icône lucide (ex. "HardDriveDownload") ou emoji
  client: string // ex. "client.mjs"
  server?: string // ex. "server.mjs"
  settings?: { fields: PluginSettingsField[] }
  slots?: string[] // informatif
  permissions?: string[] // informatif
  repository?: string // "owner/repo" GitHub — active la mise à jour via les releases
}

type State = { rev: number; plugins: Record<string, { enabled: boolean; version: string; installedAt: string }> }

const statePath = () => join(PLUGINS_DIR, 'state.json')
export function readState(): State {
  try {
    const s = JSON.parse(readFileSync(statePath(), 'utf8'))
    return { rev: s.rev || 0, plugins: s.plugins || {} }
  } catch { return { rev: 0, plugins: {} } }
}
export function writeState(mut: (s: State) => void): State {
  const s = readState()
  mut(s)
  s.rev++
  mkdirSync(PLUGINS_DIR, { recursive: true })
  writeFileSync(statePath(), JSON.stringify(s, null, 2))
  serverModCache.clear()
  return s
}

const ID_RE = /^[a-z0-9][a-z0-9-]{1,63}$/
const ENTRY_RE = /^[\w][\w.-]*\.(mjs|js)$/

export function validateManifest(m: any): asserts m is PluginManifest {
  if (!m || typeof m !== 'object') throw createError({ statusCode: 400, statusMessage: 'plugin.json invalide' })
  if (typeof m.id !== 'string' || !ID_RE.test(m.id)) throw createError({ statusCode: 400, statusMessage: `plugin.json : id invalide (attendu ^[a-z0-9][a-z0-9-]{1,63}$)` })
  if (!m.name || !m.version || !m.client) throw createError({ statusCode: 400, statusMessage: 'plugin.json : name, version et client sont requis' })
  for (const f of [m.client, m.server].filter(Boolean))
    if (!ENTRY_RE.test(f)) throw createError({ statusCode: 400, statusMessage: `plugin.json : entrée invalide « ${f} » (fichier .mjs/.js à la racine du plugin)` })
  if (m.settings && !Array.isArray(m.settings.fields)) throw createError({ statusCode: 400, statusMessage: 'plugin.json : settings.fields doit être un tableau' })
  if (m.repository !== undefined && (typeof m.repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(m.repository)))
    throw createError({ statusCode: 400, statusMessage: 'plugin.json : repository doit être au format « owner/repo » (GitHub)' })
}

export function pluginDir(id: string): string {
  if (!ID_RE.test(id)) throw createError({ statusCode: 400, statusMessage: 'Id de plugin invalide' })
  return join(PLUGINS_DIR, id)
}

export function readManifest(id: string): PluginManifest | null {
  try {
    const m = JSON.parse(readFileSync(join(pluginDir(id), 'plugin.json'), 'utf8'))
    validateManifest(m)
    if (m.id !== id) return null // le manifest doit correspondre à son dossier
    return m
  } catch { return null }
}

/** Tous les plugins présents sur disque (installés), avec leur état. */
export function listInstalled(): Array<{ manifest: PluginManifest; enabled: boolean; installedAt?: string }> {
  const state = readState()
  let ids: string[] = []
  try { ids = readdirSync(PLUGINS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) } catch {}
  const out: Array<{ manifest: PluginManifest; enabled: boolean; installedAt?: string }> = []
  for (const id of ids) {
    const manifest = readManifest(id)
    if (manifest) out.push({ manifest, enabled: !!state.plugins[id]?.enabled, installedAt: state.plugins[id]?.installedAt })
  }
  return out.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name))
}

export function isEnabled(id: string): boolean {
  return ID_RE.test(id) && !!readState().plugins[id]?.enabled && !!readManifest(id)
}

/** Résout un fichier DANS le dossier d'un plugin — refuse toute traversée. */
export function safePluginFile(id: string, rel: string): string {
  const base = pluginDir(id)
  if (/^([a-zA-Z]:)?[\\/]/.test(rel) || rel.split('/').includes('..') || rel.includes('\\'))
    throw createError({ statusCode: 400, statusMessage: `Chemin refusé : ${rel}` })
  const p = normalize(join(base, rel))
  if (p !== base && !p.startsWith(base + sep))
    throw createError({ statusCode: 400, statusMessage: `Chemin refusé : ${rel}` })
  return p
}

// ---- modules serveur des plugins : import dynamique avec cache busté sur rev ----
// Node ne ré-importe jamais une URL déjà vue → suffixe ?v=rev-mtime unique par version.
// Fuite mémoire assumée : chaque bust laisse l'ancien module dans le cache ESM (échelle perso).
const serverModCache = new Map<string, Promise<any>>()
export function getServerModule(id: string): Promise<any> | null {
  const m = readManifest(id)
  if (!m?.server) return null
  const file = safePluginFile(id, m.server)
  if (!existsSync(file)) return null
  const rev = readState().rev
  const key = `${id}@${rev}`
  let p = serverModCache.get(key)
  if (!p) {
    const url = pathToFileURL(file).href + `?v=${rev}-${Math.trunc(statSync(file).mtimeMs)}`
    p = import(/* @vite-ignore */ url)
    serverModCache.set(key, p)
  }
  return p
}

/**
 * Garde d'administration : le server.mjs d'un plugin s'exécute SANS sandbox dans Nitro.
 * Par défaut (instance perso) tout utilisateur connecté peut gérer les plugins ; pour une
 * instance partagée, restreindre avec NUXT_PLUGIN_ADMINS=pseudo1,pseudo2.
 */
export function requirePluginAdmin(event: H3Event) {
  const auth = getAuth(event)
  if (!auth) throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  const admins = (process.env.NUXT_PLUGIN_ADMINS || '').split(',').map((s) => s.trim()).filter(Boolean)
  if (admins.length && auth.mode === 'jwt' && !admins.includes(auth.user?.username || ''))
    throw createError({ statusCode: 403, statusMessage: 'Gestion des plugins réservée aux administrateurs de cette instance' })
  return auth
}
