import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Tests unitaires SANS runtime Nuxt : on teste les fonctions pures (composables,
// utilitaires serveur). Les auto-imports Nuxt (ref, watch…) sont fournis par
// tests/setup.ts.
export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('.', import.meta.url)),
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom', // DOMParser/localStorage pour useRichText & co
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.spec.ts'],
  },
})
