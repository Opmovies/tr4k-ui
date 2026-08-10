<template>
  <div class="picker" @click.stop>
    <div class="picker-tabs">
      <button :class="{ on: mode === 'emoji' }" @click="mode = 'emoji'"><Smile :size="14" /> Émojis</button>
      <button :class="{ on: mode === 'gif' }" @click="switchGif"><Clapperboard :size="14" /> GIFs</button>
    </div>

    <template v-if="mode === 'emoji'">
      <input v-model="emojiQuery" class="picker-search" placeholder="Rechercher un émoji…" />
      <div v-if="!emojiQuery" class="picker-cats">
        <button v-for="c in cats" :key="c.id" :class="{ on: cat === c.id }" :title="c.label" @click="cat = c.id">{{ c.icon }}</button>
      </div>
      <div class="picker-grid emoji">
        <template v-if="!emojiQuery && frequent.length && cat === cats[0]?.id">
          <span class="picker-sec">Fréquents</span>
          <div class="emoji-row">
            <button v-for="e in frequent" :key="'f' + e" @click="pickEmoji(e)">{{ e }}</button>
          </div>
        </template>
        <div class="emoji-row">
          <button v-for="e in shownEmojis" :key="e.emoji" :title="e.name" @click="pickEmoji(e.emoji)">{{ e.emoji }}</button>
        </div>
      </div>
    </template>

    <template v-else>
      <input v-model="gifQuery" class="picker-search" placeholder="Rechercher un GIF… (vide = tendances)" @keydown.enter="searchGifs" />
      <div class="picker-grid gifs">
        <div v-if="gifLoading" class="empty" style="padding:20px"><span class="spin" /></div>
        <template v-else>
          <button v-for="g in gifs" :key="g.id" class="gif-cell" :title="g.title" @click="$emit('gif', g.url)">
            <img :src="g.preview" loading="lazy" alt="" />
          </button>
          <div v-if="!gifs.length" class="empty" style="grid-column:1/-1; padding:16px">Aucun résultat.</div>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup>
import { Smile, Clapperboard } from 'lucide-vue-next'
import cats from '~/data/emoji-data.json'

const emit = defineEmits(['emoji', 'gif'])
const mode = ref('emoji')
const cat = ref(cats[0]?.id)
const emojiQuery = ref('')
const gifQuery = ref('')
const gifs = ref([])
const gifLoading = ref(false)
let gifLoaded = false

// fréquence d'usage, même clé localStorage que le site
const FREQ_KEY = 'emoji_freq'
const frequent = ref([])
function loadFreq() {
  try {
    const f = JSON.parse(localStorage.getItem(FREQ_KEY) || '{}')
    frequent.value = Object.entries(f).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([e]) => e)
  } catch { frequent.value = [] }
}
onMounted(loadFreq)

function pickEmoji(e) {
  try {
    const f = JSON.parse(localStorage.getItem(FREQ_KEY) || '{}')
    f[e] = (f[e] || 0) + 1
    localStorage.setItem(FREQ_KEY, JSON.stringify(f))
  } catch {}
  emit('emoji', e)
}

const shownEmojis = computed(() => {
  const q = emojiQuery.value.trim().toLowerCase()
  if (!q) return cats.find((c) => c.id === cat.value)?.emojis || []
  const out = []
  for (const c of cats) {
    for (const e of c.emojis) {
      if (e.name.includes(q) || (e.keywords || []).some((k) => k.includes(q))) out.push(e)
      if (out.length >= 60) return out
    }
  }
  return out
})

async function searchGifs() {
  gifLoading.value = true
  try {
    const r = await $fetch('/api/gifs', { query: { q: gifQuery.value.trim() || undefined } })
    gifs.value = r.gifs || []
  } catch { gifs.value = [] } finally { gifLoading.value = false }
}
function switchGif() {
  mode.value = 'gif'
  if (!gifLoaded) { gifLoaded = true; searchGifs() }
}
</script>
