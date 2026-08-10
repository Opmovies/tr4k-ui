<template>
  <div>
    <div v-if="replyTo" class="replybar">
      <Reply :size="13" /> Réponse à <b>{{ replyTo.sender }}</b> — <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:300px">{{ replyTo.body }}</span>
      <button class="ghost" style="border:none; margin-left:auto; padding:2px" @click="$emit('cancelReply')"><X :size="14" /></button>
    </div>
    <div v-if="uploading" class="replybar"><span class="spin" /> Envoi de l'image vers imgbb…</div>
    <div v-if="uploadErr" class="replybar" style="color:var(--danger)">
      <CircleAlert :size="13" /> {{ uploadErr }}
      <button class="ghost" style="border:none; margin-left:auto; padding:2px" @click="uploadErr = ''"><X :size="14" /></button>
    </div>

    <div class="chat-input" style="position:relative">
      <EmojiGifPicker v-if="pickerOpen" @emoji="insertEmoji" @gif="insertGif" />

      <div v-if="mention.open && mention.results.length" class="mention-pop">
        <div
          v-for="(u, i) in mention.results" :key="u.id"
          class="mention-item" :class="{ on: i === mention.idx }"
          @mousedown.prevent="applyMention(u)"
        >
          <img v-if="u.avatar_url" :src="proxyImg(u.avatar_url)" alt="" /><span v-else class="dm-ph">{{ u.username[0] }}</span>
          {{ u.username }}
        </div>
      </div>

      <textarea
        ref="inputEl" v-model="draft" rows="1" :placeholder="placeholder"
        @keydown="onKeydown"
        @input="onInput"
        @paste="onPaste"
        @drop.prevent="onDrop"
        @dragover.prevent
      />
      <button class="ghost" :class="{ primary: pickerOpen }" title="Émojis & GIFs" @click="pickerOpen = !pickerOpen"><Smile :size="16" /></button>
      <button class="ghost" title="Partager une image (ou colle-la directement)" @click="pickFile"><ImagePlus :size="16" /></button>
      <PluginSlot name="chat.composer.actions" :ctx="current" />
      <button class="primary" :disabled="!draft.trim() || wsState !== 'ok'" @click="send"><Send :size="15" /></button>
      <input ref="fileEl" type="file" accept="image/*" style="display:none" @change="onFile" />
    </div>
  </div>
</template>

<script setup>
import { Send, Reply, X, Smile, ImagePlus, CircleAlert } from 'lucide-vue-next'

/**
 * Zone de saisie du chat : brouillon, autocomplétion des @mentions, picker émoji/GIF,
 * partage d'image (coller / glisser / bouton → imgbb), notifications de frappe.
 * N'envoie rien lui-même : émet `send` / `typing`, le parent (ChatView) parle au WebSocket.
 */
const props = defineProps({
  current: { type: Object, default: null },
  wsState: { type: String, default: 'ko' },
  replyTo: { type: Object, default: null },
})
const emit = defineEmits(['send', 'cancelReply', 'typing'])

const placeholder = computed(() =>
  props.current?.type === 'dm' ? `Message privé à ${props.current.name}…` : `Message dans ${props.current?.name || ''}… (colle une image)`)

const draft = ref('')
const pickerOpen = ref(false)
const inputEl = ref(null)
const fileEl = ref(null)
const uploading = ref(false)
const uploadErr = ref('')

function send() {
  const body = draft.value.trim()
  if (!body || props.wsState !== 'ok') return
  stopTypingNow()
  emit('send', body)
  draft.value = ''
}

/** Réinitialise l'état volatil (appelé par ChatView au changement de conversation). */
function resetFor() {
  pickerOpen.value = false
  mention.open = false
}
/** Insère une @mention (clic sur un pseudo dans un message). */
function insertMention(name) {
  insertAtCursor((draft.value && !draft.value.endsWith(' ') ? ' ' : '') + '@' + name + ' ')
}
defineExpose({ insertMention, resetFor })

// ---- autocomplétion des @mentions pendant la frappe ----
const mention = reactive({ open: false, results: [], idx: 0, at: -1 })
let mentionTimer
function onInput() {
  notifyTyping()
  const el = inputEl.value
  const pos = el?.selectionStart ?? draft.value.length
  const before = draft.value.slice(0, pos)
  const mtc = before.match(/@([\w.-]{0,20})$/)
  if (!mtc) { mention.open = false; return }
  mention.at = pos - mtc[0].length
  const q = mtc[1]
  clearTimeout(mentionTimer)
  if (q.length < 1) { mention.open = false; return }
  mentionTimer = setTimeout(async () => {
    try {
      mention.results = (await $fetch('/api/t/users/search', { query: { q } })).slice(0, 6)
      mention.idx = 0
      mention.open = mention.results.length > 0
    } catch { mention.open = false }
  }, 200)
}
function applyMention(u) {
  const el = inputEl.value
  const pos = el?.selectionStart ?? draft.value.length
  const insert = '@' + u.username + ' '
  draft.value = draft.value.slice(0, mention.at) + insert + draft.value.slice(pos)
  mention.open = false
  nextTick(() => { el?.focus(); const p = mention.at + insert.length; if (el) el.selectionStart = el.selectionEnd = p })
}
function onKeydown(e) {
  if (mention.open) {
    if (e.key === 'ArrowDown') { e.preventDefault(); mention.idx = (mention.idx + 1) % mention.results.length; return }
    if (e.key === 'ArrowUp') { e.preventDefault(); mention.idx = (mention.idx - 1 + mention.results.length) % mention.results.length; return }
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applyMention(mention.results[mention.idx]); return }
    if (e.key === 'Escape') { mention.open = false; return }
  }
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
}

// ---- insertion au curseur (émojis, GIFs, images) ----
function insertAtCursor(text) {
  const el = inputEl.value
  const start = el?.selectionStart ?? draft.value.length
  const end = el?.selectionEnd ?? draft.value.length
  draft.value = draft.value.slice(0, start) + text + draft.value.slice(end)
  nextTick(() => { el?.focus(); if (el) el.selectionStart = el.selectionEnd = start + text.length })
}
function insertEmoji(e) { insertAtCursor(e) }
function insertGif(url) { insertAtCursor(`[img]${url}[/img]`); pickerOpen.value = false }

// ---- partage d'image : coller, glisser-déposer, ou bouton (upload imgbb) ----
function pickFile() { fileEl.value?.click() }
function onFile(ev) { const f = ev.target.files?.[0]; if (f) uploadImage(f); ev.target.value = '' }
const IMG_URL_RE = /^https?:\/\/\S+\.(gif|png|jpe?g|webp)(\?\S*)?$/i
const IMG_HOST_RE = /^https?:\/\/(static\.klipy\.com|media\d*\.tenor\.com|\S*\.?giphy\.com|i\.ibb\.co|i\.imgur\.com)\/\S+/i
function looksLikeImageUrl(s) { return IMG_URL_RE.test(s.trim()) || IMG_HOST_RE.test(s.trim()) }

function onPaste(ev) {
  const item = [...(ev.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'))
  if (item) { ev.preventDefault(); const f = item.getAsFile(); if (f) uploadImage(f); return }
  const text = ev.clipboardData?.getData('text')?.trim()
  if (text && looksLikeImageUrl(text)) { ev.preventDefault(); insertAtCursor(`[img]${text}[/img]`) }
}
function onDrop(ev) {
  const f = [...(ev.dataTransfer?.files || [])].find((f) => f.type.startsWith('image/'))
  if (f) { uploadImage(f); return }
  const url = ev.dataTransfer?.getData('text/uri-list') || ev.dataTransfer?.getData('text')
  if (url && looksLikeImageUrl(url.trim())) insertAtCursor(`[img]${url.trim()}[/img]`)
}
async function uploadImage(file) {
  uploading.value = true
  uploadErr.value = ''
  try {
    const buf = await file.arrayBuffer()
    const r = await $fetch('/api/upload-image', { method: 'POST', body: buf, headers: { 'Content-Type': file.type || 'application/octet-stream' } })
    insertAtCursor(`[img]${r.url}[/img]`)
  } catch (e) {
    uploadErr.value = e?.data?.statusMessage || e?.message || 'Envoi impossible'
  } finally { uploading.value = false }
}

// ---- notifications de frappe (protocole du site : start pendant la frappe, stop après 2,5 s) ----
let lastTyping = 0, typingStopTimer
function notifyTyping() {
  if (!props.current) return
  const cid = props.current.id // figé : le stop différé vise la conversation d'origine
  const now = Date.now()
  if (now - lastTyping >= 2000) { lastTyping = now; emit('typing', 'start', cid) }
  clearTimeout(typingStopTimer)
  typingStopTimer = setTimeout(() => { lastTyping = 0; emit('typing', 'stop', cid) }, 2500)
}
function stopTypingNow() {
  clearTimeout(typingStopTimer)
  lastTyping = 0
  if (props.current) emit('typing', 'stop', props.current.id)
}
</script>
