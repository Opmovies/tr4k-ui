<template>
  <!-- `stop` : dans une ligne/carte qui est un NuxtLink, empêche les clics des boutons
       de plugin de déclencher la navigation vers la fiche. -->
  <span v-if="stop && entries.length" style="display:contents" @click.stop.prevent>
    <component v-for="(e, i) in entries" :key="e.pluginId + ':' + i" :is="e.component" :ctx="ctx" />
  </span>
  <template v-else>
    <component v-for="(e, i) in entries" :key="e.pluginId + ':' + i" :is="e.component" :ctx="ctx" />
  </template>
</template>

<script setup>
const props = defineProps({
  name: { type: String, required: true },
  ctx: { type: null, default: null },
  stop: { type: Boolean, default: false },
})
const { slots } = usePluginHost()
const entries = computed(() => slots.get(props.name) || [])
</script>
