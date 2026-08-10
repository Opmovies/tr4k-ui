/**
 * Toute la logique de la page de recherche (pages/index.vue) : état des filtres persisté
 * dans l'URL (deep-link), construction de la requête API, chargement debouncé avec garde
 * anti-course, chips de filtres actifs. La page ne garde que le template.
 */

// ---- référentiels des filtres ----
export const SEARCH_IN = [{ v: '', l: 'Tout' }, { v: 'title', l: 'Titre' }, { v: 'description', l: 'Description' }, { v: 'tmdb', l: 'TMDB' }]
export const PERIODS = [{ v: '', l: 'Tout' }, { v: 'day', l: '24h' }, { v: 'week', l: 'Semaine' }, { v: 'month', l: 'Mois' }]
export const SOURCES = [{ v: 'tr4ker', l: 'TR4KER' }, { v: 'sharewood', l: 'Sharewood' }, { v: 'ygg', l: 'YGG' }, { v: 'darkiworld', l: 'DarkiWorld' }]
export const SORTS = [
  { v: 'recent', l: 'Date' }, { v: 'seeders', l: 'Seeders' }, { v: 'completed', l: 'Complétions' },
  { v: 'size', l: 'Taille' }, { v: 'leechers', l: 'Leechers' }, { v: 'name', l: 'Nom' },
]
export const GENRES = ['Action', 'Action & Adventure', 'Aventure', 'Animation', 'Comédie', 'Crime', 'Documentaire', 'Drame', 'Familial', 'Fantastique', 'Histoire', 'Horreur', 'Musique', 'Mystère', 'Romance', 'Science-Fiction', 'Science-Fiction & Fantastique', 'Spectacle', 'Téléfilm', 'Thriller', 'Guerre', 'Western'].map((g) => ({ v: g, l: g }))
export const LANGS = [
  { v: 'FRENCH', l: 'Français' }, { v: 'VFF', l: 'VFF (France)' }, { v: 'VFQ', l: 'VFQ (Québec)' }, { v: 'VFB', l: 'VFB (Belgique)' },
  { v: 'VF2', l: 'VF2' }, { v: 'TRUEFRENCH', l: 'TrueFrench' }, { v: 'MULTi', l: 'Multi' }, { v: 'VOSTFR', l: 'VOSTFR' }, { v: 'VO', l: 'VO' },
]

const PAGE_SIZE = 30
const DEBOUNCE_MS = 450

export function useTorrentSearch() {
  const route = useRoute(), router = useRouter()

  // ---- état des filtres (initialisé depuis l'URL) ----
  const s = (k: string, d = '') => ref(route.query[k] !== undefined ? String(route.query[k]) : d)
  const q = s('q'), searchIn = s('in'), cat = s('cat'), period = s('period'), genre = s('genre'), language = s('lang')
  const source = s('src'), uploader = s('up'), team = s('team'), tmdbId = s('tmdb'), imdbId = s('imdb'), tvdbId = s('tvdb')
  const sort = s('sort', 'recent')
  const freeleech = ref(route.query.fl === '1'), favorites = ref(route.query.fav === '1'), exclusive = ref(route.query.ex === '1')
  const tags = ref<string[]>(route.query.tags ? String(route.query.tags).split(',').filter(Boolean) : [])
  const sizeMax = ref<number | null>(route.query.smax ? Number(route.query.smax) : null)
  const sizeUnit = ref(String(route.query.sunit || 'GB'))
  const page = ref(route.query.page ? Number(route.query.page) : 1)
  const view = ref(String(route.query.view || localStorage.getItem('tr4kui.view') || 'list'))
  const tagDraft = ref('')
  const showAdv = ref(false)
  watch(view, (v) => localStorage.setItem('tr4kui.view', v))

  // ---- catégories (cache client long : le référentiel bouge rarement) ----
  const { data: cats } = useCachedFetch<any[]>('/api/t/public/categories', { ttl: 3600_000 })
  const parents = computed(() => (cats.value || []).filter((c) => !c.parent_id))
  const catParent = computed(() => {
    if (!cat.value) return ''
    const c = (cats.value || []).find((x) => x.slug === cat.value)
    if (!c) return cat.value.split('-')[0]
    return c.parent_id ? ((cats.value || []).find((p) => p.id === c.parent_id)?.slug || '') : c.slug
  })
  const subs = computed(() => {
    const p = (cats.value || []).find((x) => x.slug === catParent.value && !x.parent_id)
    return p ? (cats.value || []).filter((c) => c.parent_id === p.id) : []
  })
  const isVideo = computed(() => ['films', 'series'].includes(catParent.value))
  function setCat(slug: string) { cat.value = slug }
  watch(isVideo, (v) => { if (!v) { genre.value = ''; language.value = '' } })

  // ---- mode TMDB : la saisie alimente l'autocomplétion, pas la recherche texte ----
  const isTmdbMode = computed(() => searchIn.value === 'tmdb')
  const tmdbLabel = ref('') // titre choisi, pour un chip lisible (« Matrix (1999) » plutôt que l'id)
  const tmdb = reactive({ open: false, results: [] as any[], idx: 0, pending: false })
  let tmdbTimer: any = null
  watch([q, searchIn], ([nq, si]) => {
    clearTimeout(tmdbTimer)
    const query = String(nq || '').trim()
    if (si !== 'tmdb' || query.length < 2) { tmdb.open = false; tmdb.results = []; return }
    tmdb.pending = true
    tmdbTimer = setTimeout(async () => {
      try {
        const r = await cachedFetch('/api/t/tmdb/suggest', { ttl: 24 * 3600_000, query: { q: query } })
        tmdb.results = (r?.results || []).slice(0, 8)
        tmdb.idx = 0
        tmdb.open = tmdb.results.length > 0
      } catch { tmdb.open = false } finally { tmdb.pending = false }
    }, 300)
  })
  function pickTmdb(r: any) {
    tmdbId.value = String(r.id)
    tmdbLabel.value = `${r.title}${r.year ? ` (${r.year})` : ''}`
    q.value = ''
    tmdb.open = false
    tmdb.results = []
  }
  function onSearchKeydown(e: KeyboardEvent) {
    if (!isTmdbMode.value || !tmdb.open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); tmdb.idx = (tmdb.idx + 1) % tmdb.results.length }
    else if (e.key === 'ArrowUp') { e.preventDefault(); tmdb.idx = (tmdb.idx - 1 + tmdb.results.length) % tmdb.results.length }
    else if (e.key === 'Enter') { e.preventDefault(); const r = tmdb.results[tmdb.idx]; if (r) pickTmdb(r) }
    else if (e.key === 'Escape') { tmdb.open = false }
  }
  // fermeture au blur, différée pour laisser passer un clic sur une suggestion
  function onSearchBlur() { setTimeout(() => { tmdb.open = false }, 150) }

  // ---- requête API ----
  const apiQuery = computed(() => ({
    limit: PAGE_SIZE,
    page: page.value,
    q: !isTmdbMode.value && q.value ? q.value : undefined,
    // ⚠️ l'API ignore `q` si `search_in` est absent → « Tout » recherche par titre par défaut
    search_in: !isTmdbMode.value && q.value ? (searchIn.value || 'title') : undefined,
    cat: cat.value || undefined,
    period: period.value || undefined,
    sort: sort.value,
    genre: genre.value || undefined,
    language: language.value || undefined,
    tags: tags.value.length ? tags.value.join(',') : undefined,
    freeleech: freeleech.value ? 1 : undefined,
    favorites: favorites.value ? 1 : undefined,
    exclusive: exclusive.value ? 1 : undefined,
    source: source.value || undefined,
    size_max: sizeMax.value ? Math.round(sizeMax.value * (sizeUnit.value === 'GB' ? 1024 ** 3 : 1024 ** 2)) : undefined,
    uploader: uploader.value || undefined,
    team: team.value || undefined,
    tmdb_id: tmdbId.value || undefined,
    imdb_id: imdbId.value || undefined,
    tvdb_id: tvdbId.value || undefined,
  }))

  const data = ref<any>(null), pending = ref(true), error = ref<any>(null)
  let timer: any = null, reqId = 0
  async function load() {
    const id = ++reqId // garde anti-course : seule la dernière requête écrit le résultat
    pending.value = true
    try {
      const r = await $fetch('/api/t/torrents', { query: apiQuery.value })
      if (id !== reqId) return
      data.value = r
      error.value = null
    } catch (e) {
      if (id !== reqId) return
      error.value = e
    } finally {
      if (id === reqId) pending.value = false
    }
  }

  // remet la page à 1 quand un filtre change (mais pas quand seule la page bouge)
  watch(apiQuery, (nv, ov) => {
    // recalcul sans changement réel (ex. frappe en mode TMDB : q est exclu de la requête)
    if (JSON.stringify(nv) === JSON.stringify(ov)) return
    const a = { ...nv, page: 0 }, b = { ...ov, page: 0 }
    const pageOnly = JSON.stringify(a) === JSON.stringify(b)
    if (!pageOnly && page.value !== 1) { page.value = 1; return }
    clearTimeout(timer)
    pending.value = true // shimmer immédiat, sans attendre la fin du debounce
    if (pageOnly) {
      // pagination : pas de debounce (ce n'est pas de la frappe) + retour en haut
      window.scrollTo({ top: 0 })
      load()
    } else {
      timer = setTimeout(load, DEBOUNCE_MS)
    }
  }, { deep: true })
  onMounted(load)

  // ---- URL partageable (mise à jour silencieuse à chaque changement de filtre) ----
  watch(apiQuery, () => {
    router.replace({ query: {
      q: q.value || undefined, in: searchIn.value || undefined, cat: cat.value || undefined,
      period: period.value || undefined, genre: genre.value || undefined, lang: language.value || undefined,
      tags: tags.value.join(',') || undefined, fl: freeleech.value ? '1' : undefined,
      fav: favorites.value ? '1' : undefined, ex: exclusive.value ? '1' : undefined,
      src: source.value || undefined, smax: sizeMax.value || undefined,
      sunit: sizeMax.value ? sizeUnit.value : undefined,
      up: uploader.value || undefined, team: team.value || undefined,
      tmdb: tmdbId.value || undefined, imdb: imdbId.value || undefined, tvdb: tvdbId.value || undefined,
      sort: sort.value !== 'recent' ? sort.value : undefined,
      page: page.value > 1 ? page.value : undefined,
    } })
  }, { deep: true })

  // recherche globale (topbar) : si on arrive avec ?q= alors qu'on est déjà sur la page, synchroniser
  watch(() => route.query.q, (v) => { const nv = v ? String(v) : ''; if (nv !== q.value) q.value = nv })

  // les plugins peuvent transformer/filtrer la liste (ancre `torrent.list.items`) ; les refs
  // lues dans leurs filtres restent réactives car ce computed les traque
  const pluginHost = usePluginHost()
  const items = computed(() => pluginHost.filters.applyFilters('torrent.list.items', data.value?.torrents || [], { source: 'search' }))

  const total = computed(() => data.value?.total ?? 0)
  const totalCapped = computed(() => !!data.value?.total_capped)
  const maxPage = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
  const errMsg = computed(() => error.value?.data?.statusMessage || error.value?.statusMessage || error.value?.message || 'Erreur')

  function addTag() {
    const t = tagDraft.value.trim()
    if (t && !tags.value.includes(t)) tags.value = [...tags.value, t]
    tagDraft.value = ''
  }
  const advCount = computed(() =>
    [tags.value.length, source.value, sizeMax.value, uploader.value, team.value, tmdbId.value, imdbId.value, tvdbId.value].filter(Boolean).length)

  const activeChips = computed(() => {
    const out: { key: string; label: string; clear: () => void }[] = []
    const add = (cond: any, label: any, clear: () => void) => cond && out.push({ key: label, label, clear })
    add(q.value, `« ${q.value} »`, () => (q.value = ''))
    add(cat.value, (cats.value || []).find((c) => c.slug === cat.value)?.name || cat.value, () => (cat.value = ''))
    add(period.value, PERIODS.find((p) => p.v === period.value)?.l, () => (period.value = ''))
    add(genre.value, genre.value, () => (genre.value = ''))
    add(language.value, LANGS.find((l) => l.v === language.value)?.l || language.value, () => (language.value = ''))
    for (const t of tags.value) add(true, `tag ${t}`, () => (tags.value = tags.value.filter((x) => x !== t)))
    add(freeleech.value, 'Freeleech', () => (freeleech.value = false))
    add(favorites.value, 'Favoris', () => (favorites.value = false))
    add(exclusive.value, 'Exclusivités', () => (exclusive.value = false))
    add(source.value, SOURCES.find((x) => x.v === source.value)?.l, () => (source.value = ''))
    add(sizeMax.value, `≤ ${sizeMax.value} ${sizeUnit.value === 'GB' ? 'Go' : 'Mo'}`, () => (sizeMax.value = null))
    add(uploader.value, `par ${uploader.value}`, () => (uploader.value = ''))
    add(team.value, `team ${team.value}`, () => (team.value = ''))
    add(tmdbId.value, tmdbLabel.value || `tmdb ${tmdbId.value}`, () => { tmdbId.value = ''; tmdbLabel.value = '' })
    add(imdbId.value, `imdb ${imdbId.value}`, () => (imdbId.value = ''))
    add(tvdbId.value, `tvdb ${tvdbId.value}`, () => (tvdbId.value = ''))
    return out
  })
  function clearAll() {
    q.value = ''; cat.value = ''; period.value = ''; genre.value = ''; language.value = ''
    tags.value = []; freeleech.value = false; favorites.value = false; exclusive.value = false
    source.value = ''; sizeMax.value = null; uploader.value = ''; team.value = ''
    tmdbId.value = ''; tmdbLabel.value = ''; imdbId.value = ''; tvdbId.value = ''; page.value = 1
  }

  return {
    // filtres
    q, searchIn, cat, period, genre, language, source, uploader, team, tmdbId, imdbId, tvdbId,
    sort, freeleech, favorites, exclusive, tags, tagDraft, addTag, sizeMax, sizeUnit,
    page, view, showAdv, advCount,
    // autocomplétion TMDB (onglet TMDB du sélecteur de recherche)
    isTmdbMode, tmdb, pickTmdb, onSearchKeydown, onSearchBlur,
    // catégories
    cats, parents, catParent, subs, isVideo, setCat,
    // résultats
    items, pending, error, errMsg, total, totalCapped, maxPage,
    // chips
    activeChips, clearAll,
  }
}
