<template>
  <!-- vue liste : imite les .trow de ReleaseList -->
  <div v-if="view === 'list'" class="card" style="padding:0" aria-busy="true">
    <div v-for="i in count" :key="i" class="trow skelrow">
      <span class="skel poster" />
      <div style="min-width:0">
        <span class="skel skel-line" :style="{ width: W[i % W.length] }" />
        <div style="display:flex; gap:5px; margin-top:8px">
          <span class="skel skel-badge" />
          <span class="skel skel-badge" style="width:48px" />
          <span class="skel skel-badge" style="width:34px" />
        </div>
        <span class="skel skel-line sub" :style="{ width: SUB[i % SUB.length] }" />
      </div>
      <div class="statgrp statcol">
        <span v-for="j in 3" :key="j" class="skel skel-stat" />
      </div>
      <span class="skel skel-stat statcol" style="justify-self:end" />
      <div class="rowactions"><span class="skel skel-btn" /></div>
    </div>
  </div>

  <!-- vue cartes : imite les .tcard -->
  <div v-else class="cardgrid" aria-busy="true">
    <div v-for="i in count" :key="i" class="tcard skelrow">
      <div class="pwrap skel" style="border-radius:0" />
      <div class="body">
        <span class="skel skel-line" :style="{ width: W[i % W.length] }" />
        <span class="skel skel-line sub" style="width:55%; margin-top:auto" />
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  view: { type: String, default: 'list' },
  count: { type: Number, default: 10 },
})
// largeurs variées mais déterministes (pas de Math.random → rendu stable)
const W = ['62%', '45%', '71%', '38%', '55%', '66%', '42%', '58%']
const SUB = ['30%', '22%', '35%', '26%']
</script>
