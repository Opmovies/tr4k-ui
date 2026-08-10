<template>
  <div class="bell-wrap">
    <button class="bell-btn" :title="`${unreadTotal} non lue(s)`" @click="toggle">
      <Bell :size="17" />
      <span v-if="unreadTotal" class="bell-count">{{ unreadTotal > 99 ? '99+' : unreadTotal }}</span>
    </button>

    <Transition name="fade">
      <div v-if="open" class="bell-panel" @click.stop>
        <div class="bell-head">
          <b>Notifications</b>
          <span style="flex:1" />
          <button v-if="hasUnread" class="ghost" style="font-size:11px" @click="markAllRead">Tout marquer lu</button>
          <button class="ghost" style="border:none; padding:3px" @click="open = false"><X :size="14" /></button>
        </div>

        <div v-if="chatCount" class="bell-chat" @click="goChat">
          <MessagesSquare :size="14" />
          <span><b>{{ chatCount }}</b> message{{ chatCount > 1 ? 's' : '' }} chat en attente</span>
          <ChevronRight :size="14" style="margin-left:auto" />
        </div>

        <div class="bell-cats">
          <button v-for="c in catList" :key="c.id" class="chip" :class="{ on: catFilter === c.id }" @click="catFilter = catFilter === c.id ? '' : c.id">
            <component :is="c.icon" :size="12" /> {{ c.label }} <span v-if="c.count" class="cnt">{{ c.count }}</span>
          </button>
        </div>

        <div class="bell-list">
          <div v-if="pending" class="empty" style="padding:18px"><span class="spin" /></div>
          <div v-else-if="!shown.length" class="empty" style="padding:18px">Aucune notification.</div>
          <div v-for="n in shown" :key="n.id" class="bell-item" :class="{ unread: !n.read }" @click="openNotif(n)">
            <component :is="catOf(n.type).icon" :size="15" class="bell-ico" :style="!n.read ? 'color:var(--accent)' : ''" />
            <div style="min-width:0">
              <div class="bell-title">{{ n.title }}</div>
              <div v-if="n.body" class="bell-body">{{ n.body }}</div>
              <div class="bell-time">{{ fmtAge(n.created_at) }} · {{ catOf(n.type).label }}</div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { Bell, X, MessagesSquare, ChevronRight, AtSign, MessageCircle, FileUp, ShieldAlert, Cog } from 'lucide-vue-next'

const open = ref(false)
const catFilter = ref('')
const router = useRouter()

// catégorisation des types de notification observés (mention, message, torrent_*, report…)
const CATS = [
  { id: 'mention', label: 'Mentions', icon: AtSign, match: (t) => t === 'mention' },
  { id: 'chat', label: 'Messages', icon: MessageCircle, match: (t) => ['message', 'dm', 'new_dm', 'channel'].includes(t) },
  { id: 'torrents', label: 'Torrents', icon: FileUp, match: (t) => t?.startsWith('torrent') || ['upload_count', 'thanks'].includes(t) },
  { id: 'moderation', label: 'Modération', icon: ShieldAlert, match: (t) => ['report', 'warning', 'banned', 'moderation', 'mute', 'ticket'].includes(t) },
  { id: 'system', label: 'Système', icon: Cog, match: () => true }, // attrape-tout
]
function catOf(type) { return CATS.find((c) => c.match(type)) || CATS[CATS.length - 1] }

const { data: unreadData, refresh: refreshUnread } = useFetch('/api/t/me/notifications/unread', { server: false })

// notifications poussées en temps réel par le WebSocket du chat (via ChatView → useNotifBus)
const { lastNotif } = useNotifBus()
const wsExtra = ref(0)
watch(lastNotif, (m) => {
  if (!m) return
  if (loaded.value) {
    if (!notifs.value.some((n) => n.id === m.id)) {
      notifs.value = [{ id: m.id, type: m.notif_type, title: m.title, body: m.body, link: m.link, created_at: m.at, read: false }, ...notifs.value]
    }
  } else wsExtra.value++
})
// le compteur serveur vient d'être rafraîchi : il inclut désormais les notifs WS
watch(unreadData, () => { wsExtra.value = 0 })
const chatCount = computed(() => unreadData.value?.chat || 0)
const notifs = ref([])
const loaded = ref(false)
const pending = ref(false)

// une fois la liste chargée, on compte en local (retour instantané au marquage) ; sinon on se fie au
// serveur + les notifications arrivées par WebSocket depuis le dernier rafraîchissement REST
const notifUnread = computed(() => loaded.value ? notifs.value.filter((n) => !n.read).length : (unreadData.value?.unread || 0) + wsExtra.value)
const unreadTotal = computed(() => notifUnread.value + chatCount.value)
const hasUnread = computed(() => notifUnread.value > 0)

const catList = computed(() => CATS.map((c) => ({
  ...c,
  count: notifs.value.filter((n) => !n.read && catOf(n.type).id === c.id).length,
})))

const shown = computed(() => {
  if (!catFilter.value) return notifs.value
  return notifs.value.filter((n) => catOf(n.type).id === catFilter.value)
})

async function load() {
  pending.value = true
  try {
    const r = await $fetch('/api/t/me/notifications', { query: { limit: 50 } })
    notifs.value = r?.notifications || r?.items || (Array.isArray(r) ? r : [])
    loaded.value = true
  } catch { notifs.value = [] } finally { pending.value = false }
}

function toggle() {
  open.value = !open.value
  if (open.value) { load(); refreshUnread() }
}

async function markAllRead() {
  try {
    await $fetch('/api/t/me/notifications/read', { method: 'PATCH' })
    notifs.value = notifs.value.map((n) => ({ ...n, read: true }))
    refreshUnread()
  } catch {}
}

async function openNotif(n) {
  if (!n.read) {
    n.read = true
    $fetch(`/api/t/me/notifications/${n.id}/read`, { method: 'PATCH' }).then(() => refreshUnread()).catch(() => {})
  }
  // les liens /communication?conv=X pointent vers notre page chat (en conservant la conversation)
  if (n.link?.startsWith('/communication')) {
    open.value = false
    const conv = n.link.match(/[?&]conv=(\d+)/)?.[1]
    router.push(conv ? { path: '/chat', query: { conv } } : '/chat')
  }
}

function goChat() { open.value = false; router.push('/chat') }

let timer
onMounted(() => { timer = setInterval(refreshUnread, 90_000) })
onBeforeUnmount(() => clearInterval(timer))

function onDocClick() { open.value = false }
watch(open, (v) => {
  if (v) setTimeout(() => document.addEventListener('click', onDocClick, { once: true }))
  else document.removeEventListener('click', onDocClick)
})
</script>
