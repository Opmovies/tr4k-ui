import { ref, watch, computed } from 'vue'

// Équivalent minimal des auto-imports Nuxt pour les modules testés hors runtime Nuxt.
Object.assign(globalThis as any, { ref, watch, computed })

// Clé de session déterministe : évite que server/utils/session.ts n'écrive un
// .session-secret pendant les tests (CI incluse).
process.env.NUXT_SESSION_SECRET ||= 'vitest-only-secret'
