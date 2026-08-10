# Créer un plugin TR4K UI

Un plugin étend l'interface **sans toucher au core** : il s'installe en glissant un `.zip`
sur la page `/plugins`, s'active/se désactive d'un clic, et se branche sur des
**ancres** (slots d'UI, filtres, actions — voir [ANCRES.md](ANCRES.md)).

> ⚠️ **Sécurité** : un plugin exécute du code dans le navigateur **et** dans Nitro,
> sans isolation. N'installe que des plugins que tu as écrits ou lus.

## Anatomie d'un plugin

```
mon-plugin/
├── plugin.json     # manifest (obligatoire)
├── client.mjs      # module chargé par le navigateur (obligatoire)
├── server.mjs      # routes serveur /api/px/<id>/… (optionnel)
└── …               # tout autre asset (servi via /api/plugins/<id>/asset/<fichier>)
```

Exemple réel complet : [`plugins-src/seedbox-qbit/`](../../plugins-src/seedbox-qbit/).

### plugin.json

```json
{
  "id": "mon-plugin",
  "name": "Mon plugin",
  "version": "1.0.0",
  "description": "Ce que fait le plugin.",
  "author": "Toi",
  "icon": "Rocket",
  "client": "client.mjs",
  "server": "server.mjs",
  "settings": {
    "fields": [
      { "key": "url", "label": "URL du service", "type": "text", "required": true,
        "placeholder": "http://…", "help": "Visible sous le champ." },
      { "key": "password", "label": "Mot de passe", "type": "password", "secret": true },
      { "key": "mode", "label": "Mode", "type": "select", "default": "auto",
        "options": [{ "value": "auto", "label": "Auto" }, { "value": "manual", "label": "Manuel" }] },
      { "key": "enabled_thing", "label": "Activer le truc", "type": "boolean", "default": false }
    ]
  },
  "slots": ["torrent.row.actions"],
  "permissions": ["server:network"]
}
```

| Champ | Règle |
|---|---|
| `id` | `^[a-z0-9][a-z0-9-]{1,63}$` — doit correspondre au dossier d'installation. |
| `name`, `version`, `client` | Obligatoires. `client`/`server` : fichier `.mjs`/`.js` **à la racine** du plugin. |
| `icon` | Nom d'icône [lucide](https://lucide.dev) (`"HardDriveDownload"`) **ou** un emoji (`"🚀"`). |
| `settings.fields[].type` | `text` · `password` · `number` · `boolean` · `select`. |
| `settings.fields[].secret` | Jamais renvoyé en clair au client : il reçoit la sentinelle `'••••'` ; la renvoyer telle quelle au PUT = « inchangé ». |
| `slots`, `permissions` | **Purement informatifs** (affichage/lisibilité), rien n'est appliqué. |

Les réglages sont stockés **par utilisateur**, chiffrés AES-256-GCM dans
`.data/plugin-data/<id>/u<userId>.settings.enc`.

### client.mjs

Exporte une fonction `setup(api)` par défaut. Elle reçoit l'objet `api` (voir référence
plus bas) et enregistre ce que le plugin apporte : slots, pages, onglets, filtres…

```js
export default async function setup(api) {
  const { h, ref } = api.vue          // TOUJOURS le Vue de l'hôte, jamais le tien
  const { Rocket } = api.ui.icons     // toutes les icônes lucide

  // Un bouton dans chaque ligne de torrent
  api.ui.registerSlot('torrent.row.actions', {
    props: { ctx: Object },           // ctx = le torrent de la ligne
    template: `
      <button class="iconbtn" title="Envoyer" @click="go">🚀</button>
    `,
    setup(props) {
      async function go() {
        try {
          await api.fetch('/add', { method: 'POST', body: { slug: props.ctx.slug } })
          api.ui.toast('Envoyé !', props.ctx.name)
        } catch (e) {
          api.ui.toast('Échec', e?.data?.statusMessage || e.message)
        }
      }
      return { go }
    },
  })

  // Une page dédiée + son entrée dans la sidebar
  api.ui.registerPage({
    path: `/p/${api.id}`,             // OBLIGATOIREMENT préfixé /p/<id>
    title: 'Mon plugin',
    icon: 'Rocket',
    component: { template: `<div class="card">Ma page</div>` },
  })
}
```

**Contraintes du runtime client :**

- **Pas de build, pas de npm.** Les composants sont des objets à `template` string,
  compilés par le `runtimeCompiler` de Vue activé dans l'hôte. Pas de SFC `.vue`,
  pas d'`import` de dépendances externes (le module est chargé tel quel par `import()`).
- **Une seule instance de Vue** : passe toujours par `api.vue` (deux Vue = réactivité
  et provide/inject cassés).
- ⚠️ **Props non typées** : avec `props: ['wide']`, l'attribut HTML `wide` vaut `""`
  (falsy !). Déclare les types (`props: { wide: Boolean }`) et passe `:wide="true"`.
- Le module est rechargé à chaque install/toggle via un cache-buster `?v=<rev>` ;
  l'app fait un `location.reload()` après ces opérations.

### server.mjs (optionnel)

Exporte un objet `routes` dont les clés sont `"<MÉTHODE> /chemin"` (ou `"* /chemin"`
pour toutes les méthodes). Chaque handler reçoit `(event, ctx)` et son retour est
sérialisé en JSON. Les routes sont servies sous **`/api/px/<id>/<chemin>`** et exigent
un utilisateur authentifié.

```js
export const routes = {
  // GET /api/px/mon-plugin/status
  'GET /status': async (event, ctx) => {
    const { url, password } = ctx.settings          // réglages de L'UTILISATEUR COURANT
    if (!url) throw ctx.h3.createError({ statusCode: 400, statusMessage: 'Non configuré' })
    const r = await ctx.lib.fetch(`${url}/api/version`, { signal: AbortSignal.timeout(5000) })
    return { ok: r.ok, version: await r.text() }
  },

  // POST /api/px/mon-plugin/add  {slug}
  'POST /add': async (event, ctx) => {
    const res = await ctx.lib.tr4kDownload(ctx.body.slug, ctx.auth) // télécharge le .torrent
    const buf = Buffer.from(await res.arrayBuffer())
    // … l'envoyer où tu veux
    return { ok: true }
  },
}
```

Le contexte `ctx` :

| Clé | Contenu |
|---|---|
| `auth` | `{ mode, token, hash, user }` de l'utilisateur courant (à passer à `lib.tr4k*`). |
| `userKey` | Identifiant stable de l'utilisateur (`u<id>` ou `cfg`) — pour des états par user. |
| `settings` | Réglages déchiffrés de l'utilisateur courant (avec les valeurs `secret` en clair). |
| `saveSettings(v)` | Réécrit les réglages de l'utilisateur. |
| `query`, `body` | Query string parsée ; body parsé (sauf GET/HEAD). |
| `lib.tr4kGet(path, query, auth)` | GET proxifié vers l'API TR4KER (cache + quota partagés avec le core). |
| `lib.tr4kMutate(method, path, auth, body?)` | Mutation cadencée vers TR4KER. |
| `lib.tr4kDownload(slug, auth)` | Récupère un `.torrent` (Response). |
| `lib.fetch` | `fetch` global Node — pour parler à des services externes. |
| `h3.createError`, `h3.setHeader` | Utilitaires H3 (une erreur `createError` est relayée telle quelle au client). |
| `dataDir` | Dossier persistant du plugin (`.data/plugin-data/<id>/`), créé pour toi. |
| `log(…)` | `console.log` préfixé `[plugin:<id>]`. |

**Contraintes serveur :** pas de `node_modules` (tout passe par `ctx`), les imports
`node:*` natifs fonctionnent. Le module est ré-importé à chaque changement de `rev`
(install/toggle). Il s'exécute **sans sandbox** dans Nitro.

## Référence de l'objet `api` (client)

| Membre | Rôle |
|---|---|
| `api.id`, `api.manifest` | Identité du plugin. |
| `api.vue` | Le module Vue de l'hôte (`h`, `ref`, `computed`, `watch`…). |
| `api.ui.icons` | Map des icônes lucide (`api.ui.icons.Rocket`). |
| `api.ui.registerSlot(name, component, order = 10)` | Monte un composant dans une ancre d'UI. `component` reçoit la prop `ctx`. |
| `api.ui.registerNav({ to, label, icon?, order? })` | Entrée dans la sidebar. |
| `api.ui.registerPage({ path, component, title?, icon?, nav?, order? })` | Route + page ; `path` doit commencer par `/p/<id>`. `nav: false` pour ne pas l'ajouter à la sidebar. |
| `api.ui.registerTab({ id, label, icon?, component, visible? })` | Onglet de la fiche torrent ; `visible(torrent)` pour le conditionner. Le composant reçoit `:ctx="torrent"`. |
| `api.ui.toast(title, body?)` | Notification toast. |
| `api.hooks.addAction(name, fn, priority = 10)` / `doAction(name, payload)` | Actions façon WordPress (voir ANCRES.md). |
| `api.filters.addFilter(name, fn, priority = 10)` / `applyFilters(name, value, ctx?)` | Filtres de données (voir ANCRES.md). |
| `api.settings.get()` / `api.settings.set(values)` | Réglages de l'utilisateur courant (champs `secret` masqués par la sentinelle). |
| `api.fetch(path, opts?)` | `$fetch` vers `/api/px/<id><path>` (tes routes server.mjs). |
| `api.asset(file)` | URL d'un fichier du plugin (`/api/plugins/<id>/asset/<file>`). |

## Empaqueter, installer, itérer

```bash
# Depuis tr4k-ui/ : crée ../plugins-src/mon-plugin-1.0.0.zip
npm run plugin:pack -- ../plugins-src/mon-plugin
```

1. Ouvre `/plugins`, glisse le zip → installation + activation + rechargement.
2. Mise à jour = réinstaller un zip avec le même `id` (remplacement complet du dossier,
   les réglages utilisateurs sont conservés).
3. Le zip peut avoir `plugin.json` à sa racine **ou** sous un unique dossier englobant.
   Limites : 5 Mo compressé, 30 Mo extrait, 300 fichiers.
4. En dev rapide : les fichiers installés vivent dans `.data/plugins/<id>/` — tu peux
   les éditer sur place, puis désactiver/réactiver le plugin (ça incrémente `rev`,
   donc casse le cache des modules) au lieu de repasser par un zip.

### Bouton « Tester la connexion » (pattern recommandé)

Chaque plugin dispose d'une ancre `plugin.settings.<id>` rendue **sous son formulaire
de réglages** sur `/plugins`. Y brancher un bouton qui appelle une route `GET /test`
du server.mjs (toujours répondre 200 `{ok, error?}` pour un affichage inline propre).
⚠️ Le test porte sur les réglages **enregistrés**, pas le brouillon du formulaire.

## Administration

- Par défaut, tout utilisateur connecté peut gérer les plugins (instance perso).
- Instance partagée : `NUXT_PLUGIN_ADMINS=pseudo1,pseudo2` restreint install/toggle/
  suppression aux pseudos listés.
- Emplacements : plugins dans `.data/plugins/` (`NUXT_PLUGINS_DIR`), données dans
  `.data/plugin-data/` (`NUXT_PLUGIN_DATA_DIR`). L'état activé/désactivé + le compteur
  `rev` vivent dans `.data/plugins/state.json`.

## Check-list des pièges

- [ ] `id` du manifest = nom du dossier/zip, en kebab-case.
- [ ] Composants : `template` string + `api.vue`, **jamais** d'import de Vue.
- [ ] Props booléennes typées (`props: { x: Boolean }`) et passées avec `:x="true"`.
- [ ] `registerPage` : chemin préfixé `/p/<id>`.
- [ ] Champs `secret` : ignorer la sentinelle `'••••'` (déjà géré si tu passes par `api.settings`).
- [ ] server.mjs : timeouts sur les appels externes (`AbortSignal.timeout(…)`),
      erreurs via `ctx.h3.createError` pour des messages propres côté UI.
- [ ] Ne pas marteler l'API TR4KER : `lib.tr4kGet` partage le cache/quota du core,
      mais chaque appel non caché consomme le budget de l'utilisateur (20 req/min).
