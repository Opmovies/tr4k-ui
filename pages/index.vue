<template>
  <div style="display:flex; flex-direction:column; gap:14px; padding-top:16px">

    <!-- Recherche -->
    <div class="card" style="display:flex; flex-wrap:wrap; gap:12px; align-items:center">
      <div style="flex:1; min-width:220px; position:relative">
        <input
          v-model="q" type="search"
          :placeholder="isTmdbMode ? 'Rechercher un film ou une série sur TMDB…' : 'Rechercher un titre, auteur, série…'"
          style="width:100%; font-size:14px; padding:10px 13px"
          @keydown="onSearchKeydown" @blur="onSearchBlur"
        />
        <!-- autocomplétion TMDB : choisir une œuvre filtre par son ID -->
        <div v-if="isTmdbMode && tmdb.open" class="tmdb-pop">
          <div
            v-for="(r, i) in tmdb.results" :key="r.type + ':' + r.id"
            class="tmdb-item" :class="{ on: i === tmdb.idx }" @mousedown.prevent="pickTmdb(r)"
          >
            <img v-if="r.poster_url" :src="r.poster_url" loading="lazy" alt="" />
            <span v-else class="tmdb-ph" />
            <span class="tmdb-title">{{ r.title }}</span>
            <span class="muted mono" style="font-size:11px">{{ r.year }}</span>
            <span class="badge b-cat" style="margin-left:auto">{{ r.type === 'tv' ? 'Série' : 'Film' }}</span>
          </div>
        </div>
      </div>
      <div class="seg">
        <button v-for="o in SEARCH_IN" :key="o.v" :class="{ on: searchIn === o.v }" @click="searchIn = o.v">{{ o.l }}</button>
      </div>
    </div>

    <!-- Catégories -->
    <div class="card" style="display:flex; flex-direction:column; gap:10px">
      <div class="chips">
        <span class="chip" :class="{ on: !cat }" @click="setCat('')">Tout</span>
        <span v-for="p in parents" :key="p.slug" class="chip" :class="{ on: cat === p.slug || catParent === p.slug }" @click="setCat(p.slug)">
          {{ p.name }}
        </span>
      </div>
      <div v-if="subs.length" class="chips">
        <span class="chip" :class="{ on: cat === catParent }" @click="cat = catParent">Toutes</span>
        <span v-for="s in subs" :key="s.slug" class="chip" :class="{ on: cat === s.slug }" @click="cat = s.slug">{{ s.name }}</span>
      </div>

      <div style="display:flex; flex-wrap:wrap; gap:16px; align-items:flex-end">
        <div class="field">
          <span class="lbl">Période</span>
          <div class="seg">
            <button v-for="o in PERIODS" :key="o.v" :class="{ on: period === o.v }" @click="period = o.v">{{ o.l }}</button>
          </div>
        </div>
        <div v-if="isVideo" class="field">
          <span class="lbl">Genre</span>
          <select v-model="genre">
            <option value="">Tous</option>
            <option v-for="g in GENRES" :key="g.v" :value="g.v">{{ g.l }}</option>
          </select>
        </div>
        <div v-if="isVideo" class="field">
          <span class="lbl">Langue</span>
          <select v-model="language">
            <option value="">Toutes</option>
            <option v-for="l in LANGS" :key="l.v" :value="l.v">{{ l.l }}</option>
          </select>
        </div>
        <label class="sw" :class="{ on: freeleech }" @click="freeleech = !freeleech"><span class="track" /> Freeleech</label>
        <label class="sw" :class="{ on: favorites }" @click="favorites = !favorites"><span class="track" /> Favoris</label>
        <label class="sw" :class="{ on: exclusive }" @click="exclusive = !exclusive"><span class="track" /> Exclusivités</label>
        <button class="ghost" style="margin-left:auto" @click="showAdv = !showAdv">
          {{ showAdv ? '▾' : '▸' }} Avancé <span v-if="advCount" class="badge b-cat">{{ advCount }}</span>
        </button>
      </div>

      <!-- Avancé -->
      <div v-if="showAdv" style="display:flex; flex-direction:column; gap:14px; border-top:1px solid var(--line); padding-top:14px">
        <div class="field">
          <span class="lbl">Tags (Entrée pour ajouter — ET logique)</span>
          <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center">
            <span v-for="t in tags" :key="t" class="chip rm" @click="tags = tags.filter((x) => x !== t)">{{ t }} <span class="x">×</span></span>
            <input v-model="tagDraft" placeholder="1080p, BluRay, x265…" style="width:200px" @keydown.enter.prevent="addTag" />
          </div>
        </div>
        <div class="field">
          <span class="lbl">Source (tracker d'origine)</span>
          <div class="chips">
            <span v-for="s in SOURCES" :key="s.v" class="chip" :class="{ on: source === s.v }" @click="source = source === s.v ? '' : s.v">{{ s.l }}</span>
          </div>
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px">
          <div class="field">
            <span class="lbl">Taille max</span>
            <div style="display:flex; gap:6px">
              <input v-model.number="sizeMax" type="number" min="0" placeholder="Ex : 10" style="flex:1" />
              <select v-model="sizeUnit" style="width:70px"><option value="MB">Mo</option><option value="GB">Go</option></select>
            </div>
          </div>
          <div class="field"><span class="lbl">Uploadeur</span><input v-model="uploader" placeholder="Pseudonyme…" /></div>
          <div class="field"><span class="lbl">Team</span><input v-model="team" placeholder="Nom de la team…" /></div>
          <div class="field"><span class="lbl">ID TMDB</span><input v-model="tmdbId" placeholder="123456" /></div>
          <div class="field"><span class="lbl">ID IMDB</span><input v-model="imdbId" placeholder="tt0000000" /></div>
          <div class="field"><span class="lbl">ID TVDB</span><input v-model="tvdbId" placeholder="123456" /></div>
        </div>
      </div>
    </div>

    <!-- Filtres actifs + tri + vue -->
    <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center">
      <span class="mono muted" style="font-size:12px">
        <span v-if="pending" class="spin" />
        <template v-else>{{ fmtInt(total) }}{{ totalCapped ? '+' : '' }} torrents</template>
      </span>
      <span v-for="f in activeChips" :key="f.key" class="chip rm" @click="f.clear()">{{ f.label }} <span class="x">×</span></span>
      <a v-if="activeChips.length" class="muted" style="font-size:12px; text-decoration:underline; cursor:pointer" @click="clearAll">Tout effacer</a>
      <span style="flex:1" />
      <PluginSlot name="torrent.list.toolbar" />
      <label class="sw" :class="{ on: groupByWork }" title="Regrouper les releases d'un même film/série" @click="groupByWork = !groupByWork">
        <span class="track" /> <Layers :size="13" /> Par œuvre
      </label>
      <div class="seg">
        <button v-for="s in SORTS" :key="s.v" :class="{ on: sort === s.v }" @click="sort = s.v">{{ s.l }}</button>
      </div>
      <div class="seg">
        <button :class="{ on: view === 'list' }" title="Vue liste" @click="view = 'list'"><List :size="14" /></button>
        <button :class="{ on: view === 'cards' }" title="Vue cartes" @click="view = 'cards'"><LayoutGrid :size="14" /></button>
      </div>
    </div>

    <div v-if="error" class="errbox">{{ errMsg }}</div>

    <!-- Chargement : skeleton shimmer -->
    <TorrentSkeleton v-if="pending" :view="view" :count="view === 'list' ? 10 : 12" />

    <!-- Résultats : liste (avec regroupement par œuvre) -->
    <ReleaseList
      v-else-if="view === 'list'"
      :groups="displayGroups"
      empty-label="Aucun torrent ne correspond à ces filtres."
    />

    <!-- Résultats : cartes -->
    <div v-else class="cardgrid">
      <NuxtLink v-for="g in displayGroups" :key="g.key" :to="`/torrent/${g.rep.slug}`" class="tcard">
        <div class="pwrap">
          <img v-if="g.poster" :src="g.poster" loading="lazy" alt="" />
          <span v-else class="ph"><component :is="catIcon(g.rep)" :size="34" /></span>
          <span v-if="g.count > 1" class="badge b-grp fl-tag" style="left:auto; right:6px"><Layers :size="10" /> {{ g.count }}</span>
          <span v-else-if="g.rep.is_freeleech" class="badge b-fl fl-tag">FL</span>
          <span class="card-plugslot"><PluginSlot name="torrent.card.overlay" :ctx="g.rep" stop /></span>
        </div>
        <div class="body">
          <div class="tname">{{ g.count > 1 ? g.title : g.rep.name }}</div>
          <div class="foot">
            <span><span class="snum seed">▲{{ g.seedMax }}</span> <span v-if="g.count === 1" class="snum leech">▼{{ g.rep.leechers }}</span></span>
            <span>{{ g.count > 1 ? g.count + ' vers.' : fmtSize(g.rep.size_bytes) }}</span>
          </div>
        </div>
      </NuxtLink>
    </div>

    <div class="pager" v-if="items.length || (pending && page > 1)">
      <button :disabled="pending || page <= 1" @click="page--"><ChevronLeft :size="14" /></button>
      page {{ page }} / {{ maxPage }}{{ totalCapped ? '+' : '' }}
      <button :disabled="pending || (page >= maxPage && !totalCapped)" @click="page++"><ChevronRight :size="14" /></button>
    </div>
  </div>
</template>

<script setup>
import { List, LayoutGrid, ChevronLeft, ChevronRight, Layers } from 'lucide-vue-next'
// Toute la logique (filtres ⇆ URL, requête debouncée, chips) vit dans useTorrentSearch —
// cette page ne garde que la présentation.
import { SEARCH_IN, PERIODS, SOURCES, SORTS, GENRES, LANGS } from '~/composables/useTorrentSearch'

const {
  q, searchIn, cat, period, genre, language, source, uploader, team, tmdbId, imdbId, tvdbId,
  sort, freeleech, favorites, exclusive, tags, tagDraft, addTag, sizeMax, sizeUnit,
  page, view, showAdv, advCount,
  isTmdbMode, tmdb, pickTmdb, onSearchKeydown, onSearchBlur,
  parents, catParent, subs, isVideo, setCat,
  items, pending, error, errMsg, total, totalCapped, maxPage,
  activeChips, clearAll,
} = useTorrentSearch()

// ---- regroupement par œuvre (composable partagé avec /decouvrir) ----
const groupByWork = useGroupPref()
const displayGroups = computed(() => buildGroups(items.value, groupByWork.value))
</script>
