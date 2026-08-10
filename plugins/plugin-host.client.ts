/**
 * Loader des plugins : s'exécute AVANT la navigation initiale (les router.addRoute des
 * plugins arrivent donc à temps pour les deep-links /p/*). Chaque plugin est chargé via
 * import() dynamique depuis /api/plugins/<id>/asset/<client> et isolé dans un try/catch :
 * un plugin cassé ne brique jamais l'app.
 */
export default defineNuxtPlugin(async () => {
  const router = useRouter()
  const { push: toast } = useToast()
  const { loadedPlugins } = usePluginHost()

  // Pas connecté → pas de plugins (après login, login.vue force un rechargement complet).
  // getSession = appel partagé avec le middleware et la sidebar (une seule requête au boot).
  const session = await getSession()
  if (!session?.authed) return

  let payload: any = null
  try { payload = await $fetch('/api/plugins/manifest') } catch { return }
  const rev = payload?.rev ?? 0

  await Promise.all((payload?.plugins || []).map(async (p: any) => {
    const url = `/api/plugins/${p.id}/asset/${p.client}?v=${rev}`
    try {
      const mod = await import(/* @vite-ignore */ url)
      if (typeof mod.default !== 'function') throw new Error(`${p.client} doit exporter default function setup(api)`)
      await mod.default(createPluginApi(p.id, p, { router, toast }))
      loadedPlugins.value = [...loadedPlugins.value, { id: p.id, name: p.name }]
    } catch (e: any) {
      console.error(`[plugin ${p.id}] échec de chargement`, e)
      loadedPlugins.value = [...loadedPlugins.value, { id: p.id, name: p.name, error: String(e?.message || e) }]
      toast({ title: `Plugin « ${p.name} » en erreur`, body: String(e?.message || e) })
    }
  }))
})
