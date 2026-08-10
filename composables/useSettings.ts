// Préférences locales (thème + réglages du chat), persistées en localStorage.
// Partagées entre pages via un état module unique.
export type ChatSettings = {
  sound: boolean
  soundVolume: number
  soundAllMessages: boolean // false (défaut) = son seulement sur mention / réponse / MP
  desktop: boolean
  autoScroll: boolean // true (défaut) = suit chaque nouveau message ; false = seulement si déjà en bas
}

const THEME_KEY = 'tr4kui.theme'
const CHAT_KEY = 'tr4kui.chat'

const theme = ref<'dark' | 'light'>('dark')
const chat = reactive<ChatSettings>({ sound: true, soundVolume: 0.4, soundAllMessages: false, desktop: false, autoScroll: true })
let loaded = false

function apply() {
  if (import.meta.client) document.documentElement.dataset.theme = theme.value
}

export function useSettings() {
  if (import.meta.client && !loaded) {
    loaded = true
    theme.value = (localStorage.getItem(THEME_KEY) as any) || 'dark'
    try { Object.assign(chat, JSON.parse(localStorage.getItem(CHAT_KEY) || '{}')) } catch {}
    apply()
    watch(theme, (v) => { localStorage.setItem(THEME_KEY, v); apply() })
    watch(chat, (v) => localStorage.setItem(CHAT_KEY, JSON.stringify(v)), { deep: true })
  }
  return {
    theme,
    chat,
    toggleTheme: () => { theme.value = theme.value === 'dark' ? 'light' : 'dark' },
  }
}
