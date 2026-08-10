import { authFromCookieHeader, authHeaders } from '../utils/session'

/**
 * Relay WebSocket : navigateur ⇆ ce serveur ⇆ wss://tr4ker.net/api/ws
 * L'upstream s'authentifie avec la session de l'utilisateur (cookie chiffré), sinon la clé
 * du config (repli mono-compte). Le ping/pong du tracker est géré ICI (jamais relayé).
 * Seuls quelques types de messages sortants sont autorisés.
 */

const OUT_ALLOWED = new Set(['msg.send', 'read', 'pong', 'typing', 'typing.start', 'typing.stop', 'reaction.add', 'reaction.remove'])

type Upstream = { ws: WebSocket; queue: string[] }
const links = new Map<string, Upstream>()

export default defineWebSocketHandler({
  open(peer) {
    const cookie = (peer.request?.headers as any)?.get?.('cookie') || (peer.request?.headers as any)?.cookie
    const auth = authFromCookieHeader(cookie)
    if (!auth) { peer.send(JSON.stringify({ type: 'relay.error', reason: 'unauthenticated' })); try { peer.close() } catch {}; return }
    const up = new WebSocket('wss://tr4ker.net/api/ws', { headers: authHeaders(auth) } as any)
    const link: Upstream = { ws: up, queue: [] }
    links.set(peer.id, link)

    up.onopen = () => {
      for (const m of link.queue.splice(0)) up.send(m)
    }
    up.onmessage = (e: MessageEvent) => {
      const data = String(e.data)
      try {
        const msg = JSON.parse(data)
        if (msg.type === 'ping') { up.send(JSON.stringify({ type: 'pong' })); return }
      } catch {}
      peer.send(data)
    }
    up.onclose = (e: CloseEvent) => {
      peer.send(JSON.stringify({ type: 'relay.closed', code: e.code }))
      try { peer.close() } catch {}
    }
    up.onerror = () => {
      peer.send(JSON.stringify({ type: 'relay.error' }))
    }
  },

  message(peer, message) {
    const link = links.get(peer.id)
    if (!link) return
    const text = message.text()
    try {
      const msg = JSON.parse(text)
      if (!OUT_ALLOWED.has(msg.type)) return
    } catch { return }
    if (link.ws.readyState === 1) link.ws.send(text)
    else link.queue.push(text)
  },

  close(peer) {
    const link = links.get(peer.id)
    links.delete(peer.id)
    try { link?.ws.close() } catch {}
  },
})
