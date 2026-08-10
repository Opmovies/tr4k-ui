<template>
  <div class="chan-col">
    <div class="chan-switch">
      <button :class="{ on: pane === 'channels' }" @click="$emit('update:pane', 'channels')"><Hash :size="13" /> Canaux</button>
      <button :class="{ on: pane === 'dms' }" @click="$emit('update:pane', 'dms')">
        <MessagesSquare :size="13" /> Privés
        <span v-if="dmUnreadTotal" class="badge b-fl">{{ dmUnreadTotal }}</span>
      </button>
      <button v-if="mods.length" :class="{ on: pane === 'mods' }" @click="$emit('update:pane', 'mods')">
        <ShieldAlert :size="13" /> Révision
        <span v-if="modUnreadTotal" class="badge b-fl">{{ modUnreadTotal }}</span>
      </button>
    </div>

    <div class="chan-list">
      <!-- conversations de modération (retours du staff sur les uploads) -->
      <template v-if="pane === 'mods'">
        <div v-if="!mods.length" class="empty" style="padding:20px; font-size:12px">Aucune demande de révision.</div>
        <div v-for="m in mods" :key="m.id" class="chan" :class="{ on: current?.id === m.id }" @click="$emit('open', m)">
          <span class="cname"><ShieldAlert :size="14" style="color:var(--leech)" /> {{ modShortName(m.name) }}
            <span v-if="unread[m.id]" class="badge b-fl" style="margin-left:auto">{{ unread[m.id] }}</span>
          </span>
          <span v-if="m.last_message" class="cmeta" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap">{{ m.last_message }}</span>
        </div>
      </template>

      <!-- canaux publics -->
      <template v-else-if="pane === 'channels'">
        <div
          v-for="c in channels" :key="c.id" class="chan" :class="{ on: current?.id === c.id }"
          @click="$emit('open', c)"
        >
          <span class="cname"><span class="cdot" :style="{ background: c.color === '#000' ? 'var(--accent)' : c.color }" />{{ c.name }}
            <span v-if="unread[c.id]" class="badge b-fl" style="margin-left:auto">{{ unread[c.id] }}</span>
          </span>
          <span class="cmeta">{{ fmtInt(c.member_count) }} membres · rétention {{ c.message_retention_days }} j</span>
        </div>
      </template>

      <!-- messages privés + recherche de destinataire -->
      <template v-else>
        <div class="dm-new">
          <input v-model="dmQuery" placeholder="Nouveau MP : pseudo…" @input="searchDmUsers" @keydown.enter="startDmFromQuery" />
          <div v-if="dmResults.length" class="dm-results">
            <div v-for="u in dmResults" :key="u.id" class="dm-result" @click="pickDm(u.username)">
              <img v-if="u.avatar_url" :src="proxyImg(u.avatar_url)" alt="" /><span v-else class="dm-ph">{{ u.username[0] }}</span>
              {{ u.username }}
            </div>
          </div>
        </div>
        <div v-if="!dms.length" class="empty" style="padding:20px; font-size:12px">Aucune conversation privée. Cherche un pseudo ci-dessus.</div>
        <div v-for="d in dms" :key="d.id" class="chan" :class="{ on: current?.id === d.id }" @click="$emit('open', d)">
          <span class="cname">
            <img v-if="d.avatar_url" class="dm-av" :src="proxyImg(d.avatar_url)" alt="" /><span v-else class="dm-av ph">{{ (d.name || '?')[0] }}</span>
            {{ d.name }}
            <span v-if="unread[d.id]" class="badge b-fl" style="margin-left:auto">{{ unread[d.id] }}</span>
          </span>
          <span v-if="d.last_message" class="cmeta" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap">{{ d.last_message }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { Hash, MessagesSquare, ShieldAlert } from 'lucide-vue-next'

const props = defineProps({
  pane: { type: String, required: true },
  channels: { type: Array, default: () => [] },
  dms: { type: Array, default: () => [] },
  mods: { type: Array, default: () => [] },
  current: { type: Object, default: null },
  unread: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['update:pane', 'open', 'startDm'])

const dmUnreadTotal = computed(() => props.dms.reduce((s, d) => s + (props.unread[d.id] || d.unread_count || 0), 0))
const modUnreadTotal = computed(() => props.mods.reduce((s, m) => s + (props.unread[m.id] || m.unread_count || 0), 0))
function modShortName(name) { return (name || '').replace(/^Modération\s*[—-]\s*/, '') }

// ---- recherche d'un destinataire de MP ----
const dmQuery = ref('')
const dmResults = ref([])
let dmSearchTimer
function searchDmUsers() {
  clearTimeout(dmSearchTimer)
  const q = dmQuery.value.trim()
  if (q.length < 2) { dmResults.value = []; return }
  dmSearchTimer = setTimeout(async () => {
    try { dmResults.value = (await $fetch('/api/t/users/search', { query: { q } })).slice(0, 8) } catch { dmResults.value = [] }
  }, 250)
}
function pickDm(username) {
  dmResults.value = []
  dmQuery.value = ''
  emit('startDm', username)
}
function startDmFromQuery() { if (dmQuery.value.trim()) pickDm(dmQuery.value.trim()) }
</script>
