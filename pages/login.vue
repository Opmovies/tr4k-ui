<template>
  <div class="login-wrap">
    <div class="login-card card">
      <div class="logo" style="font-size:20px; justify-content:center; margin-bottom:4px"><span class="dot" /> TR4K<b>UI</b></div>
      <p class="muted" style="text-align:center; font-size:12.5px; margin:0 0 18px">Connecte-toi avec ton compte TR4KER</p>

      <form v-if="!totpToken" @submit.prevent="submit">
        <label class="field"><span class="lbl">Identifiant ou email</span>
          <input v-model="identifier" autocomplete="username" autofocus />
        </label>
        <label class="field" style="margin-top:12px"><span class="lbl">Mot de passe</span>
          <input v-model="password" type="password" autocomplete="current-password" />
        </label>
        <div v-if="error" class="errbox" style="margin-top:12px">{{ error }}</div>
        <button class="primary" style="width:100%; margin-top:16px; padding:10px" :disabled="loading || !identifier || !password">
          <span v-if="loading" class="spin" /> <template v-else>Se connecter</template>
        </button>
      </form>

      <form v-else @submit.prevent="submit">
        <p style="font-size:13px; margin:0 0 12px">Code de vérification à deux facteurs (TOTP)</p>
        <label class="field"><span class="lbl">Code</span>
          <input v-model="code" inputmode="numeric" autocomplete="one-time-code" placeholder="123456" autofocus />
        </label>
        <div v-if="error" class="errbox" style="margin-top:12px">{{ error }}</div>
        <button class="primary" style="width:100%; margin-top:16px; padding:10px" :disabled="loading || !code">
          <span v-if="loading" class="spin" /> <template v-else>Valider</template>
        </button>
        <button type="button" class="ghost" style="width:100%; margin-top:8px" @click="resetTotp">Retour</button>
      </form>

      <p class="muted" style="text-align:center; font-size:11px; margin:16px 0 0">
        Ton mot de passe est transmis uniquement à TR4KER et n'est jamais stocké ici. La session est
        conservée dans un cookie chiffré propre à ce navigateur.
      </p>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: false })
useHead({ title: 'Connexion — TR4KUI' })

const identifier = ref('')
const password = ref('')
const code = ref('')
const totpToken = ref('')
const loading = ref(false)
const error = ref('')

async function submit() {
  loading.value = true
  error.value = ''
  try {
    const body = totpToken.value
      ? { totp_token: totpToken.value, code: code.value.trim() }
      : { identifier: identifier.value.trim(), password: password.value }
    const r = await $fetch('/api/auth/login', { method: 'POST', body })
    if (r.totp_required) { totpToken.value = r.totp_token; loading.value = false; return }
    // rechargement complet (pas navigateTo) : le loader de plugins a déjà tourné non
    // authentifié, seul un vrai reload charge les plugins de la session fraîche
    window.location.href = '/'
  } catch (e) {
    error.value = e?.data?.statusMessage || e?.message || 'Échec de la connexion'
  } finally {
    loading.value = false
  }
}
function resetTotp() { totpToken.value = ''; code.value = ''; error.value = '' }
</script>
