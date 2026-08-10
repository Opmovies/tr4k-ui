<template>
  <aside class="sidebar" :class="{ folded }">
    <div class="side-head">
      <NuxtLink to="/" class="logo"><span class="dot" /><span class="logo-txt">TR4K<b>UI</b></span></NuxtLink>
      <button class="fold ghost" @click="folded = !folded">
        <ChevronLeft v-if="!folded" :size="16" /><ChevronRight v-else :size="16" />
      </button>
    </div>
    <nav class="side-nav">
      <NuxtLink v-for="n in nav" :key="n.to" :to="n.to" :title="folded ? n.label : undefined">
        <component :is="n.icon || Puzzle" :size="18" /><span>{{ n.label }}</span>
      </NuxtLink>
    </nav>
    <button class="side-theme ghost" :title="theme === 'dark' ? 'Passer en clair' : 'Passer en sombre'" @click="toggleTheme">
      <Sun v-if="theme === 'dark'" :size="17" /><Moon v-else :size="17" />
      <span v-if="!folded">{{ theme === 'dark' ? 'Thème clair' : 'Thème sombre' }}</span>
    </button>
    <NuxtLink to="/parametres" class="side-settings" :title="folded ? 'Paramètres TR4KUI' : undefined">
      <Settings :size="17" /><span v-if="!folded">Paramètres TR4KUI</span>
    </NuxtLink>
    <NuxtLink to="/plugins" class="side-settings" :title="folded ? 'Plugins' : undefined">
      <Puzzle :size="17" /><span v-if="!folded">Plugins</span>
    </NuxtLink>
    <NuxtLink v-if="updateCount" to="/plugins?updates=1" class="side-settings side-update"
              :title="folded ? `${updateCount} mise(s) à jour disponible(s)` : undefined">
      <span class="upd-ico"><RefreshCw :size="17" /><span class="upd-dot" /></span>
      <span v-if="!folded">Mises à jour</span>
      <span v-if="!folded" class="upd-count">{{ updateCount }}</span>
    </NuxtLink>
    <button v-if="canLogout" class="side-settings side-logout" :title="folded ? 'Déconnexion' : undefined" @click="logout">
      <LogOut :size="17" /><span v-if="!folded">Déconnexion</span>
    </button>
    <div class="side-foot" v-if="me">
      <img v-if="me.avatar_url" :src="proxyImg(me.avatar_url)" class="side-avatar" alt="" />
      <div v-else class="side-avatar ph">{{ me.username?.[0] }}</div>
      <div class="side-who" v-if="!folded">
        <b>{{ me.username }}</b>
        <span class="mono muted">ratio {{ ratio }} · <Coins :size="10" style="vertical-align:-1px" /> {{ fmtInt(me.money) }}</span>
        <span v-if="me.freeleech_global" class="badge b-fl" style="margin-top:4px">FREELEECH GLOBAL</span>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { ChevronLeft, ChevronRight, Compass, ChartColumn, User, Store, Coins, Sun, Moon, Sparkles, Upload, Settings, LogOut, Puzzle, RefreshCw } from 'lucide-vue-next'

// nav du core + entrées enregistrées par les plugins (ancres registerNav/registerPage), triées par order
const CORE_NAV = [
  { to: '/', label: 'Torrents', icon: Compass, order: 0 },
  { to: '/decouvrir', label: 'Découvrir', icon: Sparkles, order: 1 },
  { to: '/mes-uploads', label: 'Mes uploads', icon: Upload, order: 2 },
  { to: '/stats', label: 'Statistiques', icon: ChartColumn, order: 3 },
  { to: '/profil', label: 'Profil', icon: User, order: 5 },
  { to: '/boutique', label: 'Boutique', icon: Store, order: 6 },
]
const pluginHost = usePluginHost()
// ancre `nav.items` : les plugins peuvent masquer/réordonner/renommer les entrées de la sidebar
const nav = computed(() => pluginHost.filters.applyFilters(
  'nav.items',
  [...CORE_NAV, ...pluginHost.navItems.value].sort((a, b) => a.order - b.order),
))

const me = inject('me', ref(null))
const { theme, toggleTheme } = useSettings()

// pastille de mises à jour (app + plugins) — check partagé, une fois par session
const { count: updateCount, ensure: ensureUpdates } = useUpdates()
onMounted(() => ensureUpdates())

const { session } = useSession()
onMounted(() => getSession())
const canLogout = computed(() => session.value?.mode === 'jwt')
async function logout() {
  try { await $fetch('/api/auth/logout', { method: 'POST' }) } catch {}
  invalidateSession()
  window.location.href = '/login'
}

const ratio = computed(() => {
  if (!me.value) return '—'
  const d = me.value.downloaded || 0
  return d ? (me.value.uploaded / d).toFixed(2) : '∞'
})

const folded = ref(false)
onMounted(() => { folded.value = localStorage.getItem('tr4kui.folded') === '1' || window.innerWidth < 900 })
watch(folded, (v) => localStorage.setItem('tr4kui.folded', v ? '1' : '0'))
</script>
