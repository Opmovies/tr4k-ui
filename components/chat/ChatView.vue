<template>
  <div class="chat-shell" :class="{ floating, 'mobile-conv': !!current }">
    <ChatConversationList
      :pane="pane" :channels="channels" :dms="dms" :mods="mods" :current="current" :unread="unread"
      @update:pane="pane = $event" @open="openConversation" @start-dm="startDm"
    />

    <div class="chat-main">
      <div class="chat-head" v-if="current">
        <div style="display:flex; align-items:center; gap:10px">
          <button class="ghost chat-back" title="Retour aux canaux" @click="current = null"><ChevronLeft :size="16" /></button>
          <MessagesSquare v-if="current.type === 'dm'" :size="15" style="color:var(--fl)" />
          <b>{{ current.name }}</b>
          <span v-if="readOnly" class="badge">lecture seule ({{ (current.write_roles || []).join(', ') }})</span>
          <span style="flex:1" />
          <button
            class="ghost scroll-toggle" :class="{ on: chatSettings.autoScroll }"
            :title="chatSettings.autoScroll ? 'Défilement auto activé : suit chaque nouveau message' : 'Défilement auto désactivé : ne défile que si tu es déjà en bas'"
            @click="chatSettings.autoScroll = !chatSettings.autoScroll"
          ><ArrowDownToLine :size="13" /></button>
          <span class="ws-state" :class="wsState === 'ok' ? 'ok' : 'ko'">{{ wsState === 'ok' ? '● temps réel' : '○ hors ligne' }}</span>
        </div>
        <div class="cdesc" v-if="current.description">{{ current.description }}</div>
      </div>

      <div class="chat-msgs" ref="msgBox" @click="onMsgClick">
        <div v-if="loading" class="empty"><span class="spin" /> Chargement…</div>
        <template v-else>
          <div v-if="hasMore" style="text-align:center">
            <button class="ghost" style="font-size:11px" @click="loadOlder">Charger les messages précédents</button>
          </div>
          <ChatMessage
            v-for="m in messages" :key="m.id"
            :m="m" :mine="isMine(m)" :read-only="readOnly"
            @mention="mentionUser" @reply="replyTo = $event" @remove="deleteMessage"
            @react="openReactPicker" @toggle-reaction="toggleReaction"
          />
        </template>
      </div>

      <div v-if="reactPicker.open" class="react-pop" :style="{ top: reactPicker.y + 'px', left: reactPicker.x + 'px' }" @click.stop>
        <button v-for="e in QUICK_REACTIONS" :key="e" @click="addReaction(e)">{{ e }}</button>
      </div>

      <div class="chat-typing">{{ typingLabel }}</div>

      <ChatComposer
        v-if="current && !readOnly" ref="composer"
        :current="current" :ws-state="wsState" :reply-to="replyTo"
        @send="send" @cancel-reply="replyTo = null" @typing="onTyping"
      />
    </div>
  </div>
</template>

<script setup>
import { MessagesSquare, ArrowDownToLine, ChevronLeft } from 'lucide-vue-next'
import { playChatSound } from '~/composables/useChatSound'

/**
 * Orchestrateur du chat : connexion WebSocket (via le relay /ws), état des conversations,
 * messages, non-lus, sons et toasts. La présentation est découpée en ChatConversationList
 * (colonne de gauche), ChatMessage (un message) et ChatComposer (zone de saisie).
 */
const props = defineProps({
  active: { type: Boolean, default: true },  // connexion WebSocket active
  visible: { type: Boolean, default: true }, // le chat est affiché (pour savoir si on regarde une conv)
  primary: { type: Boolean, default: true }, // gère les deep-links (?conv/?dm) — instance de la page
  floating: { type: Boolean, default: false },
})

const me = inject('me', ref(null))
const { chat: chatSettings } = useSettings()
const pluginHost = usePluginHost()
const notifBus = useNotifBus()
const toast = useToast()
const lightbox = useLightbox()
const dock = useChatDock()
const route = useRoute()

// cache partagé : l'instance flottante (dock) et la page /chat n'appellent qu'une fois
const { data: chanData } = useCachedFetch('/api/t/channels', { ttl: 5 * 60_000 })
const channels = computed(() => chanData.value?.channels || [])

const pane = ref('channels')
const current = ref(null)
const messages = ref([])
const loading = ref(false)
const hasMore = ref(false)
const replyTo = ref(null)
const unread = reactive({})
const typing = reactive({})
const msgBox = ref(null)
const composer = ref(null)
const wsState = ref('ko')

// clic sur une image d'un message → agrandissement plein écran
function onMsgClick(e) {
  const t = e.target
  if (t.tagName === 'IMG' && t.closest('.mtext')) { e.preventDefault(); lightbox.open(t.currentSrc || t.src) }
}

// ---- MP ----
const dms = ref([])
async function loadDms() {
  try {
    const r = await $fetch('/api/t/conversations/dms', { query: { limit: 30 } })
    dms.value = (r.dms || []).map((d) => ({ ...d, type: 'dm' }))
  } catch { dms.value = [] }
}
async function startDm(username) {
  try {
    const r = await $fetch(`/api/t/dm/${encodeURIComponent(username)}`, { method: 'POST' })
    await loadDms()
    const conv = dms.value.find((d) => d.id === r.conv_id) || { id: r.conv_id, name: r.username || username, type: 'dm' }
    pane.value = 'dms'
    openConversation(conv)
  } catch (e) {
    toast.push({ title: 'MP impossible', body: e?.data?.statusMessage || 'Utilisateur introuvable' })
  }
}

// ---- Modération / révision ----
const mods = ref([])
async function loadMods() {
  try {
    const r = await $fetch('/api/t/conversations')
    mods.value = (r.conversations || []).filter((c) => c.type === 'moderation')
  } catch { mods.value = [] }
}

const readOnly = computed(() => {
  const wr = current.value?.write_roles
  if (!wr || !wr.length) return false
  return !wr.includes(me.value?.role)
})

function isMine(m) { return m.sender_id === me.value?.id || (m.id < 0) }

// ---- WebSocket (gate sur props.active) ----
let ws = null, retry = 1000, alive = false
function connect() {
  if (!alive) return
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  ws = new WebSocket(`${proto}//${location.host}/ws`)
  ws.onopen = () => { wsState.value = 'ok'; retry = 1000 }
  ws.onclose = () => { wsState.value = 'ko'; ws = null; if (alive) setTimeout(connect, retry = Math.min(retry * 2, 30000)) }
  ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data) } catch { return } handle(m) }
}
function stopWs() { alive = false; try { ws?.close() } catch {} ws = null; wsState.value = 'ko' }
function wsSend(obj) { if (ws?.readyState === 1) ws.send(JSON.stringify(obj)) }
watch(() => props.active, (a) => { if (a) { if (!alive) { alive = true; connect() } } else stopWs() }, { immediate: true })

function bodyPreview(b) { return (b || '').replace(/\[img\][^[]*\[\/img\]/gi, '🖼 image').replace(/\s+/g, ' ').trim().slice(0, 120) }

// ---- traitement des événements du tracker ----
function handle(m) {
  const cid = m.conv_id
  if (m.type === 'typing' || m.type === 'typing.start') {
    if (cid !== current.value?.id || m.user === me.value?.username) return
    typing[m.user] = Date.now() + 4000
    return
  }
  if (m.type === 'typing.stop') {
    if (m.user) delete typing[m.user]
    return
  }
  if (m.type === 'notification') { notifBus.push(m); pluginHost.hooks.doAction('notification.received', m); return }
  if (m.type === 'new_dm') {
    if (cid && cid !== current.value?.id) unread[cid] = (unread[cid] || 0) + 1
    loadDms()
    return
  }
  if (m.type === 'msg.received' || (!m.type && m.body !== undefined)) {
    pluginHost.hooks.doAction('chat.message.received', m)
    const mine = m.sender_id === me.value?.id
    const viewing = props.visible && cid === current.value?.id
    if (m.sender) delete typing[m.sender] // son message est arrivé → il n'écrit plus
    if (cid === current.value?.id) {
      // écho optimiste : remplace le message temporaire (id négatif) par la version serveur
      const idx = mine ? messages.value.findIndex((x) => x.id < 0 && x.body === m.body) : -1
      const msg = { ...m, created_at: m.at || m.created_at }
      if (idx >= 0) messages.value.splice(idx, 1, msg)
      else { messages.value.push(msg); if (!mine && !viewing) { unread[cid] = (unread[cid] || 0) + 1 } }
      scrollDown(chatSettings.autoScroll, true)
      if (props.visible) wsSend({ type: 'read', conv_id: cid })
    } else if (cid) {
      unread[cid] = (unread[cid] || 0) + 1
      const dm = dms.value.find((d) => d.id === cid)
      if (dm) { dm.last_message = m.body; dm.last_at = m.at }
      // conv inconnue (nouveau MP) → recharger la liste des MP pour l'afficher
      else if (!channels.value.some((c) => c.id === cid) && !mods.value.some((x) => x.id === cid)) loadDms()
    }
    if (!mine && !viewing) { maybeSound(m); maybeToast(m) }
    return
  }
  if (m.type === 'msg.edited') {
    const t = messages.value.find((x) => x.id === m.message_id)
    if (t) { t.body = m.body; t.edited_at = m.edited_at }
  }
  if (m.type === 'msg.deleted') {
    const t = messages.value.find((x) => x.id === m.message_id)
    if (t) t.deleted_at = new Date().toISOString()
  }
  if (m.type === 'reaction.updated') {
    const t = messages.value.find((x) => x.id === m.message_id)
    if (t) { t.reactions = m.counts; if (m.users) t.reaction_users = m.users }
  }
  if (m.type === 'chan.cleared' && cid === current.value?.id) messages.value = []
}

// son seulement sur mention / réponse à moi / MP (sauf réglage « tous les messages »)
function maybeSound(m) {
  if (!chatSettings.sound) return
  const isDm = dms.value.some((d) => d.id === m.conv_id)
  if (chatSettings.soundAllMessages || isDm) { playChatSound(chatSettings.soundVolume); return }
  const name = me.value?.username?.toLowerCase()
  if (!name) return
  const mentionsMe = (m.body || '').toLowerCase().includes('@' + name)
  const replyToMe = m.parent?.sender && m.parent.sender.toLowerCase() === name
  if (mentionsMe || replyToMe) playChatSound(chatSettings.soundVolume)
}

// toast sur MP reçu ou mention (quand on ne regarde pas déjà la conversation)
function maybeToast(m) {
  const cid = m.conv_id
  const name = me.value?.username?.toLowerCase()
  const isDm = dms.value.some((d) => d.id === cid)
  const mentionsMe = name && (m.body || '').toLowerCase().includes('@' + name)
  const replyToMe = name && m.parent?.sender && m.parent.sender.toLowerCase() === name
  if (isDm) {
    toast.push({ icon: 'dm', avatar: m.avatar_url, title: `MP de ${m.sender}`, body: bodyPreview(m.body), onClick: () => goConv(cid, 'dms') })
  } else if (mentionsMe || replyToMe) {
    toast.push({ icon: 'mention', avatar: m.avatar_url, title: `${m.sender} t'a ${replyToMe && !mentionsMe ? 'répondu' : 'mentionné'}`, body: bodyPreview(m.body), onClick: () => goConv(cid, 'channels') })
  }
}
function goConv(cid, paneName) {
  if (!props.primary) dock.open()
  pane.value = paneName
  const found = [...channels.value, ...dms.value, ...mods.value].find((c) => c.id === cid)
  openConversation(found || { id: cid, name: 'Conversation', type: paneName === 'dms' ? 'dm' : 'channel' })
}

// total des non-lus → badge de la bulle flottante (seule l'instance connectée alimente le compteur)
const unreadAll = computed(() => Object.values(unread).reduce((s, n) => s + (n || 0), 0))
watch([unreadAll, () => props.active], ([n, active]) => { if (active) dock.setUnread(n) }, { immediate: true })

// ---- indicateur « untel écrit… » ----
const typingLabel = computed(() => {
  const now = Date.now()
  const names = Object.entries(typing).filter(([, exp]) => exp > now).map(([n]) => n)
  if (!names.length) return ''
  return names.length === 1 ? `${names[0]} est en train d'écrire…` : `${names.join(', ')} écrivent…`
})
const typingSweep = setInterval(() => { for (const k of Object.keys(typing)) if (typing[k] < Date.now()) delete typing[k] }, 2000)
onBeforeUnmount(() => clearInterval(typingSweep))
function onTyping(kind, cid) { wsSend({ type: kind === 'start' ? 'typing.start' : 'typing.stop', conv_id: cid }) }

// ---- ouverture / historique d'une conversation ----
async function openConversation(c) {
  current.value = c
  unread[c.id] = 0
  replyTo.value = null
  composer.value?.resetFor()
  for (const k of Object.keys(typing)) delete typing[k] // purge du canal précédent
  messages.value = []
  loading.value = true
  try {
    const r = await $fetch(`/api/t/conversations/${c.id}/messages`)
    messages.value = (r.messages || []).slice().reverse()
    hasMore.value = !!r.has_more
    wsSend({ type: 'read', conv_id: c.id })
  } catch { messages.value = [] } finally {
    loading.value = false
    scrollDown(true)
  }
}

async function loadOlder() {
  const first = messages.value[0]
  if (!first || !current.value) return
  const r = await $fetch(`/api/t/conversations/${current.value.id}/messages`, { query: { before: first.id } })
  messages.value = [...(r.messages || []).slice().reverse(), ...messages.value]
  hasMore.value = !!r.has_more
}

// envoi : écho optimiste (id négatif) remplacé quand le serveur renvoie le message
function send(body) {
  if (!body || !current.value || wsState.value !== 'ok') return
  const tmp = {
    id: -Date.now(), sender_id: me.value?.id, sender: me.value?.username, sender_role: me.value?.role,
    avatar_url: me.value?.avatar_url, body, created_at: new Date().toISOString(),
    parent: replyTo.value ? { id: replyTo.value.id, sender: replyTo.value.sender, body: replyTo.value.body } : undefined,
  }
  messages.value.push(tmp)
  wsSend({ type: 'msg.send', conv_id: current.value.id, body, ...(replyTo.value ? { parent_id: replyTo.value.id } : {}) })
  replyTo.value = null
  scrollDown(false, true)
}

function mentionUser(name) {
  if (readOnly.value) return
  composer.value?.insertMention(name)
}

// ---- réactions ----
function toggleReaction(m, emoji) {
  if (readOnly.value || m.id < 0) return
  const mine = m.my_reactions || (m.my_reactions = [])
  const has = mine.includes(emoji)
  wsSend({ type: has ? 'reaction.remove' : 'reaction.add', message_id: m.id, emoji })
  // maj optimiste — reaction.updated (WS) fait foi ensuite
  if (has) {
    m.my_reactions = mine.filter((e) => e !== emoji)
    m.reactions[emoji] = Math.max(0, (m.reactions[emoji] || 1) - 1)
    if (!m.reactions[emoji]) delete m.reactions[emoji]
  } else {
    if (!m.reactions) m.reactions = {}
    m.my_reactions.push(emoji)
    m.reactions[emoji] = (m.reactions[emoji] || 0) + 1
  }
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '👀']
const reactPicker = reactive({ open: false, x: 0, y: 0, msg: null })
function openReactPicker(m, ev) {
  const r = ev.currentTarget.getBoundingClientRect()
  reactPicker.msg = m
  reactPicker.x = Math.min(window.innerWidth - 300, Math.max(8, r.left - 40))
  reactPicker.y = Math.max(8, r.top - 46)
  reactPicker.open = true
}
function addReaction(emoji) {
  const m = reactPicker.msg
  if (m && !(m.my_reactions || []).includes(emoji)) toggleReaction(m, emoji)
  reactPicker.open = false
}
function closeReactPicker() { reactPicker.open = false }
watch(() => reactPicker.open, (v) => { if (v) setTimeout(() => document.addEventListener('click', closeReactPicker, { once: true })) })

async function deleteMessage(m) {
  if (!confirm('Supprimer ce message ?')) return
  try { await $fetch(`/api/t/messages/${m.id}`, { method: 'DELETE' }) } catch {}
  m.deleted_at = new Date().toISOString()
  m.body = undefined
}

// petite animation de défilement (rAF) : behavior:'smooth' natif est parfois ignoré selon l'environnement
let scrollRaf = 0
function animateScrollTo(el, to) {
  cancelAnimationFrame(scrollRaf)
  const start = el.scrollTop
  // très loin du bas → on saute près de la cible pour garder une animation courte
  const from = to - start > 800 ? (el.scrollTop = to - 400) : start
  const dist = to - from
  if (Math.abs(dist) < 2) { el.scrollTop = to; return }
  const dur = 350, t0 = performance.now()
  const step = (now) => {
    const p = Math.min(1, (now - t0) / dur)
    el.scrollTop = from + dist * (1 - Math.pow(1 - p, 3))
    if (p < 1) scrollRaf = requestAnimationFrame(step)
  }
  scrollRaf = requestAnimationFrame(step)
}

function scrollDown(force, smooth = false) {
  nextTick(() => {
    const el = msgBox.value
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200
    if (!force && !nearBottom) return
    const to = el.scrollHeight - el.clientHeight
    if (smooth) animateScrollTo(el, to)
    else el.scrollTop = to
  })
}

// quand la conversation courante devient visible, marquer lu + recaler la vue en bas
watch(() => props.visible, (v) => {
  if (v && current.value) {
    unread[current.value.id] = 0
    wsSend({ type: 'read', conv_id: current.value.id })
    scrollDown(true, true)
  }
})

onMounted(() => { loadDms(); loadMods() })
onBeforeUnmount(stopWs)
watch(channels, (cs) => {
  if (cs.length && !current.value && !(props.primary && (route.query.conv || route.query.dm))) {
    openConversation(cs.find((c) => c.slug === 'general') || cs[0])
  }
}, { immediate: true })

// deep-links gérés par l'instance principale (page /chat) uniquement
if (props.primary) {
  watch(() => route.query.dm, (u) => { if (u) startDm(String(u)) }, { immediate: true })
  watch(() => route.query.conv, (id) => { if (id) openConvById(id) }, { immediate: true })
}
async function openConvById(id) {
  const idn = Number(id)
  await loadMods()
  const found = mods.value.find((m) => m.id === idn) || dms.value.find((d) => d.id === idn) || channels.value.find((c) => c.id === idn)
  if (found) { pane.value = found.type === 'moderation' ? 'mods' : found.type === 'dm' ? 'dms' : 'channels'; openConversation(found) }
  else openConversation({ id: idn, name: 'Conversation', type: 'moderation' })
}
</script>
