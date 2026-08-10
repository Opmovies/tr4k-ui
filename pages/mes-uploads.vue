<template>
  <div style="display:flex; flex-direction:column; gap:14px; padding-top:16px">
    <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap">
      <h1 style="margin:0; font-size:19px; display:flex; gap:9px; align-items:center"><Upload :size="20" /> Mes uploads</h1>
      <span class="muted mono" style="font-size:12px">{{ uploads.length }} torrents</span>
      <span style="flex:1" />
      <div class="chips">
        <span class="chip" :class="{ on: filter === '' }" @click="filter = ''">Tous</span>
        <span v-for="s in statusFacets" :key="s.k" class="chip" :class="{ on: filter === s.k }" @click="filter = s.k">
          {{ s.label }} <span class="cnt">{{ s.count }}</span>
        </span>
      </div>
    </div>

    <div v-if="pending" class="empty"><span class="spin" /> Chargement…</div>
    <div v-else-if="error" class="errbox">{{ error?.data?.statusMessage || error?.message }}</div>

    <div v-else class="tablewrap">
      <table>
        <thead>
          <tr><th>Nom</th><th>Statut</th><th class="num">Taille</th><th class="num">Seed</th><th class="num">Leech</th><th class="num">DL</th><th class="num">Comm.</th><th>Ajouté</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="t in shown" :key="t.id">
            <td class="grow">
              <NuxtLink :to="`/torrent/${t.slug}`" style="font-weight:600; font-size:12.5px">{{ t.name }}</NuxtLink>
              <div style="margin-top:3px; display:flex; gap:5px; flex-wrap:wrap">
                <span class="badge b-cat">{{ t.sub_cat_name || t.parent_cat_name }}</span>
                <span v-if="t.is_freeleech" class="badge b-fl">FL</span>
                <span v-if="t.is_exclusive" class="badge b-fl">EXCLU</span>
                <span v-if="t.is_anonymous" class="badge">ANON</span>
                <PluginSlot name="torrent.row.badges" :ctx="t" />
              </div>
            </td>
            <td>
              <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-start">
                <span class="st-badge" :class="`st-${st(t.status).kind}`">
                  <component :is="stIcon(t.status)" :size="12" />
                  {{ st(t.status).label }}
                </span>
                <NuxtLink
                  v-if="t.moderation_conversation_id && !t.moderation_conversation_hidden"
                  :to="`/chat?conv=${t.moderation_conversation_id}`" class="mod-link"
                >
                  <MessageSquareWarning :size="12" /> Voir la révision
                </NuxtLink>
              </div>
            </td>
            <td class="num">{{ fmtSize(t.size_bytes) }}</td>
            <td class="num" style="color:var(--seed)">{{ t.seeders }}</td>
            <td class="num" style="color:var(--leech)">{{ t.leechers }}</td>
            <td class="num">{{ fmtInt(t.times_completed) }}</td>
            <td class="num muted">{{ t.comment_count ?? 0 }}</td>
            <td class="muted" style="font-size:11.5px">{{ fmtAge(t.created_at) }}</td>
            <td>
              <div style="display:flex; gap:6px; align-items:center; justify-content:flex-end">
                <PluginSlot name="torrent.row.actions" :ctx="t" />
                <a class="iconbtn ghost" :href="torrentDlUrl(t)" title=".torrent" @click="torrentDlClick(t)"><Download :size="14" /></a>
              </div>
            </td>
          </tr>
          <tr v-if="!shown.length"><td colspan="9" class="empty">Aucun torrent pour ce filtre.</td></tr>
        </tbody>
      </table>
    </div>

    <div class="pill-note" style="display:flex; gap:8px; align-items:center">
      <Info :size="14" style="flex:none" />
      Un torrent « En attente de validation » n'est pas encore visible publiquement — le staff le vérifie. Pense à le mettre en seed dans les 3 jours.
    </div>
  </div>
</template>

<script setup>
import { Upload, Download, Info, Clock, CircleCheck, Trash2, ScanEye, Ban, MessageSquareWarning } from 'lucide-vue-next'
useHead({ title: 'Mes uploads — TR4KER UI' })

// même clé de cache que l'onglet « Mes uploads » du profil → une seule requête pour les deux
const { data: raw, pending, error } = useCachedFetch('/api/t/me/torrents', { ttl: 2 * 60_000 })
const uploads = computed(() => raw.value?.torrents || raw.value?.items || (Array.isArray(raw.value) ? raw.value : []))

const st = torrentStatus
const ICONS = { 0: Clock, 1: CircleCheck, 2: Trash2, 3: ScanEye, 4: Ban }
function stIcon(s) { return ICONS[s] ?? CircleCheck }

const filter = ref('')
const statusFacets = computed(() => {
  const by = {}
  for (const t of uploads.value) {
    const k = String(t.status ?? 1)
    by[k] = (by[k] || 0) + 1
  }
  return Object.entries(by).map(([k, count]) => ({ k, count, label: st(Number(k)).label })).sort((a, b) => a.k - b.k)
})
const shown = computed(() => filter.value === '' ? uploads.value : uploads.value.filter((t) => String(t.status ?? 1) === filter.value))
</script>
