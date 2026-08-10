export default defineEventHandler(async (event) => {
  const slug = event.context.params!.slug as string
  const auth = getAuth(event)
  if (!auth) throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  const res = await tr4kDownload(slug, auth)
  setHeader(event, 'Content-Type', 'application/x-bittorrent')
  setHeader(event, 'Content-Disposition', res.headers.get('content-disposition') || `attachment; filename="${slug}.torrent"`)
  return new Uint8Array(await res.arrayBuffer())
})
