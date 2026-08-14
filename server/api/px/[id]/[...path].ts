import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { tr4kGet, tr4kMutate, tr4kDownload, tr4kMultipart } from '../../../utils/tr4ker'

/**
 * Dispatcher des routes serveur de plugins : /api/px/<id>/<chemin> (toutes méthodes).
 * Le server.mjs d'un plugin exporte `routes` : { 'GET /status': (event, ctx) => ..., '* /x': ... }.
 * Il n'a pas de node_modules → tout ce dont il a besoin passe par `ctx`.
 */
export default defineEventHandler(async (event) => {
  const auth = getAuth(event)
  if (!auth) throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  const id = event.context.params!.id as string
  if (!isEnabled(id)) throw createError({ statusCode: 404, statusMessage: 'Plugin inconnu ou désactivé' })

  const modP = getServerModule(id)
  if (!modP) throw createError({ statusCode: 404, statusMessage: 'Ce plugin n’a pas de routes serveur' })
  let mod: any
  try { mod = await modP } catch (e: any) {
    throw createError({ statusCode: 500, statusMessage: `server.mjs du plugin ${id} : ${e?.message || e}` })
  }

  const path = '/' + ((event.context.params!.path as string) || '')
  const handler = mod.routes?.[`${event.method} ${path}`] || mod.routes?.[`* ${path}`]
  if (typeof handler !== 'function') throw createError({ statusCode: 404, statusMessage: `Route de plugin inconnue : ${event.method} ${path}` })

  const dataDir = join(PLUGIN_DATA_DIR, id)
  mkdirSync(dataDir, { recursive: true })
  const ctx = {
    auth,
    userKey: userKey(auth),
    settings: loadPluginSettings(id, auth),
    saveSettings: (v: Record<string, any>) => savePluginSettings(id, auth, v),
    query: getQuery(event),
    body: ['GET', 'HEAD'].includes(event.method) ? undefined : await readBody(event).catch(() => undefined),
    lib: { tr4kGet, tr4kMutate, tr4kDownload, tr4kMultipart, fetch: globalThis.fetch },
    h3: { createError, setHeader: (k: string, v: string) => setHeader(event, k, v) },
    dataDir,
    log: (...a: any[]) => console.log(`[plugin:${id}]`, ...a),
  }
  try {
    return await handler(event, ctx)
  } catch (e: any) {
    if (e?.statusCode) throw e // erreurs H3 des plugins relayées telles quelles
    throw createError({ statusCode: 500, statusMessage: `Plugin ${id} : ${e?.message || e}` })
  }
})
