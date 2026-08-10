<template>
  <div v-if="loading" class="empty"><span class="spin" /></div>
  <form v-else class="plugform" @submit.prevent="save">
    <label v-for="f in fields" :key="f.key" class="field">
      <span class="lbl">{{ f.label }}<template v-if="f.required"> *</template></span>
      <template v-if="f.type === 'boolean'">
        <label class="sw" :class="{ on: values[f.key] }" @click.prevent="values[f.key] = !values[f.key]"><span class="track" /></label>
      </template>
      <select v-else-if="f.type === 'select'" v-model="values[f.key]">
        <option v-for="o in f.options || []" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <input v-else v-model="values[f.key]" :type="f.type === 'password' ? 'password' : f.type === 'number' ? 'number' : 'text'"
             :placeholder="f.placeholder" autocomplete="off" />
      <span v-if="f.help" class="muted" style="font-size:11px">{{ f.help }}</span>
    </label>
    <div style="display:flex; gap:10px; align-items:center; margin-top:4px">
      <button class="primary" :disabled="saving" style="padding:8px 18px">
        <span v-if="saving" class="spin" /><template v-else><Save :size="14" /> Enregistrer</template>
      </button>
      <span v-if="saved" class="muted" style="font-size:12px">Enregistré ✓</span>
    </div>
  </form>
</template>

<script setup>
import { Save } from 'lucide-vue-next'

const props = defineProps({
  pluginId: { type: String, required: true },
  fields: { type: Array, default: () => [] }, // manifest.settings.fields
})
const { push: toast } = useToast()

const values = reactive({})
const loading = ref(true)
const saving = ref(false)
const saved = ref(false)

onMounted(async () => {
  try {
    const r = await $fetch(`/api/plugins/${props.pluginId}/settings`)
    Object.assign(values, r.values || {})
  } catch (e) {
    toast({ title: 'Réglages indisponibles', body: e?.data?.statusMessage || e?.message })
  } finally { loading.value = false }
})

async function save() {
  saving.value = true
  saved.value = false
  try {
    // les champs secret non modifiés portent encore la sentinelle '••••' → le serveur les ignore
    await $fetch(`/api/plugins/${props.pluginId}/settings`, { method: 'PUT', body: { ...values } })
    saved.value = true
    setTimeout(() => (saved.value = false), 2500)
  } catch (e) {
    toast({ title: 'Échec de l’enregistrement', body: e?.data?.statusMessage || e?.message })
  } finally { saving.value = false }
}
</script>

<style scoped>
.plugform { display: flex; flex-direction: column; gap: 12px; max-width: 460px; }
.plugform .field { display: flex; flex-direction: column; gap: 5px; }
</style>
