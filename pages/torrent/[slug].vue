<template>
  <div style="display:flex; flex-direction:column; gap:14px; padding-top:16px">
    <NuxtLink to="/" class="muted" style="font-size:13px">← Retour à la liste</NuxtLink>

    <div v-if="error" class="errbox">{{ errMsg }}</div>
    <div v-else-if="pending" class="empty"><span class="spin" /> Chargement…</div>

    <template v-else-if="t">
      <!-- En-tête -->
      <div class="card" style="display:flex; gap:18px">
        <img v-if="cover" :src="cover" alt="" style="width:150px; border-radius:8px; align-self:flex-start; max-width:30%" />
        <div style="min-width:0; flex:1; display:flex; flex-direction:column; gap:10px">
          <h1 style="margin:0; font-size:18px; line-height:1.35; word-break:break-word">{{ t.name }}</h1>
          <div class="chips">
            <span class="badge b-cat">{{ t.sub_cat_name || t.cat_name || t.parent_cat_name }}</span>
            <span v-if="t.is_freeleech" class="badge b-fl">FREELEECH</span>
            <span v-if="t.is_exclusive" class="badge b-fl">EXCLU</span>
            <span v-if="t.is_internal" class="badge b-fl">INTERNAL</span>
            <span v-if="resTag(t.tags)" class="badge b-res">{{ resTag(t.tags) }}</span>
            <span v-for="tag in (t.tags || []).filter((x) => x !== resTag(t.tags))" :key="tag" class="badge">{{ tag }}</span>
            <PluginSlot name="torrent.detail.badges" :ctx="t" />
          </div>
          <p v-if="t.synopsis" class="muted" style="margin:0; white-space:normal">{{ t.synopsis }}</p>
          <div class="kpis">
            <div class="kpi"><span class="lbl">Seeders</span><div class="val good">{{ t.seeders }}</div></div>
            <div class="kpi"><span class="lbl">Leechers</span><div class="val warn">{{ t.leechers }}</div></div>
            <div class="kpi"><span class="lbl">Complétions</span><div class="val">{{ fmtInt(t.times_completed) }}</div></div>
            <div class="kpi"><span class="lbl">Taille</span><div class="val">{{ fmtSize(t.size_bytes) }}</div><div class="sub">{{ t.file_count }} fichier(s)</div></div>
            <div class="kpi"><span class="lbl">Vues</span><div class="val">{{ fmtInt(t.views) }}</div></div>
          </div>
          <div class="muted" style="font-size:12px">
            Ajouté {{ fmtAge(t.created_at) }}<template v-if="t.year"> · {{ t.year }}</template>
            <template v-if="t.piece_length"> · pièces {{ fmtSize(t.piece_length) }}</template>
          </div>
          <div class="mono muted" style="font-size:11px; word-break:break-all" v-if="t.info_hash">{{ t.info_hash }}</div>
          <div style="display:flex; gap:10px; margin-top:2px; flex-wrap:wrap">
            <a class="chip on" :href="torrentDlUrl(t)" style="padding:8px 16px" @click="torrentDlClick(t)"><Download :size="14" /> Télécharger le .torrent</a>
            <a v-if="t.imdb_id" class="chip" :href="`https://www.imdb.com/title/${t.imdb_id}`" target="_blank" rel="noreferrer" style="padding:8px 16px">IMDb <ExternalLink :size="12" /></a>
            <a class="chip" :href="`https://tr4ker.net/torrent/${t.slug}`" target="_blank" rel="noreferrer" style="padding:8px 16px">Ouvrir sur TR4KER <ExternalLink :size="12" /></a>
            <PluginSlot name="torrent.detail.actions" :ctx="t" />
          </div>
        </div>
      </div>

      <!-- Carte uploadeur -->
      <div v-if="showUploader" class="card" style="padding:0; overflow:hidden">
        <div class="up-banner" :style="t.uploader_banner ? `background-image:url(${proxyImg(t.uploader_banner)})` : ''" />
        <NuxtLink :to="`/?up=${encodeURIComponent(t.uploader)}`" class="up-row">
          <img v-if="t.uploader_avatar" class="up-av" :src="proxyImg(t.uploader_avatar)" alt="" />
          <div v-else class="up-av ph">{{ t.uploader[0] }}</div>
          <div style="min-width:0">
            <div style="font-weight:700">{{ t.uploader }}</div>
            <div class="muted" style="font-size:11.5px">Uploadeur · voir ses torrents</div>
          </div>
          <span style="margin-left:auto; display:flex; gap:6px; align-items:center">
            <PluginSlot name="torrent.uploader.actions" :ctx="t" stop />
            <ChevronRight :size="18" style="color:var(--muted)" />
          </span>
        </NuxtLink>
      </div>

      <!-- Onglets -->
      <div class="tabs">
        <button v-if="hasDesc" :class="{ on: tab === 'desc' }" @click="tab = 'desc'"><FileText :size="14" /> Description</button>
        <button v-if="hasCast" :class="{ on: tab === 'cast' }" @click="tab = 'cast'"><Users :size="14" /> Distribution</button>
        <button v-if="tech.length" :class="{ on: tab === 'tech' }" @click="tab = 'tech'"><component :is="techIcon" :size="14" /> {{ techLabel }}</button>
        <button v-if="t.nfo" :class="{ on: tab === 'nfo' }" @click="tab = 'nfo'"><ScrollText :size="14" /> NFO</button>
        <button :class="{ on: tab === 'files' }" @click="tab = 'files'"><Folder :size="14" /> Fichiers ({{ (t.files || []).length }})</button>
        <button :class="{ on: tab === 'comments' }" @click="tab = 'comments'"><MessageSquare :size="14" /> Commentaires ({{ comments.length }})</button>
        <button v-for="pt in pluginTabs" :key="pt.id" :class="{ on: tab === pt.id }" @click="tab = pt.id">
          <component v-if="pt.icon" :is="pt.icon" :size="14" /> {{ pt.label }}
        </button>
      </div>

      <!-- Description -->
      <div v-if="tab === 'desc'" class="card richtext" v-html="descHtml" />

      <!-- Distribution TMDB -->
      <div v-else-if="tab === 'cast'" class="card">
        <div v-if="castLoading" class="empty"><span class="spin" /></div>
        <div v-else-if="!cast.length" class="empty">Distribution indisponible.</div>
        <div v-else class="castgrid">
          <div v-for="(c, i) in cast" :key="c.id || i" class="castcard">
            <img v-if="c.profile_url || c.profile_path" :src="c.profile_url || `https://image.tmdb.org/t/p/w185${c.profile_path}`" loading="lazy" alt="" />
            <div v-else class="castph"><Users :size="22" /></div>
            <div class="castname">{{ c.name }}</div>
            <div class="castrole">{{ c.character }}</div>
          </div>
        </div>
      </div>

      <!-- Technique -->
      <div v-else-if="tab === 'tech'" style="display:flex; flex-direction:column; gap:12px">
        <div v-for="sec in tech" :key="sec.section" class="tablewrap">
          <table>
            <thead><tr><th colspan="2">{{ sec.section }}</th></tr></thead>
            <tbody>
              <tr v-for="[k, v] in sec.rows" :key="k"><td style="color:var(--muted); width:40%">{{ k }}</td><td class="grow">{{ v }}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- NFO -->
      <div v-else-if="tab === 'nfo'" class="card" style="padding:0">
        <pre class="nfo">{{ t.nfo }}</pre>
      </div>

      <!-- Fichiers -->
      <div v-else-if="tab === 'files'" class="tablewrap">
        <table>
          <thead><tr><th>Fichier</th><th class="num">Taille</th><th></th></tr></thead>
          <tbody>
            <tr v-for="f in t.files || []" :key="f.path || f.name">
              <td class="grow mono" style="font-size:12px">{{ f.path || f.name }}</td>
              <td class="num">{{ fmtSize(f.size_bytes ?? f.size) }}</td>
              <td>
                <div style="display:flex; gap:6px; align-items:center; justify-content:flex-end">
                  <PluginSlot name="torrent.files.row.actions" :ctx="{ file: f, torrent: t }" />
                </div>
              </td>
            </tr>
            <tr v-if="!(t.files || []).length"><td colspan="3" class="empty">Liste de fichiers indisponible (torrent mono-fichier).</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Commentaires -->
      <div v-else-if="tab === 'comments'" class="card" style="padding:0">
        <div v-if="commentsLoading" class="empty"><span class="spin" /></div>
        <div v-for="c in comments" :key="c.id" class="cmt">
          <img v-if="c.avatar_url" class="cmt-av" :src="proxyImg(c.avatar_url)" loading="lazy" alt="" />
          <div v-else class="cmt-av ph">{{ (c.username || c.sender || '?')[0] }}</div>
          <div style="min-width:0">
            <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap">
              <b style="font-size:12.5px">{{ c.username || c.sender }}</b> <span class="mono muted" style="font-size:10px">{{ fmtAge(c.created_at) }}</span>
              <PluginSlot name="torrent.comment.actions" :ctx="{ comment: c, torrent: t }" />
            </div>
            <div class="richtext" style="font-size:13px" v-html="bbcodeToHtml(c.body || c.content)" />
          </div>
        </div>
        <div v-if="!commentsLoading && !comments.length" class="empty">Aucun commentaire.</div>
      </div>

      <!-- Onglets fournis par des plugins -->
      <component v-else-if="activePluginTab" :is="activePluginTab.component" :ctx="t" />

      <!-- Liés -->
      <div v-if="related.length" class="card">
        <div class="muted" style="font-family:var(--mono); font-size:11px; text-transform:uppercase; letter-spacing:.8px; margin-bottom:10px">Torrents liés</div>
        <div class="cardgrid">
          <NuxtLink v-for="r in related.slice(0, 12)" :key="r.id" :to="`/torrent/${r.slug}`" class="tcard">
            <div class="pwrap">
              <img v-if="r.poster_url || r.classic_cover_url" :src="r.poster_url || r.classic_cover_url" loading="lazy" alt="" />
              <span v-else class="ph"><Film :size="30" /></span>
              <span class="card-plugslot"><PluginSlot name="torrent.card.overlay" :ctx="r" stop /></span>
            </div>
            <div class="body">
              <div class="tname">{{ r.name }}</div>
              <div class="foot"><span class="snum seed">▲{{ r.seeders }}</span><span>{{ fmtSize(r.size_bytes) }}</span></div>
            </div>
          </NuxtLink>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { Download, ExternalLink, Film, FileText, ScrollText, Folder, MessageSquare, Users, Cpu, BookOpen, Music, ChevronRight } from 'lucide-vue-next'
import { bbcodeToHtml, markdownToHtml, sanitizeHtml, parseTechXml } from '~/composables/useRichText'

const slug = useRoute().params.slug
const pluginHost = usePluginHost()
// cache client aligné sur le proxy : revenir sur une fiche déjà vue est instantané
const { data: tRaw, pending, error } = useCachedFetch(`/api/t/torrents/${slug}`, { ttl: 5 * 60_000 })
// ancre `torrent.detail.data` : les plugins peuvent enrichir/corriger la fiche avant affichage
const t = computed(() => tRaw.value ? pluginHost.filters.applyFilters('torrent.detail.data', tRaw.value) : tRaw.value)
const { data: relatedRaw } = useCachedFetch(`/api/t/torrents/${slug}/related`, { ttl: 10 * 60_000 })
const related = computed(() => Array.isArray(relatedRaw.value) ? relatedRaw.value : relatedRaw.value?.torrents || [])
useHead({ title: computed(() => t.value ? `${t.value.name} — TR4K UI` : 'TR4K UI') })

const errMsg = computed(() => {
  const m = error.value?.data?.statusMessage || error.value?.statusMessage || error.value?.message || 'Erreur'
  if (error.value?.statusCode === 404 || /404|introuvable|<!doctype|<html/i.test(m)) return 'Torrent introuvable — il a peut-être été supprimé ou le lien est erroné.'
  return m
})
const cover = computed(() => t.value?.poster_url || t.value?.classic_cover_url || '')
const showUploader = computed(() => t.value?.uploader && t.value.uploader !== 'Anonyme')

// Description : classic_description (bbcode) ou extra_info (markdown), sinon synopsis
const hasDesc = computed(() => !!(t.value?.classic_description || t.value?.extra_info || t.value?.synopsis))
function renderByFormat(body, fmt) {
  if (fmt === 'html') return sanitizeHtml(body)
  if (fmt === 'markdown') return markdownToHtml(body)
  return bbcodeToHtml(body) // bbcode par défaut
}
const descHtml = computed(() => {
  const x = t.value
  if (!x) return ''
  if (x.classic_description) return renderByFormat(x.classic_description, x.classic_description_format)
  if (x.extra_info) return renderByFormat(x.extra_info, x.extra_info_format)
  return `<p>${(x.synopsis || 'Aucune description.').replace(/</g, '&lt;')}</p>`
})

const tech = computed(() => parseTechXml(t.value?.tech_info_xml))
// libellé/icône de l'onglet « détails » selon le type (livre / audio / vidéo)
const cat = computed(() => t.value?.parent_cat_slug || t.value?.cat_slug || '')
const isBook = computed(() => cat.value === 'livres' || /EbookInfo/.test(t.value?.tech_info_xml || ''))
const isAudio = computed(() => cat.value === 'audio' || /MusicInfo/.test(t.value?.tech_info_xml || ''))
const techLabel = computed(() => isBook.value ? 'Fiche livre' : isAudio.value ? 'Détails album' : 'Technique')
const techIcon = computed(() => isBook.value ? BookOpen : isAudio.value ? Music : Cpu)

// distribution TMDB (proxy) — chargée SEULEMENT à l'ouverture de l'onglet : la plupart des
// fiches ont une description par défaut, inutile de dépenser une requête tracker à chaque vue
const hasCast = computed(() => !!t.value?.tmdb_id && (t.value.tmdb_type === 'movie' || t.value.tmdb_type === 'tv'))
const cast = ref([])
const castLoading = ref(false)
let castLoaded = false
async function loadCast() {
  const v = t.value
  if (castLoaded || !hasCast.value) return
  castLoaded = true
  castLoading.value = true
  try {
    const r = await cachedFetch('/api/t/tmdb/credits', { ttl: 24 * 3600_000, query: { id: v.tmdb_id, type: v.tmdb_type } })
    cast.value = (r.cast || r || []).slice(0, 18)
  } catch { cast.value = [] } finally { castLoading.value = false }
}

// commentaires (chargés à l'ouverture de l'onglet)
const comments = ref([])
const commentsLoading = ref(false)
let commentsLoaded = false
async function loadComments() {
  if (commentsLoaded) return
  commentsLoaded = true
  commentsLoading.value = true
  try {
    const r = await $fetch(`/api/t/torrents/${slug}/comments`, { query: { page: 1, limit: 50 } })
    comments.value = r.comments || r.items || (Array.isArray(r) ? r : [])
  } catch { comments.value = [] } finally { commentsLoading.value = false }
}

// onglets fournis par des plugins (registerTab), filtrés par leur prédicat visible?
const pluginTabs = computed(() => pluginHost.detailTabs.value.filter((pt) => {
  try { return !pt.visible || pt.visible(t.value) } catch { return false }
}))
const activePluginTab = computed(() => pluginTabs.value.find((pt) => pt.id === tab.value))

// onglet par défaut = première section disponible
const tab = ref('files')
watch(t, (v) => {
  if (!v) return
  tab.value = hasDesc.value ? 'desc' : hasCast.value ? 'cast' : tech.value.length ? 'tech' : v.nfo ? 'nfo' : 'files'
  pluginHost.hooks.doAction('torrent.detail.viewed', v)
}, { immediate: true })
// contenus paresseux : chargés à la première ouverture de leur onglet
watch(tab, (v) => {
  if (v === 'comments') loadComments()
  if (v === 'cast') loadCast()
}, { immediate: true })
</script>
