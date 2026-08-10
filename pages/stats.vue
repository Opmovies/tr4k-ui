<template>
  <div style="display:flex; flex-direction:column; gap:14px; padding-top:16px">
    <div v-if="error" class="errbox">{{ error?.data?.statusMessage || error?.message }}</div>
    <div v-else-if="pending" class="empty"><span class="spin" /> Chargement…</div>

    <template v-else-if="st">
      <div class="kpis">
        <div class="kpi">
          <span class="lbl">Ratio compté</span>
          <div class="val good">{{ ratio(st.summary.uploaded, st.summary.downloaded) }}</div>
          <div class="sub">brut : {{ ratio(st.summary.raw_uploaded, st.summary.raw_downloaded) }}</div>
        </div>
        <div class="kpi">
          <span class="lbl">Upload</span>
          <div class="val">{{ fmtSize(st.summary.uploaded) }}</div>
          <div class="sub">+ {{ fmtSize(st.summary.bonus_upload) }} bonus</div>
        </div>
        <div class="kpi">
          <span class="lbl">Download compté</span>
          <div class="val">{{ fmtSize(st.summary.downloaded) }}</div>
          <div class="sub">réel : {{ fmtSize(st.summary.raw_downloaded) }}</div>
        </div>
        <div class="kpi"><span class="lbl">En seed</span><div class="val good">{{ st.statistics.torrents_seeding }}</div><div class="sub">{{ st.statistics.torrents_completed }} complétés</div></div>
        <div class="kpi"><span class="lbl">Temps de seed cumulé</span><div class="val" style="font-size:17px">{{ fmtDuration(st.statistics.total_seedtime_seconds) }}</div></div>
        <div class="kpi"><span class="lbl">Crédits</span><div class="val">{{ fmtInt(st.summary.money) }}</div><div class="sub">{{ st.freeleech_count }} torrents freeleech perso</div></div>
      </div>

      <div class="kpis">
        <div class="kpi"><span class="lbl">Upload 24 h</span><div class="val good" style="font-size:17px">{{ fmtSize(st.statistics.uploaded_last_24h) }}</div></div>
        <div class="kpi"><span class="lbl">Upload 7 j</span><div class="val good" style="font-size:17px">{{ fmtSize(st.statistics.uploaded_last_7d) }}</div></div>
        <div class="kpi"><span class="lbl">Download 24 h</span><div class="val" style="font-size:17px">{{ fmtSize(st.statistics.downloaded_last_24h) }}</div></div>
        <div class="kpi"><span class="lbl">Download 7 j</span><div class="val" style="font-size:17px">{{ fmtSize(st.statistics.downloaded_last_7d) }}</div></div>
        <PluginSlot name="stats.kpis" :ctx="st" />
      </div>

      <!-- Courbe upload/download cumulés -->
      <div class="card" v-if="chart">
        <div class="muted" style="font-family:var(--mono); font-size:11px; text-transform:uppercase; letter-spacing:.8px; margin-bottom:8px">
          Upload cumulé — {{ st.snapshots.length }} derniers jours
          <span style="float:right">▲ {{ fmtSize(chart.span) }} sur la période</span>
        </div>
        <svg :viewBox="`0 0 ${W} ${H}`" style="width:100%; height:auto; display:block">
          <line v-for="g in chart.grid" :key="g.y" :x1="0" :x2="W" :y1="g.y" :y2="g.y" stroke="var(--line)" stroke-width="1" />
          <text v-for="g in chart.grid" :key="'t' + g.y" :x="4" :y="g.y - 4" fill="var(--muted)" font-size="9" font-family="var(--mono)">{{ g.label }}</text>
          <polyline :points="chart.up" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" />
          <polygon :points="`${chart.up} ${W},${H} 0,${H}`" fill="rgba(55,217,154,0.08)" stroke="none" />
          <g v-for="p in chart.dots" :key="p.x">
            <circle :cx="p.x" :cy="p.y" r="2.5" fill="var(--accent)" />
          </g>
        </svg>
        <div style="display:flex; justify-content:space-between" class="muted mono" v-if="st.snapshots.length">
          <span style="font-size:10px">{{ st.snapshots[0].date }}</span>
          <span style="font-size:10px">{{ st.snapshots[st.snapshots.length - 1].date }}</span>
        </div>
      </div>

      <!-- Historique par jour -->
      <div class="tablewrap" v-if="daily.length">
        <table>
          <thead><tr><th>Jour</th><th class="num">Upload du jour</th><th class="num">Cumul upload</th><th class="num">Cumul download</th></tr></thead>
          <tbody>
            <tr v-for="d in daily" :key="d.date">
              <td class="mono" style="font-size:12px">{{ d.date }}</td>
              <td class="num" :style="d.delta ? 'color:var(--seed)' : ''">{{ d.delta ? '+' + fmtSize(d.delta) : '—' }}</td>
              <td class="num">{{ fmtSize(d.uploaded_bytes) }}</td>
              <td class="num muted">{{ fmtSize(d.downloaded_bytes) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Mes torrents : historique de téléchargement / seed (toujours affiché, même vide ou en erreur) -->
    <div class="card" style="padding:0">
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:12px 14px">
        <span class="muted" style="font-family:var(--mono); font-size:11px; text-transform:uppercase; letter-spacing:.8px">
          Mes torrents<template v-if="dlTotal"> ({{ fmtInt(dlTotal) }})</template>
        </span>
        <span v-if="dlUpTotal" class="badge" style="color:var(--seed)">{{ fmtSize(dlUpTotal) }} uploadés</span>
        <span style="flex:1" />
        <div class="seg">
          <button v-for="f in DLFILTERS" :key="f.v" :class="{ on: dlFilter === f.v }" @click="dlFilter = f.v">{{ f.l }}</button>
        </div>
        <div class="seg">
          <button v-for="o in DLSORTS" :key="o.v" :class="{ on: dlSort === o.v }" @click="dlSort = o.v">{{ o.l }}</button>
        </div>
      </div>

      <div v-if="dlError" class="errbox" style="margin:0 14px 14px">
        {{ dlError }}
        <button class="ghost small" style="margin-left:10px" @click="loadDls(1)">Réessayer</button>
      </div>
      <div v-else-if="dlPending && !dls.length" class="empty" style="padding:22px"><span class="spin" /> Chargement de tes torrents…</div>
      <div v-else-if="!dls.length" class="empty" style="padding:22px">Aucun torrent téléchargé pour l'instant.</div>
      <div v-else-if="!sortedDls.length" class="empty" style="padding:22px">Aucun torrent dans ce filtre.</div>

      <template v-else>
        <div class="tablewrap" style="border:none; border-top:1px solid var(--line); max-height:560px; overflow-y:auto">
          <table>
            <thead><tr><th colspan="2">Nom</th><th class="num">Taille</th><th class="num">Uploadé</th><th class="num">Rendement</th><th class="num">Seed depuis</th><th></th></tr></thead>
            <tbody>
              <tr v-for="d in sortedDls" :key="d.torrent_id">
                <td style="width:44px; padding-right:0">
                  <NuxtLink :to="`/torrent/${d.slug}`">
                    <img v-if="d.poster_url || d.classic_cover_url" :src="proxyImg(d.poster_url || d.classic_cover_url)" class="dl-poster" loading="lazy" alt="" />
                    <div v-else class="dl-poster ph" />
                  </NuxtLink>
                </td>
                <td class="grow">
                  <NuxtLink :to="`/torrent/${d.slug}`" style="font-weight:600; font-size:12.5px">{{ d.name }}</NuxtLink>
                  <div style="margin-top:3px; display:flex; gap:5px; flex-wrap:wrap; align-items:center">
                    <span class="badge b-cat">{{ d.sub_cat_name || d.cat_name }}</span>
                    <span v-if="d.is_freeleech || d.was_freeleech" class="badge b-fl">FL</span>
                    <span v-if="d.is_completed" class="badge" style="color:var(--seed)">COMPLÉTÉ</span>
                    <span v-else class="badge" style="color:var(--leech)">EN COURS</span>
                    <span v-if="d.first_seen_at" class="muted" style="font-size:10.5px; font-family:var(--mono)">{{ fmtAge(d.first_seen_at) }}</span>
                  </div>
                </td>
                <td class="num">{{ fmtSize(d.size_bytes) }}</td>
                <td class="num" :style="d.uploaded ? 'color:var(--seed)' : ''">{{ fmtSize(d.uploaded) }}</td>
                <td class="num">{{ d.size_bytes ? (d.uploaded / d.size_bytes).toFixed(2) + '×' : '—' }}</td>
                <td class="num muted">{{ fmtDuration(d.seedtime_seconds) }}</td>
                <td><a class="iconbtn ghost" :href="`/api/download/${d.slug}`" title=".torrent"><Download :size="14" /></a></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="dls.length < dlTotal" style="padding:10px; text-align:center; border-top:1px solid var(--line)">
          <button class="ghost" :disabled="dlPending" @click="loadDls(dlPage + 1)">
            <span v-if="dlPending" class="spin" /> Charger les {{ Math.min(PAGE_SIZE, dlTotal - dls.length) }} suivants ({{ dls.length }}/{{ fmtInt(dlTotal) }})
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { Download } from 'lucide-vue-next'
useHead({ title: 'Statistiques — TR4K UI' })
const { data: st, pending, error } = useFetch('/api/t/me/stats', { server: false })

// ---- mes torrents (historique de téléchargement / seed) ----
// chargé à la main pour gérer la pagination ET afficher un vrai message d'erreur :
// avant, un échec (429, session expirée) vidait la liste et la carte disparaissait sans rien dire.
const PAGE_SIZE = 100
const dls = ref([])
const dlTotal = ref(0)
const dlPage = ref(1)
const dlPending = ref(true)
const dlError = ref('')

async function loadDls(page = 1) {
  dlPending.value = true
  if (page === 1) dlError.value = ''
  try {
    const r = await $fetch('/api/t/me/downloads', { query: { page, limit: PAGE_SIZE, filter: 'all' } })
    const items = r?.items || []
    dls.value = page === 1 ? items : [...dls.value, ...items]
    dlTotal.value = r?.total ?? items.length
    dlPage.value = page
  } catch (e) {
    dlError.value = e?.data?.statusMessage || e?.message || 'Chargement impossible'
  } finally { dlPending.value = false }
}
onMounted(() => loadDls(1))

const DLSORTS = [{ v: 'up', l: 'Uploadé' }, { v: 'yield', l: 'Rendement' }, { v: 'time', l: 'Ancienneté' }, { v: 'recent', l: 'Récent' }]
const dlSort = ref('up')
const DLFILTERS = [{ v: 'all', l: 'Tous' }, { v: 'seed', l: 'En seed' }, { v: 'wip', l: 'En cours' }]
const dlFilter = ref('all')

const filteredDls = computed(() => {
  if (dlFilter.value === 'seed') return dls.value.filter((d) => d.is_completed)
  if (dlFilter.value === 'wip') return dls.value.filter((d) => !d.is_completed)
  return dls.value
})
const sortedDls = computed(() => {
  const arr = [...filteredDls.value]
  if (dlSort.value === 'up') arr.sort((a, b) => (b.uploaded || 0) - (a.uploaded || 0))
  if (dlSort.value === 'yield') arr.sort((a, b) => (b.uploaded / (b.size_bytes || 1)) - (a.uploaded / (a.size_bytes || 1)))
  if (dlSort.value === 'time') arr.sort((a, b) => (b.seedtime_seconds || 0) - (a.seedtime_seconds || 0))
  if (dlSort.value === 'recent') arr.sort((a, b) => new Date(b.first_seen_at || 0) - new Date(a.first_seen_at || 0))
  return arr
})
const dlUpTotal = computed(() => dls.value.reduce((s, d) => s + (d.uploaded || 0), 0))

const ratio = (u, d) => (d ? (u / d).toFixed(2) : '∞')

const daily = computed(() => {
  const snaps = st.value?.snapshots || []
  return snaps.map((s, i) => ({ ...s, delta: i > 0 ? Math.max(0, s.uploaded_bytes - snaps[i - 1].uploaded_bytes) : 0 })).reverse()
})

const W = 800, H = 220
const chart = computed(() => {
  const snaps = st.value?.snapshots || []
  if (snaps.length < 2) return null
  const min = snaps[0].uploaded_bytes, max = snaps[snaps.length - 1].uploaded_bytes
  const span = Math.max(1, max - min)
  const x = (i) => (i / (snaps.length - 1)) * W
  const y = (v) => H - 14 - ((v - min) / span) * (H - 40)
  const pts = snaps.map((s, i) => `${x(i).toFixed(1)},${y(s.uploaded_bytes).toFixed(1)}`)
  const dots = snaps.map((s, i) => ({ x: x(i), y: y(s.uploaded_bytes) }))
  const grid = [0.25, 0.5, 0.75, 1].map((f) => ({ y: y(min + span * f), label: fmtSize(min + span * f) }))
  return { up: pts.join(' '), dots, grid, span }
})
</script>
