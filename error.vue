<template>
  <div class="err-wrap">
    <div class="err-card card">
      <div class="logo err-logo"><span class="dot" /> TR4K<b>UI</b></div>

      <div class="err-code mono">{{ error.statusCode || 500 }}</div>
      <h1 class="err-title">{{ title }}</h1>
      <p class="err-msg muted">{{ message }}</p>

      <div v-if="detail" class="errbox err-detail mono">{{ detail }}</div>

      <div class="err-actions">
        <button class="primary" @click="goHome">Retour à l'accueil</button>
        <button v-if="!is404" class="ghost" @click="retry">Réessayer</button>
        <button v-else class="ghost" @click="goBack">Page précédente</button>
      </div>

      <p class="err-hint muted mono">
        {{ route.fullPath }}
      </p>
    </div>
  </div>
</template>

<script setup>
// Page d'erreur globale (404, 500…) : même coque visuelle que /login, sans sidebar.
const props = defineProps({ error: { type: Object, required: true } })
const route = useRoute()

const is404 = computed(() => props.error.statusCode === 404)

const CATALOG = {
  401: ['Session expirée', 'Ta session TR4KER n\'est plus valide. Reconnecte-toi pour continuer.'],
  403: ['Accès refusé', 'Tu n\'as pas les droits nécessaires pour consulter cette page.'],
  404: ['Page introuvable', 'Cette page n\'existe pas (ou plus). Le lien est peut-être périmé, ou le torrent a été supprimé.'],
  408: ['Délai dépassé', 'TR4KER met trop de temps à répondre. Réessaie dans un instant.'],
  429: ['Trop de requêtes', 'Le tracker limite le débit. Patiente quelques secondes avant de réessayer.'],
  500: ['Erreur interne', 'Quelque chose s\'est mal passé côté serveur. Réessaie, et si ça persiste consulte les logs.'],
  502: ['Tracker inaccessible', 'Impossible de joindre TR4KER pour le moment. Le site est peut-être en maintenance.'],
  503: ['Service indisponible', 'Le service est temporairement indisponible. Réessaie dans quelques instants.'],
}
const title = computed(() => (CATALOG[props.error.statusCode] || CATALOG[500])[0])
const message = computed(() => (CATALOG[props.error.statusCode] || CATALOG[500])[1])

// le message technique n'est montré que s'il apporte autre chose que le titre générique
const detail = computed(() => {
  const m = props.error.statusMessage || props.error.message || ''
  return m && !/^(Page not found|Internal Server Error)/i.test(m) ? m : ''
})

useHead({ title: computed(() => `${props.error.statusCode || 500} — TR4KUI`) })

function goHome() { clearError({ redirect: '/' }) }
function goBack() { clearError(); history.back() }
function retry() { window.location.reload() }
</script>

<style scoped>
.err-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
.err-card { width: 100%; max-width: 440px; text-align: center; padding: 34px 30px 26px; }
.err-logo { font-size: 17px; justify-content: center; }
.err-code {
  font-size: 88px; font-weight: 800; line-height: 1; letter-spacing: 2px;
  margin-top: 18px; color: var(--accent);
  text-shadow: 0 0 34px var(--glow1), 0 0 90px var(--glow2);
}
.err-title { font-size: 19px; margin: 10px 0 0; }
.err-msg { font-size: 13px; margin: 8px 0 0; line-height: 1.55; }
.err-detail { margin-top: 14px; font-size: 11.5px; text-align: left; overflow-wrap: anywhere; }
.err-actions { display: flex; gap: 8px; justify-content: center; margin-top: 20px; flex-wrap: wrap; }
.err-actions button { padding: 9px 18px; }
.err-hint { font-size: 10.5px; margin: 18px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: .6; }
</style>
