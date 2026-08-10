<template>
  <div class="topbar">
    <div class="topsearch">
      <Search :size="16" />
      <input v-model="globalQ" type="search" placeholder="Rechercher sur TR4KER…" @keydown.enter="doSearch" />
    </div>
    <span class="spacer" />
    <PluginSlot name="topbar.actions" />
    <NotificationBell />
  </div>
</template>

<script setup>
import { Search } from 'lucide-vue-next'

// recherche globale : disponible depuis n'importe quelle page → va sur /?q=
const router = useRouter()
const globalQ = ref('')
function doSearch() {
  const q = globalQ.value.trim()
  router.push({ path: '/', query: q ? { q } : {} })
  globalQ.value = ''
}
</script>
