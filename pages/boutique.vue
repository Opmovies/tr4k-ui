<template>
  <div style="display:flex; flex-direction:column; gap:14px; padding-top:16px">
    <div style="display:flex; align-items:center; gap:12px">
      <h1 style="margin:0; font-size:19px; display:flex; gap:9px; align-items:center"><Store :size="20" /> Boutique</h1>
      <span style="flex:1" />
      <div class="kpi" style="display:flex; gap:10px; align-items:center; padding:9px 16px">
        <Coins :size="18" style="color:var(--accent)" />
        <div><span class="lbl">{{ me?.token_currency_name || 'Crédit' }}s</span><div class="val" style="font-size:18px">{{ fmtInt(me?.money) }}</div></div>
      </div>
    </div>

    <div class="pill-note" style="display:flex; gap:8px; align-items:center">
      <ShieldCheck :size="14" style="flex:none; color:var(--accent)" />
      Consultation uniquement : l'achat n'est volontairement pas câblé dans cette interface (aucun crédit ne peut être dépensé ici).
      Pour acheter, passe par la boutique officielle.
    </div>

    <div v-if="error" class="errbox">{{ error?.data?.statusMessage || error?.message }}</div>

    <div class="shopgrid">
      <div v-for="it in items" :key="it.id" class="card shopitem">
        <div style="display:flex; gap:9px; align-items:center; font-weight:700"><Upload :size="16" style="color:var(--accent)" /> {{ it.name }}</div>
        <div class="muted" style="font-size:12px; flex:1">{{ it.description }}</div>
        <div style="display:flex; align-items:center">
          <span class="price"><Coins :size="15" /> {{ fmtInt(it.price) }}</span>
          <span style="flex:1" />
          <PluginSlot name="shop.item.actions" :ctx="it" />
          <a class="chip" :href="`https://tr4ker.net/communaute/boutique`" target="_blank" rel="noreferrer" :title="`Acheter sur TR4KER (${fmtInt(it.price)} crédits)`">
            Sur TR4KER <ExternalLink :size="11" />
          </a>
        </div>
        <div class="muted mono" style="font-size:10px" v-if="it.bonus_bytes">= {{ fmtSize(it.bonus_bytes) }} d'upload · {{ (it.price / (it.bonus_bytes / 1024 ** 3)).toFixed(1) }} crédit/Go</div>
      </div>
    </div>

    <div class="card" v-if="hist.length">
      <div class="muted" style="font-family:var(--mono); font-size:11px; text-transform:uppercase; letter-spacing:.8px; margin-bottom:10px; display:flex; gap:8px; align-items:center">
        <History :size="13" /> Historique des crédits ({{ totalEarned }} gagnés · {{ totalSpent }} dépensés)
      </div>
      <div class="tablewrap" style="border:none">
        <table>
          <thead><tr><th>Jour</th><th class="num">Gagnés</th><th class="num">Dépensés</th><th class="num">Net</th><th class="num">Mouvements</th><th class="grow"></th></tr></thead>
          <tbody>
            <tr v-for="d in hist" :key="d.day">
              <td class="mono" style="font-size:12px">{{ d.day }}</td>
              <td class="num" style="color:var(--seed)">+{{ d.earned }}</td>
              <td class="num" :style="d.spent ? 'color:var(--danger)' : ''">{{ d.spent ? '−' + d.spent : '—' }}</td>
              <td class="num">{{ d.net }}</td>
              <td class="num muted">{{ d.movements }}</td>
              <td class="grow"><div :style="`height:6px; border-radius:3px; background:var(--accent-dim); width:${Math.min(100, (d.earned / maxEarned) * 100)}%`" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Store, Coins, Upload, ExternalLink, History, ShieldCheck } from 'lucide-vue-next'
useHead({ title: 'Boutique — TR4KER UI' })
const me = inject('me', ref(null))
// cache client : le catalogue bouge rarement, l'historique un peu plus
const { data: shop, error } = useCachedFetch('/api/t/shop', { ttl: 10 * 60_000 })
const { data: histData } = useCachedFetch('/api/t/shop/history', { ttl: 2 * 60_000 })
const items = computed(() => shop.value?.items || [])
const hist = computed(() => histData.value?.days || [])
const maxEarned = computed(() => Math.max(1, ...hist.value.map((d) => d.earned)))
const totalEarned = computed(() => hist.value.reduce((s, d) => s + d.earned, 0))
const totalSpent = computed(() => hist.value.reduce((s, d) => s + d.spent, 0))
</script>
