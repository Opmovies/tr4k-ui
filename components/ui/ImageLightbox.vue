<template>
  <Transition name="fade">
    <div v-if="src" class="lightbox" @click="close">
      <img :src="src" alt="" @click.stop />
      <button class="lightbox-x" @click="close"><X :size="22" /></button>
    </div>
  </Transition>
</template>

<script setup>
import { X } from 'lucide-vue-next'
const { src, close } = useLightbox()
function onKey(e) { if (e.key === 'Escape') close() }
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>
