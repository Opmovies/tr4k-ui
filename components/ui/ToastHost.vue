<template>
  <div class="toast-host">
    <TransitionGroup name="toast">
      <div
        v-for="t in toasts" :key="t.id" class="toast" :class="{ clickable: !!t.onClick }"
        @click="t.onClick && (t.onClick(), dismiss(t.id))"
      >
        <img v-if="t.avatar" class="toast-av" :src="proxyImg(t.avatar)" alt="" />
        <div v-else class="toast-av ph"><AtSign v-if="t.icon === 'mention'" :size="16" /><MessageSquare v-else :size="16" /></div>
        <div style="min-width:0; flex:1">
          <div class="toast-title">{{ t.title }}</div>
          <div v-if="t.body" class="toast-body">{{ t.body }}</div>
        </div>
        <button class="toast-x" @click.stop="dismiss(t.id)"><X :size="14" /></button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { AtSign, MessageSquare, X } from 'lucide-vue-next'
const { toasts, dismiss } = useToast()
</script>
