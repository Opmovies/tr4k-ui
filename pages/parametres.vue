<template>
  <div style="padding-top:16px">
    <h1 style="margin:0 0 4px; font-size:19px; display:flex; gap:9px; align-items:center"><Settings :size="20" /> Paramètres TR4KUI</h1>
    <p class="muted" style="margin:0 0 16px; font-size:13px">Réglages propres à cette interface — stockés dans ce navigateur, sans effet sur ton compte TR4KER.</p>

    <div class="settings-layout">
      <!-- navigation par onglets (extensible) -->
      <nav class="settings-nav">
        <button v-for="t in TABS" :key="t.id" :class="{ on: tab === t.id }" @click="tab = t.id">
          <component :is="t.icon" :size="16" /> {{ t.label }}
        </button>
      </nav>

      <div class="settings-body">
        <!-- Général -->
        <template v-if="tab === 'general'">
          <div class="card">
            <div class="set-title"><Palette :size="15" /> Apparence</div>
            <div class="set-row">
              <div><div class="set-name">Thème</div><div class="set-desc">Interface sombre ou claire</div></div>
              <div class="seg">
                <button :class="{ on: theme === 'dark' }" @click="theme = 'dark'"><Moon :size="13" /> Sombre</button>
                <button :class="{ on: theme === 'light' }" @click="theme = 'light'"><Sun :size="13" /> Clair</button>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="set-title"><Layers :size="15" /> Affichage des torrents</div>
            <div class="set-row">
              <div><div class="set-name">Regrouper par œuvre</div><div class="set-desc">Réunir les différentes releases d'un même film/série sous une seule entrée dépliable (recherche & Découvrir)</div></div>
              <label class="sw" :class="{ on: groupByWork }" @click="groupByWork = !groupByWork"><span class="track" /></label>
            </div>
            <div class="set-row">
              <div><div class="set-name">Barre latérale repliée</div><div class="set-desc">Démarrer avec la barre latérale réduite aux icônes</div></div>
              <label class="sw" :class="{ on: folded }" @click="folded = !folded"><span class="track" /></label>
            </div>
          </div>

          <div class="card">
            <div class="set-title"><Bell :size="15" /> Chat</div>
            <div class="set-row">
              <div><div class="set-name">Défilement automatique</div><div class="set-desc">Descend au dernier message à chaque nouveau message reçu ; sinon, seulement si tu es déjà en bas</div></div>
              <label class="sw" :class="{ on: chat.autoScroll }" @click="chat.autoScroll = !chat.autoScroll"><span class="track" /></label>
            </div>
            <div class="set-row">
              <div><div class="set-name">Son de notification</div><div class="set-desc">Sonne sur une mention, une réponse à toi ou un MP</div></div>
              <label class="sw" :class="{ on: chat.sound }" @click="chat.sound = !chat.sound"><span class="track" /></label>
            </div>
            <div class="set-row" :style="chat.sound ? '' : 'opacity:.4; pointer-events:none'">
              <div><div class="set-name">Sonner sur tous les messages</div><div class="set-desc">Par défaut, seuls les mentions, réponses et MP font un son</div></div>
              <label class="sw" :class="{ on: chat.soundAllMessages }" @click="chat.soundAllMessages = !chat.soundAllMessages"><span class="track" /></label>
            </div>
            <div class="set-row" :style="chat.sound ? '' : 'opacity:.4; pointer-events:none'">
              <div><div class="set-name">Volume</div><div class="set-desc">{{ Math.round(chat.soundVolume * 100) }} %</div></div>
              <div style="display:flex; gap:8px; align-items:center">
                <input type="range" min="0" max="1" step="0.05" v-model.number="chat.soundVolume" style="width:130px" />
                <button class="ghost small" @click="testSound"><Volume2 :size="14" /> Tester</button>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="set-title"><Puzzle :size="15" /> Extensions</div>
            <div class="set-row">
              <div><div class="set-name">Plugins</div><div class="set-desc">Installer, activer ou configurer des plugins (glisser-déposer un .zip)</div></div>
              <NuxtLink to="/plugins" class="chip" style="padding:8px 14px">Gérer les plugins</NuxtLink>
            </div>
          </div>

          <div class="card">
            <div class="set-title"><RefreshCw :size="15" /> Mises à jour</div>
            <div class="set-row">
              <div>
                <div class="set-name">TR4K UI <span class="mono muted" style="font-size:11px">v{{ upd?.current || '…' }}</span></div>
                <div v-if="updPending" class="set-desc">Vérification…</div>
                <div v-else-if="upd?.updateAvailable" class="set-desc" style="color:var(--accent)">
                  Nouvelle version disponible : v{{ upd.latest.version }}
                </div>
                <div v-else-if="upd?.latest" class="set-desc">À jour (dernière release : v{{ upd.latest.version }})</div>
                <div v-else class="set-desc">Aucune release publiée pour l'instant</div>
              </div>
              <a v-if="upd?.updateAvailable" class="chip on" style="padding:8px 14px" :href="upd.latest.url" target="_blank" rel="noreferrer">
                <ExternalLink :size="13" /> Voir la release
              </a>
            </div>
            <div v-if="upd?.updateAvailable" class="pill-note" style="margin-top:10px">
              Docker : <code>docker compose pull && docker compose up -d</code> ·
              Installation git : <code>git pull && npm ci && npm run build</code> puis redémarrer.
            </div>
          </div>

          <div class="pill-note" style="display:flex; gap:8px; align-items:center">
            <Info :size="14" style="flex:none" />
            Ces préférences sont enregistrées localement (localStorage). Vider les données du site les réinitialisera.
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Settings, SlidersHorizontal, Palette, Moon, Sun, Layers, Bell, Volume2, Info, Puzzle, RefreshCw, ExternalLink } from 'lucide-vue-next'
import { playChatSound } from '~/composables/useChatSound'
useHead({ title: 'Paramètres — TR4KUI' })

// check de mise à jour de l'app (cache 6 h côté serveur — pas de spam GitHub)
const { data: upd, pending: updPending } = useFetch('/api/updates', { server: false })

// onglets — un seul pour l'instant, structure prête pour en ajouter (ex. Notifications, Avancé…)
const TABS = [
  { id: 'general', label: 'Paramètres généraux', icon: SlidersHorizontal },
]
const tab = ref('general')

const { theme, chat } = useSettings()
const groupByWork = useGroupPref()
function testSound() { playChatSound(chat.soundVolume) }

const folded = ref(false)
onMounted(() => { folded.value = localStorage.getItem('tr4kui.folded') === '1' })
watch(folded, (v) => localStorage.setItem('tr4kui.folded', v ? '1' : '0'))
</script>
