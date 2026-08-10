export default defineEventHandler(async (event) => {
  // invalide la session côté tracker si possible, puis efface notre cookie
  const s = readSession(event)
  if (s?.jwt) {
    try {
      const base = useRuntimeConfig().tr4kerBase.replace(/\/$/, '')
      await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { Cookie: `TR4KER_session=${s.jwt}` } })
    } catch {}
  }
  clearSessionCookie(event)
  return { ok: true }
})
