import pkg from './package.json'

export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: false },
  // Composants rangés par domaine (layout/, chat/, torrent/…) mais noms PLATS :
  // components/chat/ChatComposer.vue reste <ChatComposer>, pas <ChatChatComposer>.
  components: [{ path: '~/components', pathPrefix: false }],
  css: [
    '@fontsource-variable/inter',
    '@fontsource-variable/jetbrains-mono',
    '~/assets/css/main.css',
  ],
  app: {
    head: {
      title: 'TR4K UI',
      htmlAttrs: { lang: 'fr' },
      // viewport-fit=cover : active env(safe-area-inset-*) sur iOS (FAB/dock du chat) ;
      // interactive-widget=resizes-content : le clavier Android redimensionne le layout
      // (le chat reste visible au-dessus du clavier, complété par visualViewport côté client)
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content' }],
    },
  },
  nitro: {
    experimental: { websocket: true }, // relay du chat TR4KER (server/routes/ws.ts)
  },
  // Compilateur de templates au runtime : les composants des plugins (client.mjs) sont
  // des objets à `template` string, sans étape de build.
  vue: { runtimeCompiler: true },
  runtimeConfig: {
    // surchargées par NUXT_TR4KER_BASE / NUXT_TR4KER_API_KEY,
    // sinon la clé est lue dans ../tr4ker.config.json (voir server/utils/tr4ker.ts)
    tr4kerBase: 'https://tr4ker.net',
    tr4kerApiKey: '',
    public: {
      appVersion: pkg.version, // affichée dans Paramètres, comparée aux releases GitHub
      appRepo: 'Opmovies/tr4k-ui', // surchargeable par NUXT_PUBLIC_APP_REPO (fork)
    },
  },
})
