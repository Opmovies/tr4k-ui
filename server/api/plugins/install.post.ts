import { installPluginZip, MAX_ZIP } from '../../utils/plugin-install'

// Installation d'un plugin : zip glissé-déposé sur /plugins.
export default defineEventHandler(async (event) => {
  requirePluginAdmin(event)
  const parts = await readMultipartFormData(event)
  const file = parts?.find((p) => p.name === 'file' && p.data?.length)
  if (!file) throw createError({ statusCode: 400, statusMessage: 'Aucun fichier reçu' })
  if (file.data.length > MAX_ZIP) throw createError({ statusCode: 413, statusMessage: 'Archive > 5 Mo' })

  const manifest = installPluginZip(new Uint8Array(file.data))
  return { ok: true, manifest }
})
