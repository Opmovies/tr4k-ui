<template>
  <!-- page de connexion : pas de coque (sidebar/topbar) -->
  <NuxtPage v-if="isLoginRoute" />
  <div v-else class="shell" :class="{ 'nav-open': mobileOpen }">
    <AppSidebar />
    <div class="side-backdrop" @click="closeSidebar" />
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

// tiroir de navigation mobile : se referme à chaque changement de route
const { mobileOpen, close: closeSidebar } = useSidebar()
watch(() => route.fullPath, closeSidebar)

const { data: me } = useFetch('/api/t/me', { server: false })
provide('me', me)
</script>
