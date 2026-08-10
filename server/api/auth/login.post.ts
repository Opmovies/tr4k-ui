import { randomBytes } from 'node:crypto'

/**
 * Connexion au compte TR4KER de l'utilisateur, via l'endpoint officiel du tracker.
 * On récupère le JWT de session (Set-Cookie TR4KER_session), on le chiffre dans notre
 * propre cookie de session. Le mot de passe ne transite QUE vers TR4KER, n'est jamais stocké.
 * Gère le 2FA : si TOTP requis, on renvoie {totp_required, totp_token} et le client rappelle
 * ce endpoint avec {totp_token, code}.
 */
function extractJwt(res: Response): string | null {
  const cookies = (res.headers as any).getSetCookie?.() || []
  for (const c of cookies) {
    const m = /TR4KER_session=([^;]+)/.exec(c)
    if (m) return m[1]
  }
  return null
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const base = useRuntimeConfig().tr4kerBase.replace(/\/$/, '')

  let res: Response
  if (body?.totp_token && body?.code) {
    res = await fetch(`${base}/api/auth/totp-verify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ totp_token: body.totp_token, code: String(body.code) }),
    })
  } else {
    if (!body?.identifier || !body?.password) throw createError({ statusCode: 400, statusMessage: 'Identifiant et mot de passe requis' })
    res = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: body.identifier, password: body.password, fingerprint: randomBytes(16).toString('hex') }),
    })
  }

  const json: any = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw createError({ statusCode: res.status === 401 ? 401 : res.status, statusMessage: json.error || (res.status === 401 ? 'Identifiant ou mot de passe incorrect' : `Erreur ${res.status}`) })
  }
  // 2FA : première étape → on demande le code au client
  if (json.totp_required && !body?.code) {
    return { totp_required: true, totp_token: json.totp_token }
  }

  const jwt = extractJwt(res)
  if (!jwt) throw createError({ statusCode: 502, statusMessage: 'Connexion acceptée mais session introuvable' })

  // récupère l'identité pour l'afficher
  let user: { id: number; username: string } | undefined
  try {
    const me: any = await fetch(`${base}/api/me`, { headers: { Cookie: `TR4KER_session=${jwt}` } }).then((r) => r.json())
    if (me?.id) user = { id: me.id, username: me.username }
  } catch {}

  setSession(event, { jwt, user })
  return { ok: true, user }
})
