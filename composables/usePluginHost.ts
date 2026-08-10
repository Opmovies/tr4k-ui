import * as VueNS from 'vue'
import { icons as lucideIcons } from 'lucide-vue-next'

/**
 * Registre central du système de plugins (singleton module, convention de l'app).
 * Les plugins s'y branchent via l'objet `api` que leur remet le loader
 * (plugins/plugin-host.client.ts) : slots d'UI, pages, onglets de fiche torrent,
 * actions/filtres façon WordPress.
 */

export type SlotEntry = { pluginId: string; component: any; order: number }
export type PluginNavItem = { to: string; label: string; icon?: any; order: number; pluginId: string }
export type PluginTab = { pluginId: string; id: string; label: string; icon?: any; component: any; visible?: (ctx: any) => boolean }
export type LoadedPlugin = { id: string; name: string; error?: string }

const slots = reactive(new Map<string, SlotEntry[]>())
const navItems = ref<PluginNavItem[]>([])
const detailTabs = ref<PluginTab[]>([])
const loadedPlugins = ref<LoadedPlugin[]>([])
const actions = new Map<string, { fn: Function; priority: number }[]>()
const filters = new Map<string, { fn: Function; priority: number }[]>()

function sortedPush(map: Map<string, any[]>, name: string, item: any, key: 'order' | 'priority') {
  const arr = map.get(name) || []
  arr.push(item)
  arr.sort((a, b) => a[key] - b[key])
  map.set(name, arr)
}

const hooks = {
  addAction(name: string, fn: Function, priority = 10) { sortedPush(actions, name, { fn, priority }, 'priority') },
  doAction(name: string, payload?: any) {
    for (const h of actions.get(name) || []) {
      try { h.fn(payload) } catch (e) { console.error(`[plugin action ${name}]`, e) }
    }
  },
}
const filterApi = {
  addFilter(name: string, fn: Function, priority = 10) { sortedPush(filters, name, { fn, priority }, 'priority') },
  applyFilters(name: string, value: any, ctx?: any) {
    for (const h of filters.get(name) || []) {
      try { value = h.fn(value, ctx) } catch (e) { console.error(`[plugin filter ${name}]`, e) }
    }
    return value
  },
}

export function usePluginHost() {
  return {
    slots, navItems, detailTabs, loadedPlugins,
    slotEntries: (name: string) => slots.get(name) || [],
    hooks, filters: filterApi,
  }
}

/** Résout le champ `icon` d'un manifest/plugin : nom lucide → composant, sinon emoji/texte. */
export function resolvePluginIcon(icon?: string): { component?: any; text?: string } {
  if (!icon) return {}
  const c = (lucideIcons as any)[icon]
  return c ? { component: c } : { text: icon }
}

/** Fabrique l'objet `api` remis au setup() d'un plugin. */
export function createPluginApi(id: string, manifest: any, deps: { router: any; toast: (t: { title: string; body?: string; onClick?: () => void }) => void }) {
  const { markRaw } = VueNS
  return {
    id,
    manifest,
    // Instance Vue de l'HÔTE — les plugins ne doivent JAMAIS embarquer leur propre Vue
    // (deux instances = réactivité et provide/inject cassés). Composants = objets à
    // `template` string, compilés par le runtimeCompiler activé dans nuxt.config.
    vue: VueNS,
    hooks,
    filters: filterApi,
    ui: {
      icons: lucideIcons,
      registerSlot(name: string, component: any, order = 10) {
        sortedPush(slots as any, name, { pluginId: id, component: markRaw(component), order }, 'order')
      },
      registerNav(item: { to: string; label: string; icon?: string; order?: number }) {
        navItems.value = [...navItems.value, { to: item.to, label: item.label, icon: resolvePluginIcon(item.icon).component, order: item.order ?? 50, pluginId: id }]
      },
      registerPage(opts: { path: string; component: any; title?: string; icon?: string; nav?: boolean; order?: number }) {
        if (!opts.path.startsWith(`/p/${id}`)) throw new Error(`registerPage : le chemin doit commencer par /p/${id}`)
        deps.router.addRoute({ path: opts.path, name: `plugin:${id}:${opts.path}`, component: markRaw(opts.component), meta: { pluginId: id, title: opts.title } })
        if (opts.title && opts.nav !== false) this.registerNav({ to: opts.path, label: opts.title, icon: opts.icon, order: opts.order })
      },
      registerTab(opts: { id: string; label: string; icon?: string; component: any; visible?: (t: any) => boolean }) {
        detailTabs.value = [...detailTabs.value, { pluginId: id, id: `${id}:${opts.id}`, label: opts.label, icon: resolvePluginIcon(opts.icon).component, component: markRaw(opts.component), visible: opts.visible }]
      },
      toast(title: string, body?: string) { deps.toast({ title, body }) },
    },
    settings: {
      get: async () => (await $fetch<{ values: Record<string, any> }>(`/api/plugins/${id}/settings`)).values,
      set: (values: Record<string, any>) => $fetch(`/api/plugins/${id}/settings`, { method: 'PUT', body: values }),
    },
    // Appels vers les routes serveur du plugin (/api/px/<id>/...)
    fetch: (path: string, opts: any = {}) => $fetch(`/api/px/${id}${path.startsWith('/') ? path : '/' + path}`, opts),
    asset: (file: string) => `/api/plugins/${id}/asset/${file}`,
  }
}

export type PluginApi = ReturnType<typeof createPluginApi>
