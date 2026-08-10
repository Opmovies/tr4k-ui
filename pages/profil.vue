<template>
  <div style="display:flex; flex-direction:column; gap:14px; padding-top:16px">
    <div class="card" style="padding:0; overflow:hidden">
      <div class="banner" :style="me?.banner_url ? `background-image:url(${proxyImg(me.banner_url)})` : ''" />
      <div class="pf-head">
        <img v-if="me?.avatar_url" class="pf-avatar" :src="proxyImg(me.avatar_url)" alt="" />
        <div v-else class="pf-avatar ph">{{ me?.username?.[0] }}</div>
        <div style="flex:1; min-width:200px">
          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap">
            <b style="font-size:19px">{{ me?.username }}</b>
            <span class="badge b-cat" :style="me?.role_color ? `color:${me.role_color}` : ''">{{ me?.role }}</span>
            <span v-if="equippedTitle" class="badge b-fl">{{ equippedTitle }}</span>
          </div>
          <div class="muted" style="font-size:12px; margin-top:3px">
            Inscrit {{ fmtAge(me?.joined_at) }} · vu {{ fmtAge(me?.last_seen_at) }}
          </div>
          <div v-if="me?.quote" class="muted" style="font-size:12px; font-style:italic; margin-top:4px">« {{ me.quote }} »</div>
        </div>
        <div style="display:flex; gap:6px; align-items:center; padding-bottom:4px">
          <img v-for="b in featured" :key="b.name || b.id" :src="proxyImg(b.img || b.image_url)" :title="b.name" style="height:34px" alt="" />
        </div>
      </div>
      <div class="kpis" style="padding:0 18px 18px">
        <div class="kpi"><span class="lbl">Ratio</span><div class="val good">{{ ratio }}</div></div>
        <div class="kpi"><span class="lbl">Upload</span><div class="val">{{ fmtSize(me?.uploaded) }}</div></div>
        <div class="kpi"><span class="lbl">Download</span><div class="val">{{ fmtSize(me?.downloaded) }}</div></div>
        <div class="kpi"><span class="lbl">{{ me?.token_currency_name || 'Crédit' }}s</span><div class="val">{{ fmtInt(me?.money) }}</div></div>
        <div class="kpi"><span class="lbl">Succès</span><div class="val">{{ earnedCount }}<span class="muted" style="font-size:13px">/{{ badges.length }}</span></div></div>
      </div>
    </div>

    <div class="tabs">
      <button :class="{ on: tab === 'achievements' }" @click="tab = 'achievements'"><Trophy :size="14" /> Succès</button>
      <button :class="{ on: tab === 'uploads' }" @click="tab = 'uploads'"><Upload :size="14" /> Mes uploads</button>
      <button :class="{ on: tab === 'favorites' }" @click="tab = 'favorites'"><Bookmark :size="14" /> Favoris</button>
      <button :class="{ on: tab === 'duplicates' }" @click="tab = 'duplicates'"><Copy :size="14" /> Doublons <span v-if="duplicates.length" class="badge b-fl">{{ duplicates.length }}</span></button>
      <button :class="{ on: tab === 'notifications' }" @click="tab = 'notifications'"><Bell :size="14" /> Notifications <span v-if="unreadCount" class="badge b-fl">{{ unreadCount }}</span></button>
    </div>

    <!-- Succès -->
    <template v-if="tab === 'achievements'">
      <div v-for="(group, fam) in badgeFamilies" :key="fam" class="card">
        <div class="muted" style="font-family:var(--mono); font-size:11px; text-transform:uppercase; letter-spacing:.8px; margin-bottom:10px">
          {{ fam }} — {{ group.filter((b) => b.earned).length }}/{{ group.length }}
        </div>
        <div class="badgegrid">
          <div v-for="b in group" :key="b.id" class="abadge" :class="{ locked: !b.earned }">
            <img :src="proxyImg(b.image_url)" loading="lazy" alt="" />
            <div style="min-width:0">
              <div class="bname">{{ b.name }}</div>
              <div class="bdesc">{{ b.description }}</div>
              <div v-if="b.earned" class="bdesc mono" style="color:var(--accent)">obtenu {{ fmtAge(b.awarded_at) }}</div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Mes uploads -->
    <div v-else-if="tab === 'uploads'" class="tablewrap">
      <table>
        <thead><tr><th>Nom</th><th class="num">Taille</th><th class="num">Seed</th><th class="num">Leech</th><th class="num">DL</th><th>Ajouté</th><th></th></tr></thead>
        <tbody>
          <tr v-for="t in uploads" :key="t.id || t.slug">
            <td class="grow">
              <NuxtLink :to="`/torrent/${t.slug}`" style="font-weight:600; font-size:12.5px">{{ t.name }}</NuxtLink>
              <div style="margin-top:3px; display:flex; gap:5px; flex-wrap:wrap">
                <span class="badge b-cat">{{ t.sub_cat_name || t.parent_cat_name || t.cat_name }}</span>
                <PluginSlot name="torrent.row.badges" :ctx="t" />
              </div>
            </td>
            <td class="num">{{ fmtSize(t.size_bytes) }}</td>
            <td class="num" style="color:var(--seed)">{{ t.seeders ?? '—' }}</td>
            <td class="num" style="color:var(--leech)">{{ t.leechers ?? '—' }}</td>
            <td class="num">{{ fmtInt(t.times_completed) }}</td>
            <td class="muted" style="font-size:11.5px">{{ fmtAge(t.created_at) }}</td>
            <td>
              <div style="display:flex; gap:6px; align-items:center; justify-content:flex-end">
                <PluginSlot name="torrent.row.actions" :ctx="t" />
                <a class="iconbtn ghost" :href="torrentDlUrl(t)" title=".torrent" @click="torrentDlClick(t)"><Download :size="14" /></a>
              </div>
            </td>
          </tr>
          <tr v-if="!uploads.length"><td colspan="7" class="empty">Aucun upload.</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Favoris -->
    <div v-else-if="tab === 'favorites'" class="tablewrap">
      <table>
        <thead><tr><th>Nom</th><th class="num">Taille</th><th class="num">Seed</th><th>Ajouté</th><th></th></tr></thead>
        <tbody>
          <tr v-for="t in favorites" :key="t.id || t.slug">
            <td class="grow">
              <NuxtLink :to="`/torrent/${t.slug}`" style="font-weight:600; font-size:12.5px">{{ t.name }}</NuxtLink>
              <PluginSlot name="torrent.row.badges" :ctx="t" />
            </td>
            <td class="num">{{ fmtSize(t.size_bytes) }}</td>
            <td class="num" style="color:var(--seed)">{{ t.seeders ?? '—' }}</td>
            <td class="muted" style="font-size:11.5px">{{ fmtAge(t.created_at) }}</td>
            <td>
              <div style="display:flex; gap:6px; align-items:center; justify-content:flex-end">
                <PluginSlot name="torrent.row.actions" :ctx="t" />
                <a class="iconbtn ghost" :href="torrentDlUrl(t)" title=".torrent" @click="torrentDlClick(t)"><Download :size="14" /></a>
              </div>
            </td>
          </tr>
          <tr v-if="!favorites.length"><td colspan="5" class="empty">Aucun favori.</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Doublons (torrents retirés au profit d'une copie identique conservée) -->
    <template v-else-if="tab === 'duplicates'">
      <div class="pill-note" style="display:flex; gap:8px; align-items:center">
        <Info :size="14" style="flex:none" />
        <span>
          Le tracker déduplique son catalogue : la version « retirée » sera supprimée, la version conservée reste
          (même fichier, même taille — un cross-seed suffit pour continuer à seeder).
          <template v-if="dupRaw?.reward_amount">
            Récompense : <b>{{ fmtInt(dupRaw.reward_amount) }} crédits</b>
            <template v-if="dupRaw.already_rewarded"> (déjà créditée)</template><template v-else> (pas encore créditée)</template>.
          </template>
        </span>
      </div>
      <div v-if="dupPending" class="empty"><span class="spin" /> Chargement…</div>
      <div v-else-if="!duplicates.length" class="empty">Aucun de tes torrents n'est concerné par une déduplication. 👍</div>
      <div v-else class="tablewrap">
        <table>
          <thead><tr><th>Version retirée</th><th>Remplacée par</th><th class="num">Seed</th><th class="num">Taille</th><th>Suppression</th><th></th></tr></thead>
          <tbody>
            <tr v-for="d in duplicates" :key="d.retired_slug">
              <td class="grow">
                <NuxtLink :to="`/torrent/${d.retired_slug}`" style="font-weight:600; font-size:12.5px; color:var(--leech)">{{ d.retired_name }}</NuxtLink>
              </td>
              <td class="grow">
                <NuxtLink :to="`/torrent/${d.kept_slug}`" style="font-weight:600; font-size:12.5px">{{ d.kept_name }}</NuxtLink>
              </td>
              <td class="num" style="color:var(--seed)">{{ d.kept_seeders }}</td>
              <td class="num">{{ fmtSize(d.size_bytes) }}</td>
              <td class="muted" style="font-size:11.5px">{{ fmtScheduled(d.scheduled_for) }}</td>
              <td>
                <div style="display:flex; gap:6px; align-items:center; justify-content:flex-end">
                  <PluginSlot name="profile.duplicates.actions" :ctx="d" />
                  <a class="iconbtn ghost" :href="`/api/download/${d.kept_slug}`" title="Télécharger le .torrent de la version conservée"><Download :size="14" /></a>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Notifications -->
    <div v-else class="card" style="padding:0">
      <div v-for="n in notifications" :key="n.id" style="display:flex; gap:11px; padding:11px 15px; border-bottom:1px solid var(--line); align-items:flex-start" :style="n.read ? 'opacity:.55' : ''">
        <Bell :size="15" style="flex:none; margin-top:2px" :style="n.read ? '' : 'color:var(--accent)'" />
        <div style="min-width:0">
          <div style="font-weight:600; font-size:13px">{{ n.title }}</div>
          <div v-if="n.body" class="muted" style="font-size:12px; white-space:normal">{{ n.body }}</div>
          <div class="mono muted" style="font-size:10px; margin-top:2px">{{ fmtAge(n.created_at) }}</div>
        </div>
      </div>
      <div v-if="!notifications.length" class="empty">Aucune notification.</div>
    </div>
  </div>
</template>

<script setup>
import { Trophy, Upload, Bookmark, Bell, Download, Copy, Info } from 'lucide-vue-next'
useHead({ title: 'Profil — TR4KER UI' })

const me = inject('me', ref(null))
const ratio = computed(() => {
  if (!me.value) return '—'
  const d = me.value.downloaded || 0
  return d ? (me.value.uploaded / d).toFixed(2) : '∞'
})

const tab = ref('achievements')

// chargés tout de suite : l'en-tête (badges mis en avant, titre, KPI Succès) en a besoin
const { data: badgesRaw } = useCachedFetch('/api/t/badges', { ttl: 5 * 60_000 })
const badges = computed(() => Array.isArray(badgesRaw.value) ? badgesRaw.value : [])
const earnedCount = computed(() => badges.value.filter((b) => b.earned).length)
const badgeFamilies = computed(() => {
  const out = {}
  for (const b of badges.value) {
    const fam = b.family || 'Uploads'
    ;(out[fam] ||= []).push(b)
  }
  // familles avec des succès obtenus en premier
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1].filter((x) => x.earned).length - a[1].filter((x) => x.earned).length))
})

const { data: featuredRaw } = useCachedFetch('/api/t/me/featured-badges', { ttl: 5 * 60_000 })
const featured = computed(() => featuredRaw.value?.badges || featuredRaw.value || [])
const { data: titlesRaw } = useCachedFetch('/api/t/me/titles', { ttl: 5 * 60_000 })
const equippedTitle = computed(() => {
  const t = titlesRaw.value
  if (!t) return null
  const list = t.titles || t
  const eq = Array.isArray(list) ? list.find((x) => x.equipped || x.is_equipped) : null
  return eq?.label || eq?.name || t.equipped_title || null
})

// chargés PARESSEUSEMENT à l'ouverture de leur onglet : avant, la page tirait 6 requêtes
// tracker d'un coup alors qu'un seul onglet est visible (budget 20 req/min vite entamé)
const uploadsRaw = ref(null)
const favRaw = ref(null)
const notifRaw = ref(null)
const dupRaw = ref(null)
const dupPending = ref(false)
const TAB_LOADERS = {
  uploads: async () => (uploadsRaw.value = await cachedFetch('/api/t/me/torrents', { ttl: 2 * 60_000 })),
  favorites: async () => (favRaw.value = await cachedFetch('/api/t/me/favorites', { ttl: 2 * 60_000 })),
  notifications: async () => (notifRaw.value = await cachedFetch('/api/t/me/notifications', { ttl: 60_000, query: { limit: 50 } })),
  duplicates: async () => {
    dupPending.value = !dupRaw.value
    try { dupRaw.value = await cachedFetch('/api/t/me/duplicates', { ttl: 5 * 60_000 }) } finally { dupPending.value = false }
  },
}
watch(tab, (t) => { TAB_LOADERS[t]?.().catch(() => {}) }, { immediate: true })

const uploads = computed(() => uploadsRaw.value?.torrents || uploadsRaw.value?.items || (Array.isArray(uploadsRaw.value) ? uploadsRaw.value : []))
const favorites = computed(() => favRaw.value?.torrents || favRaw.value?.items || (Array.isArray(favRaw.value) ? favRaw.value : []))
const notifications = computed(() => notifRaw.value?.notifications || notifRaw.value?.items || (Array.isArray(notifRaw.value) ? notifRaw.value : []))
const unreadCount = computed(() => notifications.value.filter((n) => !n.read).length)

// doublons : /api/me/duplicates (page /mon-compte/doublons du site)
const duplicates = computed(() => dupRaw.value?.duplicates || [])
function fmtScheduled(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (d.getFullYear() >= 2098) return 'pas encore planifiée' // 2099-12-31 = sentinelle du tracker
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>
