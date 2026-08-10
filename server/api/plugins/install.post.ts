import { unzipSync } from 'fflate'
import { dirname } from 'node:path'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'

// Installation d'un plugin : zip glissé-déposé sur /plugins.
// Le manifest peut être à la racine du zip OU sous un unique dossier englobant (style WordPress).
const MAX_ZIP = 5 * 1024 * 1024
const MAX_TOTAL = 30 * 1024 * 1024
const MAX_ENTRIES = 300

export default defineEventHandler(async (event) => {
  requirePluginAdmin(event)
  const parts = await readMultipartFormData(event)
  const file = parts?.find((p) => p.name === 'file' && p.data?.length)
  if (!file) throw createError({ statusCode: 400, statusMessage: 'Aucun fichier reçu' })
  if (file.data.length > MAX_ZIP) throw createError({ statusCode: 413, statusMessage: 'Archive > 5 Mo' })

  let entries: Record<string, Uint8Array>
  try { entries = unzipSync(new Uint8Array(file.data)) } catch {
    throw createError({ statusCode: 400, statusMessage: 'Archive zip illisible' })
  }

  const names = Object.keys(entries).filter((n) => !n.endsWith('/'))
  if (!names.length) throw createError({ statusCode: 400, statusMessage: 'Archive vide' })
  if (names.length > MAX_ENTRIES) throw createError({ statusCode: 400, statusMessage: `Trop de fichiers (> ${MAX_ENTRIES})` })

  let prefix = ''
  if (!entries['plugin.json']) {
    const top = new Set(names.map((n) => n.split('/')[0]))
    const only = top.size === 1 ? [...top][0] : null
    if (only && entries[`${only}/plugin.json`]) prefix = only + '/'
    else throw createError({ statusCode: 400, statusMessage: 'plugin.json introuvable (racine du zip ou unique dossier englobant)' })
  }

  let manifest: any
  try { manifest = JSON.parse(new TextDecoder().decode(entries[prefix + 'plugin.json'])) } catch {
    throw createError({ statusCode: 400, statusMessage: 'plugin.json : JSON invalide' })
  }
  validateManifest(manifest)
  if (!entries[prefix + manifest.client]) throw createError({ statusCode: 400, statusMessage: `« ${manifest.client} » absent de l'archive` })
  if (manifest.server && !entries[prefix + manifest.server]) throw createError({ statusCode: 400, statusMessage: `« ${manifest.server} » absent de l'archive` })

  const dest = pluginDir(manifest.id)
  rmSync(dest, { recursive: true, force: true }) // mise à jour = remplacement complet
  try {
    let total = 0
    for (const [name, data] of Object.entries(entries)) {
      if (name.endsWith('/') || !name.startsWith(prefix)) continue
      const rel = name.slice(prefix.length)
      if (!rel) continue
      const abs = safePluginFile(manifest.id, rel) // anti-traversée (rejette .., chemins absolus, \)
      total += data.length
      if (total > MAX_TOTAL) throw createError({ statusCode: 413, statusMessage: 'Archive trop volumineuse une fois extraite (> 30 Mo)' })
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, data)
    }
  } catch (e) {
    rmSync(dest, { recursive: true, force: true }) // pas de dossier partiel après un échec
    throw e
  }

  writeState((s) => {
    s.plugins[manifest.id] = { enabled: true, version: manifest.version, installedAt: new Date().toISOString() }
  })
  return { ok: true, manifest }
})
