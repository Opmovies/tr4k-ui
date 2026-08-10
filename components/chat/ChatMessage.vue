<template>
  <div class="msg" :class="{ deleted: m.deleted_at, mine }">
    <img v-if="m.avatar_url" class="avatar" :src="proxyImg(m.avatar_url)" loading="lazy" alt="" />
    <div v-else class="avatar ph">{{ (m.sender || '?')[0] }}</div>
    <div class="mbody">
      <div class="mhead">
        <span class="sender" :style="{ color: roleColor(m.sender_role) }" @click="$emit('mention', m.sender)">{{ m.sender }}</span>
        <img v-for="b in (m.featured_badges || []).slice(0, 3)" :key="b.name" class="mbadge" :src="proxyImg(b.img)" :title="b.name" loading="lazy" alt="" />
        <span v-if="m.sender_title" class="badge">{{ m.sender_title }}</span>
        <span class="mtime">{{ fmtTime(m.created_at) }}</span>
        <template v-if="!m.deleted_at">
          <button v-if="!readOnly && m.id > 0" class="ghost react-btn" title="Réagir" @click="$emit('react', m, $event)"><SmilePlus :size="13" /></button>
          <button v-if="!readOnly" class="ghost react-btn" title="Répondre" @click="$emit('reply', m)"><Reply :size="13" /></button>
          <button v-if="mine && m.id > 0" class="ghost react-btn" title="Supprimer" @click="$emit('remove', m)"><Trash2 :size="13" /></button>
          <PluginSlot name="chat.message.actions" :ctx="m" />
        </template>
      </div>
      <div v-if="m.parent" class="mparent"><b>{{ m.parent.sender }}</b> — {{ m.parent.body }}</div>
      <div class="mtext" v-if="m.deleted_at">message supprimé</div>
      <div class="mtext" v-else v-html="renderBody(m.body)" />
      <div v-if="m.reactions && Object.keys(m.reactions).length" class="reacts">
        <span
          v-for="(n, emo) in m.reactions" :key="emo" class="react"
          :class="{ mine: (m.my_reactions || []).includes(emo) }"
          :title="(m.reaction_users?.[emo] || []).join(', ')"
          @click="$emit('toggleReaction', m, emo)"
        >{{ emo }} {{ n }}</span>
        <button v-if="!readOnly && m.id > 0" class="react add" title="Ajouter une réaction" @click="$emit('react', m, $event)"><SmilePlus :size="12" /></button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Reply, SmilePlus, Trash2 } from 'lucide-vue-next'

defineProps({
  m: { type: Object, required: true },
  mine: { type: Boolean, default: false },
  readOnly: { type: Boolean, default: false },
})
defineEmits(['mention', 'react', 'reply', 'remove', 'toggleReaction'])

const me = inject('me', ref(null))

const ROLE_COLORS = { admin: '#ff6b6b', moderator: '#e2b93b', staff: '#ff6b6b', helper: '#5cc8ff', uploader: '#37d99a', team: '#7c5cff', user: '' }
const roleColor = (r) => ROLE_COLORS[r] || ''

function fmtTime(iso) {
  const d = new Date(iso)
  const today = new Date().toDateString() === d.toDateString()
  return (today ? '' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' ') +
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// BBCode minimal du chat : [img], liens http(s) et @mentions (tout le reste est échappé)
function renderBody(body) {
  if (!body) return ''
  // on échappe AUSSI " et ' : sans ça, une URL contenant un guillemet casse
  // l'attribut src/href et permet d'injecter un handler (onerror=…) → XSS stocké.
  let s = body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  s = s.replace(/\[img\](https?:[^[\]]+)\[\/img\]/gi, (_, u) => `<img src="${u}" loading="lazy" alt="">`)
  s = s.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, (_, sp, u) => `${sp}<a href="${u}" target="_blank" rel="noreferrer">${u}</a>`)
  const myName = me.value?.username
  s = s.replace(/(^|\s)@([\w.-]+)/g, (_, sp, n) => `${sp}<span class="mention${myName && n.toLowerCase() === myName.toLowerCase() ? ' me' : ''}">@${n}</span>`)
  return s
}
</script>
