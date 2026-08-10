<template>
  <div style="padding-top:16px; display:flex; flex-direction:column; gap:14px">
    <h1 style="margin:0 0 -6px; font-size:19px; display:flex; gap:9px; align-items:center"><Puzzle :size="20" /> Plugins</h1>
    <p class="muted" style="margin:0; font-size:13px">
      Étends TR4KUI sans toucher au core : glisse une archive .zip (avec son <code>plugin.json</code>) ci-dessous.
    </p>

    <!-- zone d'installation -->
    <div class="dropzone" :class="{ over: dragOver }" @dragover.prevent="dragOver = true" @dragleave="dragOver = false"
         @drop.prevent="onDrop" @click="picker?.click()">
      <UploadCloud :size="26" />
      <div v-if="installing"><span class="spin" /> Installation…</div>
      <div v-else>
        <b>Glisser-déposer un plugin (.zip)</b>
        <div class="muted" style="font-size:12px">ou cliquer pour choisir un fichier</div>
      </div>
      <input ref="picker" type="file" accept=".zip,application/zip" style="display:none" @change="onPick" />
    </div>

    <div class="pill-note" style="display:flex; gap:8px; align-items:center">
      <ShieldAlert :size="14" style="flex:none" />
      Un plugin exécute du code dans l'interface ET sur le serveur, sans isolation. N'installe que des plugins que tu as écrits ou lus.
    </div>

    <!-- liste des plugins installés -->
    <div v-if="pending" class="empty"><span class="spin" /></div>
    <div v-else-if="!plugins.length" class="empty">Aucun plugin installé pour l'instant.</div>
    <div v-for="p in plugins" :key="p.id" class="card plug-card">
      <div class="plug-head">
        <span class="plug-icon">
          <component v-if="iconOf(p).component" :is="iconOf(p).component" :size="22" />
          <template v-else>{{ iconOf(p).text || '🧩' }}</template>
        </span>
        <div style="min-width:0; flex:1">
          <div style="display:flex; gap:8px; align-items:baseline; flex-wrap:wrap">
            <b>{{ p.name }}</b>
            <span class="mono muted" style="font-size:11px">v{{ p.version }}</span>
            <span v-if="p.author" class="muted" style="font-size:11px">par {{ p.author }}</span>
            <span v-if="loadError(p.id)" class="badge b-bad" :title="loadError(p.id)">erreur de chargement</span>
            <span v-else-if="!p.enabled" class="badge">désactivé</span>
          </div>
          <div class="muted" style="font-size:12.5px">{{ p.description }}</div>
        </div>
        <button v-if="p.settings?.fields?.length && p.enabled" class="ghost small" @click="openSettings = openSettings === p.id ? '' : p.id">
          <Settings2 :size="14" /> Réglages
          <ChevronDown :size="13" :style="openSettings === p.id ? 'transform:rotate(180deg)' : ''" />
        </button>
        <label class="sw" :class="{ on: p.enabled }" :title="p.enabled ? 'Désactiver' : 'Activer'" @click="toggle(p)"><span class="track" /></label>
        <button class="iconbtn danger" title="Désinstaller" @click="remove(p)"><Trash2 :size="15" /></button>
      </div>
      <div v-if="loadError(p.id)" class="errbox" style="margin-top:10px; font-size:12px">{{ loadError(p.id) }}</div>
      <div v-if="openSettings === p.id" class="plug-settings">
        <PluginSettingsForm :plugin-id="p.id" :fields="p.settings.fields" />
        <!-- actions fournies par le plugin lui-même (ex. tester la connexion) -->
        <PluginSlot :name="`plugin.settings.${p.id}`" :ctx="p" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { Puzzle, UploadCloud, ShieldAlert, Settings2, ChevronDown, Trash2 } from 'lucide-vue-next'
import { resolvePluginIcon } from '~/composables/usePluginHost'
useHead({ title: 'Plugins — TR4KUI' })

const { push: toast } = useToast()
const { loadedPlugins } = usePluginHost()
const { data, pending, refresh } = useFetch('/api/plugins', { server: false })
const plugins = computed(() => data.value?.plugins || [])

const picker = ref(null)
const dragOver = ref(false)
const installing = ref(false)
const openSettings = ref('')

function iconOf(p) { return resolvePluginIcon(p.icon) }
function loadError(id) { return loadedPlugins.value.find((l) => l.id === id)?.error || '' }

function onDrop(e) {
  dragOver.value = false
  const f = [...(e.dataTransfer?.files || [])].find((x) => /\.zip$/i.test(x.name))
  if (f) install(f)
  else toast({ title: 'Fichier invalide', body: 'Dépose une archive .zip' })
}
function onPick(e) {
  const f = e.target.files?.[0]
  if (f) install(f)
  e.target.value = ''
}

async function install(file) {
  installing.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    const r = await $fetch('/api/plugins/install', { method: 'POST', body: fd })
    toast({ title: `Plugin « ${r.manifest.name} » installé`, body: 'Rechargement…' })
    setTimeout(() => location.reload(), 600) // recharge pour (re)charger les modules client
  } catch (e) {
    toast({ title: 'Installation refusée', body: e?.data?.statusMessage || e?.message })
    installing.value = false
  }
}

async function toggle(p) {
  try {
    const r = await $fetch(`/api/plugins/${p.id}/toggle`, { method: 'POST' })
    toast({ title: `${p.name} ${r.enabled ? 'activé' : 'désactivé'}`, body: 'Rechargement…' })
    setTimeout(() => location.reload(), 600)
  } catch (e) {
    toast({ title: 'Échec', body: e?.data?.statusMessage || e?.message })
    refresh()
  }
}

async function remove(p) {
  if (!confirm(`Désinstaller « ${p.name} » ? Ses réglages seront conservés.`)) return
  try {
    await $fetch(`/api/plugins/${p.id}`, { method: 'DELETE' })
    toast({ title: `${p.name} désinstallé`, body: 'Rechargement…' })
    setTimeout(() => location.reload(), 600)
  } catch (e) {
    toast({ title: 'Échec', body: e?.data?.statusMessage || e?.message })
  }
}
</script>

<style scoped>
.dropzone {
  border: 2px dashed var(--line); border-radius: var(--radius); padding: 26px;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  color: var(--muted); cursor: pointer; text-align: center; transition: border-color .12s, background .12s;
}
.dropzone:hover, .dropzone.over { border-color: var(--accent-dim); background: var(--bg2); color: var(--fg); }
.plug-card { padding: 14px 16px; }
.plug-head { display: flex; gap: 12px; align-items: center; }
.plug-icon {
  width: 40px; height: 40px; flex: none; border-radius: 10px; background: var(--bg2);
  border: 1px solid var(--line); display: flex; align-items: center; justify-content: center; font-size: 20px;
}
.plug-settings { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line); }
.iconbtn.danger:hover { color: var(--bad, #e5484d); border-color: var(--bad, #e5484d); }
</style>
