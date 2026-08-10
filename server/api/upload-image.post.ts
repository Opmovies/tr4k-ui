import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Upload d'une image collée/déposée dans le chat → imgbb → URL i.ibb.co
 * (ibb.co est dans la liste des domaines d'images autorisés du chat TR4KER).
 * Clé : NUXT_IMGBB_KEY ou champ `imgbb_key` de tr4ker.config.json.
 * Corps : octets bruts de l'image, type dans Content-Type.
 */
function imgbbKey(): string | null {
  if (process.env.NUXT_IMGBB_KEY) return process.env.NUXT_IMGBB_KEY
  for (const p of ['../tr4ker.config.json', '../../tr4ker.config.json']) {
    try {
      const j = JSON.parse(readFileSync(resolve(process.cwd(), p), 'utf8'))
      if (j.imgbb_key) return j.imgbb_key
    } catch {}
  }
  return null
}

export default defineEventHandler(async (event) => {
  const key = imgbbKey()
  if (!key) {
    throw createError({
      statusCode: 501,
      statusMessage: 'Clé imgbb manquante : crée une clé gratuite sur api.imgbb.com et ajoute "imgbb_key" dans tr4ker.config.json (ou NUXT_IMGBB_KEY)',
    })
  }
  const body = await readRawBody(event, false)
  if (!body || !body.length) throw createError({ statusCode: 400, statusMessage: 'Image vide' })
  if (body.length > 20 * 1024 * 1024) throw createError({ statusCode: 413, statusMessage: 'Image trop lourde (max 20 Mo)' })

  const form = new FormData()
  form.set('image', Buffer.from(body).toString('base64'))
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(key)}`, { method: 'POST', body: form })
  const j: any = await res.json().catch(() => null)
  if (!res.ok || !j?.data?.url) {
    throw createError({ statusCode: 502, statusMessage: `imgbb: ${j?.error?.message || res.status}` })
  }
  return { url: j.data.url, delete_url: j.data.delete_url }
})
