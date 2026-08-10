<template>
  <div style="padding-top:16px; display:flex; flex-direction:column; gap:14px">
    <h1 style="margin:0 0 -6px; font-size:19px; display:flex; gap:9px; align-items:center"><Puzzle :size="20" /> Plugins</h1>
    <p class="muted" style="margin:0; font-size:13px">
      Étends TR4KUI sans toucher au core : glisse une archive .zip (avec son <code>plugin.json</code>) ci-dessous.
    </p>

    <!-- bannière : mise à jour de l'application disponible -->
    <div v-if="appUpdate" class="card app-upd">
      <RefreshCw :size="16" :class="{ spin: applyingApp }" style="flex:none; color:var(--accent)" />
      <div style="flex:1; min-width:0">
        <b>TR4K UI v{{ appUpdate.latest.version }} disponible</b>
        <span class="mono muted" style="font-size:11px"> (actuel v{{ appUpdate.current }})</span>
        <div v-if="applyingApp" class="muted" style="font-size:12px; margin-top:2px">
          Mise à jour en cours, le serveur redémarre… la page se rechargera automatiquement.
        </div>
        <div v-else-if="!appUpdate.canSelfUpdate" class="muted" style="font-size:12px; margin-top:2px">
          Docker : <code>docker compose pull &amp;&amp; docker compose up -d</code> · git : <code>git pull &amp;&amp; npm ci &amp;&amp; npm run build</code>
        </div>
      </div>
      <button v-if="appUpdate.canSelfUpdate" class="primary small" :disabled="applyingApp" @click="applyApp">
        <span v-if="applyingApp" class="spin" /><RefreshCw v-else :size="14" /> Mettre à jour
      </button>
      <a class="chip on" style="padding:8px 14px" :href="appUpdate.latest.url" target="_blank" rel="noreferrer"><ExternalLink :size="13" /> Release</a>
    </div>

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
    <h2 class="sec-title"><Puzzle :size="16" /> Installés</h2>
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
            <a v-if="updateOf(p.id)" class="badge b-cat" :href="updateOf(p.id).url" target="_blank" rel="noreferrer"
               :title="`Release v${updateOf(p.id).latest} sur GitHub`">v{{ updateOf(p.id).latest }} disponible</a>
          </div>
          <div class="muted" style="font-size:12.5px">{{ p.description }}</div>
        </div>
        <button v-if="updateOf(p.id)" class="ghost small" :disabled="updating === p.id" @click="updatePlugin(p)">
          <span v-if="updating === p.id" class="spin" />
          <RefreshCw v-else :size="14" /> Mettre à jour
        </button>
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

    <!-- marketplace : plugins proposés à l'installation depuis un catalogue curé -->
    <h2 class="sec-title" style="margin-top:10px"><Store :size="16" /> Marketplace</h2>
    <p class="muted" style="margin:-6px 0 0; font-size:12.5px">
      Plugins vérifiés, installés directement depuis leur dernière release GitHub.
    </p>
    <div v-if="marketPending" class="empty"><span class="spin" /></div>
    <div v-else-if="!available.length" class="empty">Tous les plugins du marketplace sont déjà installés.</div>
    <div v-for="m in available" :key="m.id" class="card plug-card">
      <div class="plug-head">
        <span class="plug-icon">
          <component v-if="iconOf(m).component" :is="iconOf(m).component" :size="22" />
          <template v-else>{{ iconOf(m).text || '🧩' }}</template>
        </span>
        <div style="min-width:0; flex:1">
          <div style="display:flex; gap:8px; align-items:baseline; flex-wrap:wrap">
            <b>{{ m.name }}</b>
            <span v-if="m.latestVersion" class="mono muted" style="font-size:11px">v{{ m.latestVersion }}</span>
            <span v-if="m.author" class="muted" style="font-size:11px">par {{ m.author }}</span>
            <a v-if="m.homepage" class="mod-link" :href="m.homepage" target="_blank" rel="noreferrer"><ExternalLink :size="12" /> GitHub</a>
          </div>
          <div class="muted" style="font-size:12.5px">{{ m.description }}</div>
        </div>
        <button v-if="m.installable" class="primary small" :disabled="marketInstalling === m.id" @click="installFromMarket(m)">
          <span v-if="marketInstalling === m.id" class="spin" />
          <Download v-else :size="14" /> Installer
        </button>
        <span v-else class="badge b-bad" title="Aucune release .zip publiée">indisponible</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Puzzle, UploadCloud, ShieldAlert, Settings2, ChevronDown, Trash2, RefreshCw, Store, Download, ExternalLink } from 'lucide-vue-next'
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
const updating = ref('')
const marketInstalling = ref('')

// marketplace : catalogue curé ; on ne montre que les plugins pas encore installés
const { data: marketData, pending: marketPending } = useFetch('/api/plugins/marketplace', { server: false })
const available = computed(() => (marketData.value?.items || []).filter((m) => !m.installed))

async function installFromMarket(m) {
  marketInstalling.value = m.id
  try {
    const r = await $fetch('/api/plugins/marketplace/install', { method: 'POST', body: { id: m.id } })
    toast({ title: `Plugin « ${r.manifest.name} » installé`, body: `v${r.version} — rechargement…` })
    setTimeout(() => location.reload(), 600)
  } catch (e) {
    toast({ title: 'Installation refusée', body: e?.data?.statusMessage || e?.message })
    marketInstalling.value = ''
  }
}

// mises à jour dispo (état partagé avec la sidebar : app + plugins)
const { appUpdate, pluginUpdates, applyingApp, ensure: ensureUpdates, applyApp } = useUpdates()
onMounted(() => ensureUpdates())
const updateOf = (id) => pluginUpdates.value.find((u) => u.id === id && u.updateAvailable)

async function updatePlugin(p) {
  updating.value = p.id
  try {
    const r = await $fetch(`/api/plugins/${p.id}/update`, { method: 'POST' })
    toast({ title: `${p.name} mis à jour`, body: r.upToDate ? 'Déjà à jour' : `v${r.from} → v${r.to} — rechargement…` })
    setTimeout(() => location.reload(), 600)
  } catch (e) {
    toast({ title: 'Mise à jour refusée', body: e?.data?.statusMessage || e?.message })
    updating.value = ''
  }
}

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
.sec-title { margin: 6px 0 -2px; font-size: 14px; display: flex; align-items: center; gap: 8px; }
.app-upd { display: flex; align-items: center; gap: 12px; border-color: var(--accent-dim); background: rgba(55, 217, 154, 0.05); }
.mod-link { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; color: var(--muted); }
.mod-link:hover { color: var(--accent); }
</style>
