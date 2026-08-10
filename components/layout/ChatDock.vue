<template>
  <!-- Chat flottant : monté en permanence (état préservé), connecté seulement hors /chat -->
  <button v-show="!isChatRoute" class="chat-fab" :class="{ open: dockOpen }" :title="dockOpen ? 'Fermer le chat' : 'Ouvrir le chat'" @click="toggleDock">
    <X v-if="dockOpen" :size="22" /><MessagesSquare v-else :size="22" />
    <span v-if="!dockOpen && chatUnread" class="fab-count">{{ chatUnread > 99 ? '99+' : chatUnread }}</span>
  </button>
  <div ref="dockEl" class="chat-dock" :class="{ dragging }" :style="dockStyle" v-show="dockOpen && !isChatRoute">
    <div class="dock-bar" @pointerdown="startDrag" @dblclick="resetRect">
      <GripHorizontal :size="14" />
      <span class="dock-bar-txt">Chat</span>
      <button class="ghost dock-x" title="Replacer en bas à droite" @click.stop="resetRect"><Minimize2 :size="13" /></button>
      <button class="ghost dock-x" title="Fermer" @click.stop="toggleDock"><X :size="14" /></button>
    </div>
    <div class="dock-body">
      <ChatView floating :active="!isChatRoute" :visible="dockOpen && !isChatRoute" :primary="false" />
    </div>
    <span v-for="h in HANDLES" :key="h" class="dock-rz" :class="'rz-' + h" @pointerdown="(e) => startResize(e, h)" />
  </div>
</template>

<script setup>
import { X, MessagesSquare, GripHorizontal, Minimize2 } from 'lucide-vue-next'

const route = useRoute()
const isChatRoute = computed(() => route.path === '/chat')
const { dockOpen, toggle: toggleDock, rect, unreadTotal: chatUnread, resetRect } = useChatDock()

// ---- déplacement + redimensionnement (position/taille persistées en localStorage) ----
const MIN_W = 380, MIN_H = 320
const HANDLES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']
const dockEl = ref(null)
const dragging = ref(false)

// tant que rect.w vaut 0, on laisse le CSS placer le dock (ancré en bas à droite)
const dockStyle = computed(() => {
  if (!rect.w || rect.x < 0) return {}
  return { left: rect.x + 'px', top: rect.y + 'px', width: rect.w + 'px', height: rect.h + 'px', right: 'auto', bottom: 'auto' }
})

// fige la position/taille courantes (mesurées) avant la première manipulation
function ensureRect() {
  if (rect.w && rect.x >= 0) return
  const r = dockEl.value?.getBoundingClientRect()
  if (!r) return
  rect.x = Math.round(r.left); rect.y = Math.round(r.top)
  rect.w = Math.round(r.width); rect.h = Math.round(r.height)
}

// garde le dock entièrement visible (sinon les poignées deviennent inatteignables)
function clampRect() {
  if (!rect.w) return
  const M = 8
  rect.w = Math.min(rect.w, window.innerWidth - M * 2)
  rect.h = Math.min(rect.h, window.innerHeight - M * 2)
  rect.x = Math.min(Math.max(rect.x, M), Math.max(M, window.innerWidth - rect.w - M))
  rect.y = Math.min(Math.max(rect.y, M), Math.max(M, window.innerHeight - rect.h - M))
}

function startDrag(e) {
  if (e.button !== 0) return
  ensureRect()
  dragging.value = true
  const sx = e.clientX - rect.x, sy = e.clientY - rect.y
  const move = (ev) => { rect.x = ev.clientX - sx; rect.y = ev.clientY - sy; clampRect() }
  const up = () => { dragging.value = false; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

function startResize(e, dir) {
  if (e.button !== 0) return
  e.stopPropagation()
  ensureRect()
  dragging.value = true
  // bords d'origine figés : rect est muté pendant le glissement
  const pX = e.clientX, pY = e.clientY
  const x0 = rect.x, y0 = rect.y, w0 = rect.w, h0 = rect.h
  const move = (ev) => {
    const dx = ev.clientX - pX, dy = ev.clientY - pY
    if (dir.includes('e')) rect.w = Math.max(MIN_W, w0 + dx)
    if (dir.includes('s')) rect.h = Math.max(MIN_H, h0 + dy)
    if (dir.includes('w')) { rect.w = Math.max(MIN_W, w0 - dx); rect.x = x0 + (w0 - rect.w) }
    if (dir.includes('n')) { rect.h = Math.max(MIN_H, h0 - dy); rect.y = y0 + (h0 - rect.h) }
    clampRect()
  }
  const up = () => { dragging.value = false; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

onMounted(() => window.addEventListener('resize', clampRect))
onBeforeUnmount(() => window.removeEventListener('resize', clampRect))
</script>
