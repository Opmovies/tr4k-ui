<template>
  <div style="display:flex; flex-direction:column; gap:22px; padding-top:16px">
    <!-- Exclusivités -->
    <section>
      <div class="sec-head">
        <h2><Crown :size="17" /> Exclusivités</h2>
        <span class="muted" style="font-size:12px">Sorties en avant-première sur TR4KER</span>
      </div>
      <TorrentSkeleton v-if="excluPending" view="cards" :count="12" />
      <div v-else-if="!excluGroups.length" class="empty">Aucune exclusivité pour le moment.</div>
      <div v-else class="cardgrid">
        <NuxtLink v-for="g in excluGroups" :key="g.key" :to="`/torrent/${g.rep.slug}`" class="tcard">
          <div class="pwrap">
            <img v-if="g.poster || g.rep.poster_url" :src="g.poster || g.rep.poster_url" loading="lazy" alt="" />
            <span v-else class="ph"><component :is="catIcon(g.rep.parent_cat_slug)" :size="30" /></span>
            <span v-if="g.count > 1" class="badge b-grp fl-tag" style="left:auto; right:6px"><Layers :size="10" /> {{ g.count }}</span>
            <span class="badge b-fl fl-tag">EXCLU</span>
            <span class="card-plugslot"><PluginSlot name="torrent.card.overlay" :ctx="g.rep" stop /></span>
          </div>
          <div class="body">
            <div class="tname">{{ g.count > 1 ? g.title : g.rep.name }}</div>
            <div class="foot">
              <span class="snum seed">▲{{ g.count > 1 ? g.seedMax : (g.rep.seeders ?? 0) }}</span>
              <span>{{ g.count > 1 ? g.count + ' rel.' : fmtSize(g.rep.size_bytes) }}</span>
            </div>
            <div class="muted mono" style="font-size:10px">{{ fmtAge(g.rep.created_at) }}</div>
          </div>
        </NuxtLink>
      </div>
    </section>

    <!-- Derniers ajouts -->
    <section>
      <div class="sec-head">
        <h2><Clock :size="17" /> Derniers ajouts</h2>
        <PluginSlot name="torrent.list.toolbar" />
        <label class="sw" :class="{ on: groupByWork }" title="Regrouper les releases d'un même film/série" @click="groupByWork = !groupByWork">
          <span class="track" /> <Layers :size="13" /> Par œuvre
        </label>
        <div class="seg">
          <button v-for="p in PERIODS" :key="p.v" :class="{ on: period === p.v }" @click="period = p.v">{{ p.l }}</button>
        </div>
      </div>
      <TorrentSkeleton v-if="recentPending" view="list" :count="8" />
      <ReleaseList v-else :groups="recentGroups" empty-label="Aucun ajout récent." />
    </section>
  </div>
</template>

<script setup>
import { Crown, Clock, Layers } from 'lucide-vue-next'
// catIcon vient de composables/useCatIcons (partagé avec l'index et ReleaseList)
useHead({ title: 'Découvrir — TR4KER UI' })

// les listes passent par le même filtre que la recherche (ancre `torrent.list.items`),
// le ctx.source permet aux plugins de distinguer les provenances
const pluginHost = usePluginHost()

// cache client 5 min : revenir sur la page ne relance pas la requête (et pas de skeleton)
const { data: excluRaw, pending: excluPending } = useCachedFetch('/api/t/exclu', { ttl: 5 * 60_000, query: { limit: 60 } })
// les exclus utilisent d'autres noms de champs (title/torrent_slug) → on normalise vers la forme commune
const exclu = computed(() => {
  const l = Array.isArray(excluRaw.value) ? excluRaw.value : excluRaw.value?.torrents || excluRaw.value?.items || []
  const mapped = l.map((e) => ({
    ...e, id: e.torrent_id, name: e.title, slug: e.torrent_slug,
    parent_cat_slug: e.category_slug, uploader: e.uploader_name, is_freeleech: true,
  }))
  return pluginHost.filters.applyFilters('torrent.list.items', mapped, { source: 'exclu' })
})

const PERIODS = [{ v: 'all', l: 'Tout' }, { v: 'day', l: '24h' }, { v: 'week', l: 'Semaine' }]
const period = ref('all')
// query réactive : changer la période relance la requête (l'ancien `await useAsyncData`
// bloquait en plus la navigation vers la page le temps du premier chargement)
const { data: recentRaw, pending: recentPending } = useCachedFetch('/api/t/torrents/recent', {
  ttl: 60_000, query: computed(() => ({ period: period.value, limit: 30 })),
})
const recent = computed(() => pluginHost.filters.applyFilters(
  'torrent.list.items',
  recentRaw.value?.torrents || (Array.isArray(recentRaw.value) ? recentRaw.value : []),
  { source: 'recent' },
))

// même regroupement par œuvre que la recherche (préférence partagée)
const groupByWork = useGroupPref()
const recentGroups = computed(() => buildGroups(recent.value, groupByWork.value))
const excluGroups = computed(() => buildGroups(exclu.value, groupByWork.value))

</script>
