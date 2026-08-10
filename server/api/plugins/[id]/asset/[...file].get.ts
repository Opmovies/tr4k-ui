import { readFileSync } from 'node:fs'

// Sert les fichiers d'un plugin ACTIVÉ. Le Content-Type des .mjs doit être text/javascript,
// sinon le navigateur refuse le module (import() dynamique du loader).
const MIME: Record<string, string> = {
  mjs: 'text/javascript', js: 'text/javascript', css: 'text/css', json: 'application/json',
  svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', woff2: 'font/woff2',
}

export default defineEventHandler((event) => {
  if (!getAuth(event)) throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  const id = event.context.params!.id as string
  const rel = decodeURIComponent((event.context.params!.file as string) || '')
  if (!rel || !isEnabled(id)) throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  const abs = safePluginFile(id, rel)
  let buf: Buffer
  try { buf = readFileSync(abs) } catch { throw createError({ statusCode: 404, statusMessage: 'Introuvable' }) }
  setHeader(event, 'Content-Type', MIME[rel.split('.').pop()!.toLowerCase()] || 'application/octet-stream')
  setHeader(event, 'Cache-Control', 'no-cache') // le loader ajoute ?v=<rev> pour le busting
  return buf
})
