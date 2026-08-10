/**
 * Mise à jour de l'application en un clic.
 * L'app tourne dans un conteneur : elle ne peut pas se remplacer elle-même. On délègue
 * à watchtower via son API HTTP (profil `autoupdate` du docker-compose) : watchtower tire
 * la nouvelle image du tag configuré et recrée UNIQUEMENT le conteneur tr4k-ui (scope).
 *
 * Sécurité : réservé aux admins de l'instance ; le jeton watchtower est un secret partagé ;
 * watchtower ne peut mettre à jour que l'image déjà configurée (pas d'image arbitraire).
 */
export default defineEventHandler(async (event) => {
  requirePluginAdmin(event) // « admins de cette instance » (NUXT_PLUGIN_ADMINS)
  const token = process.env.NUXT_WATCHTOWER_TOKEN
  if (!token)
    throw createError({ statusCode: 501, statusMessage: 'Mise à jour en un clic non configurée (service watchtower absent). Utilisez « docker compose pull && docker compose up -d ».' })

  const base = (process.env.NUXT_WATCHTOWER_URL || 'http://watchtower:8080').replace(/\/$/, '')
  // Déclenche la mise à jour. watchtower va recréer ce conteneur : la requête sera
  // probablement coupée avant sa fin — on se contente de garantir l'envoi du déclencheur.
  const trigger = fetch(`${base}/v1/update`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
  await Promise.race([trigger, new Promise((r) => setTimeout(r, 1500))])
  return { ok: true, triggered: true }
})
