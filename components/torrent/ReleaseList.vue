<template>
  <div class="card" style="padding:0">
    <div v-if="!groups.length" class="empty">{{ emptyLabel }}</div>
    <template v-for="g in groups" :key="g.key">
      <!-- entrée simple (1 release ou regroupement désactivé) -->
      <NuxtLink v-if="g.count === 1" :to="`/torrent/${g.rep.slug}`" class="trow">
        <img v-if="g.rep.poster_url || g.rep.classic_cover_url" class="poster" :src="g.rep.poster_url || g.rep.classic_cover_url" loading="lazy" alt="" />
        <span v-else class="poster ph"><component :is="catIcon(g.rep)" :size="20" /></span>
        <div style="min-width:0">
          <div class="tname">{{ g.rep.name }}</div>
          <div class="tmeta">
            <span class="badge b-cat">{{ g.rep.sub_cat_name || g.rep.parent_cat_name || g.rep.cat_name }}</span>
            <span v-if="g.rep.is_freeleech" class="badge b-fl">FL</span>
            <span v-if="resTag(g.rep.tags)" class="badge b-res">{{ resTag(g.rep.tags) }}</span>
            <span v-for="tag in (g.rep.tags || []).filter((x) => x !== resTag(g.rep.tags)).slice(0, 4)" :key="tag" class="badge">{{ tag }}</span>
            <PluginSlot name="torrent.row.badges" :ctx="g.rep" stop />
          </div>
          <div class="tsub">{{ fmtAge(g.rep.created_at) }} · {{ g.rep.uploader || g.rep.uploader_name || 'Anonyme' }}<template v-if="g.rep.year"> · {{ g.rep.year }}</template></div>
        </div>
        <div class="statgrp statcol">
          <span class="stat"><span class="lbl">Seed</span><span class="snum seed">{{ g.rep.seeders }}</span></span>
          <span class="stat"><span class="lbl">Leech</span><span class="snum leech">{{ g.rep.leechers }}</span></span>
          <span class="stat"><span class="lbl">DL</span><span class="snum">{{ fmtInt(g.rep.times_completed) }}</span></span>
        </div>
        <span class="stat statcol"><span class="lbl">Taille</span>{{ fmtSize(g.rep.size_bytes) }}</span>
        <div class="rowactions">
          <PluginSlot name="torrent.row.actions" :ctx="g.rep" stop />
          <a class="iconbtn" :href="torrentDlUrl(g.rep)" title="Télécharger le .torrent" @click.stop="torrentDlClick(g.rep)"><Download :size="15" /></a>
        </div>
      </NuxtLink>

      <!-- œuvre à plusieurs releases : en-tête dépliable -->
      <template v-else>
        <div class="trow grouprow" :class="{ open: expanded.has(g.key) }" @click="toggle(g.key)">
          <img v-if="g.poster" class="poster" :src="g.poster" loading="lazy" alt="" />
          <span v-else class="poster ph"><component :is="catIcon(g.rep)" :size="20" /></span>
          <div style="min-width:0">
            <div class="tname">{{ g.title }}<span v-if="g.year" class="muted" style="font-weight:400"> ({{ g.year }})</span></div>
            <div class="tmeta">
              <span class="badge b-cat">{{ g.rep.parent_cat_name || g.rep.cat_name }}</span>
              <span class="badge b-grp"><Layers :size="10" /> {{ g.count }} releases</span>
              <span v-for="r in g.resolutions" :key="r" class="badge b-res">{{ r }}</span>
              <span v-if="g.hasFl" class="badge b-fl">FL</span>
              <PluginSlot name="torrent.group.badges" :ctx="g" stop />
            </div>
            <div class="tsub">meilleur : {{ g.seedMax }} seed · {{ g.count }} versions · {{ fmtAge(g.newest) }}</div>
          </div>
          <div class="statgrp statcol">
            <span class="stat"><span class="lbl">Seed max</span><span class="snum seed">{{ g.seedMax }}</span></span>
            <span class="stat"><span class="lbl">Versions</span><span class="snum">{{ g.count }}</span></span>
          </div>
          <span class="stat statcol"><span class="lbl">Tailles</span>{{ g.sizeRange }}</span>
          <div class="rowactions"><ChevronDown class="chev" :class="{ open: expanded.has(g.key) }" :size="18" /></div>
        </div>

        <!-- sous-lignes : les releases individuelles -->
        <template v-if="expanded.has(g.key)">
          <NuxtLink v-for="t in g.releases" :key="t.id" :to="`/torrent/${t.slug}`" class="trow subrow">
            <span class="subtick" />
            <div style="min-width:0">
              <div class="tname">{{ t.name }}</div>
              <div class="tmeta">
                <span v-if="t.is_freeleech" class="badge b-fl">FL</span>
                <span v-if="resTag(t.tags)" class="badge b-res">{{ resTag(t.tags) }}</span>
                <span v-for="tag in (t.tags || []).filter((x) => x !== resTag(t.tags)).slice(0, 5)" :key="tag" class="badge">{{ tag }}</span>
                <PluginSlot name="torrent.row.badges" :ctx="t" stop />
              </div>
              <div class="tsub">{{ fmtAge(t.created_at) }} · {{ t.uploader || t.uploader_name || 'Anonyme' }}</div>
            </div>
            <div class="statgrp statcol">
              <span class="stat"><span class="lbl">Seed</span><span class="snum seed">{{ t.seeders }}</span></span>
              <span class="stat"><span class="lbl">Leech</span><span class="snum leech">{{ t.leechers }}</span></span>
              <span class="stat"><span class="lbl">DL</span><span class="snum">{{ fmtInt(t.times_completed) }}</span></span>
            </div>
            <span class="stat statcol"><span class="lbl">Taille</span>{{ fmtSize(t.size_bytes) }}</span>
            <div class="rowactions">
              <PluginSlot name="torrent.row.actions" :ctx="t" stop />
              <a class="iconbtn" :href="torrentDlUrl(t)" title="Télécharger le .torrent" @click.stop="torrentDlClick(t)"><Download :size="15" /></a>
            </div>
          </NuxtLink>
        </template>
      </template>
    </template>
  </div>
</template>

<script setup>
import { Download, ChevronDown, Layers } from 'lucide-vue-next'
// catIcon vient de composables/useCatIcons (partagé avec l'index et Découvrir)

defineProps({
  groups: { type: Array, default: () => [] },
  emptyLabel: { type: String, default: 'Aucun torrent.' },
})

const expanded = reactive(new Set())
function toggle(key) { expanded.has(key) ? expanded.delete(key) : expanded.add(key) }
</script>
