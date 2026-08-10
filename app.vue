<template>
  <!-- page de connexion : pas de coque (sidebar/topbar) -->
  <NuxtPage v-if="isLoginRoute" />
  <div v-else class="shell">
    <AppSidebar />
    <main class="content">
      <AppTopbar />
      <div class="page-wrap">
        <NuxtPage />
      </div>
    </main>

    <ChatDock />
    <ToastHost />
    <ImageLightbox />
    <PluginSlot name="global" />
  </div>
</template>

<script setup>
// Coque de l'app : la sidebar, la topbar et le dock de chat vivent dans components/layout/.
// Seul état global posé ici : `me` (le compte TR4KER), injecté partout via provide('me').
const route = useRoute()
const isLoginRoute = computed(() => route.path === '/login')

const { data: me } = useFetch('/api/t/me', { server: false })
provide('me', me)
</script>
