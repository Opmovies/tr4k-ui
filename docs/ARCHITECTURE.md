# Architecture de TR4K UI

Surcouche locale de l'UI de tr4ker.net : SPA Nuxt 3 (`ssr: false`) + serveur Nitro qui
sert de **proxy prudent** vers l'API du tracker. Règle d'or : **le navigateur ne parle
JAMAIS à tr4ker.net** (sauf posters TMDB) — tout passe par le serveur, qui cache,
cadence et filtre.

```
Navigateur ──/api/t/*──▶ Nitro (allowlist + cache + quota) ──▶ https://tr4ker.net/api/*
    │                        │
    ├──/ws (WebSocket)──────▶ relay authentifié ─────────────▶ wss://tr4ker.net/api/ws
    ├──/api/px/<id>/*───────▶ routes des plugins (server.mjs)
    └──images TMDB──────────────────────────────────────────▶ image.tmdb.org (direct)
```

## Arborescence

```
tr4k-ui/
├── app.vue                       # coque : sidebar + topbar + dock + provide('me')
├── nuxt.config.ts
├── assets/css/main.css           # thème (variables --*), 2 thèmes via [data-theme]
│
├── pages/                        # une page = une route
│   ├── index.vue                 # recherche (template seul — logique dans useTorrentSearch)
│   ├── torrent/[slug].vue        # fiche (onglets desc/cast/tech/nfo/fichiers/commentaires)
│   ├── decouvrir.vue             # exclusivités + derniers ajouts
│   ├── stats.vue                 # KPI + courbe + « Mes torrents »
│   ├── mes-uploads.vue           # uploads avec statuts de modération
│   ├── profil.vue                # succès/uploads/favoris/notifs (onglets paresseux)
│   ├── boutique.vue              # lecture seule volontaire
│   ├── chat.vue                  # simple wrapper de <ChatView primary>
│   ├── plugins.vue               # install/toggle/réglages des plugins
│   ├── parametres.vue            # réglages propres à l'UI
│   └── login.vue                 # connexion TR4KER (+ 2FA), hors coque
│
├── components/                   # rangés par domaine, noms PLATS (pathPrefix: false)
│   ├── layout/                   # AppSidebar, AppTopbar, ChatDock (drag/resize)
│   ├── chat/                     # ChatView (état+WS), ChatConversationList,
│   │                             #   ChatMessage, ChatComposer, EmojiGifPicker
│   ├── torrent/                  # ReleaseList (groupes dépliables), TorrentSkeleton
│   ├── plugin/                   # PluginSlot (rendu des ancres), PluginSettingsForm
│   └── ui/                       # NotificationBell, ToastHost, ImageLightbox
│
├── composables/                  # auto-importés partout
│   ├── useSession.ts             # session auth mémorisée (1 appel partagé)
│   ├── useCachedFetch.ts         # cache client TTL + dédup (cachedFetch / useCachedFetch)
│   ├── useTorrentSearch.ts       # TOUTE la logique de la recherche (filtres ⇆ URL, debounce)
│   ├── usePluginHost.ts          # registre des ancres + fabrique de l'api plugin
│   ├── useReleaseGroups.ts       # regroupement « par œuvre » (workKey/buildGroups)
│   ├── useCatIcons.ts            # icône lucide par catégorie (partagé ×3)
│   ├── useFmt.ts                 # fmtSize/fmtAge/proxyImg/torrentStatus…
│   ├── useRichText.ts            # bbcode/markdown/html sanitisé + parseTechXml
│   ├── useSettings.ts            # thème + réglages chat (localStorage)
│   └── useChatDock / useToast / useNotifBus / useLightbox / useChatSound
│
├── middleware/auth.global.ts     # redirige vers /login si session invalide
├── plugins/
│   ├── plugin-host.client.ts     # charge les plugins AVANT la navigation initiale
│   └── theme.client.ts           # applique le thème tôt (anti-flash)
│
├── server/
│   ├── utils/
│   │   ├── tr4ker.ts             # client API : cache TTL, cadencement, budget, 429
│   │   ├── session.ts            # cookie chiffré AES-GCM, getAuth(), authHeaders()
│   │   ├── plugins.ts            # registry plugins, validation, anti-traversée
│   │   └── plugin-store.ts       # réglages par user chiffrés
│   ├── api/
│   │   ├── t/[...path].{get,post,patch,delete}.ts   # proxy allowlisté (cf. API-PROXY.md)
│   │   ├── auth/{login,logout,session}.*.ts
│   │   ├── px/[id]/[...path].ts  # dispatcher des routes de plugins
│   │   ├── plugins/*             # install (zip), toggle, settings, assets, manifest
│   │   ├── download/[slug].get.ts, img.get.ts, gifs.get.ts, upload-image.post.ts
│   └── routes/ws.ts              # relay WebSocket du chat
│
├── scripts/pack-plugin.mjs       # npm run plugin:pack -- <dossier>
└── docs/                         # cette documentation
```

Hors du repo applicatif : `plugins-src/` (sources des plugins), `.data/` (plugins
installés + données, non versionné), `Makefile` racine (`make dev`, `make solo`…).

## Les deux niveaux de cache des requêtes

1. **Serveur** ([`server/utils/tr4ker.ts`](../server/utils/tr4ker.ts)) — protège le
   **quota du tracker** (Cloudflare, fenêtre glissante) :
   TTL par route, single-flight, stale-while-error, cadencement 700 ms,
   budget 20 req/min **par utilisateur**, blocage total 90 s après un 429 (jamais de
   retry). Cache cloisonné par utilisateur pour `me/*`, `conversations`, `shop/history`.
2. **Client** ([`composables/useCachedFetch.ts`](../composables/useCachedFetch.ts)) —
   protège l'**UX** : revenir sur une page ne relance pas la requête ni le skeleton
   tant que le TTL court n'est pas écoulé. Dédup des appels simultanés (ex. deux
   instances de ChatView), stale-while-error.

Conventions côté pages :

- Donnée **froide** (catégories, boutique, fiche) → `useCachedFetch(url, { ttl })`.
- Donnée **chaude ou paginée** (recherche, messages, mes torrents de stats) →
  `$fetch` manuel avec état local + garde anti-course si besoin (cf. `useTorrentSearch`).
- Donnée **par onglet** → chargement paresseux au premier clic (cf. `profil.vue`,
  onglet Distribution de la fiche).
- La session (`/api/auth/session`) passe **uniquement** par `getSession()`
  (mémorisée, partagée middleware/sidebar/loader de plugins).

## Authentification

Login obligatoire par défaut : `POST /api/auth/login` relaie identifiants (+ 2FA TOTP)
au tracker, extrait le JWT `TR4KER_session`, le chiffre (AES-256-GCM) dans un cookie
HttpOnly `tr4kui_sess`. `getAuth(event)` → `{ mode: 'jwt'|'apikey', token, hash, user }`.
Le repli clé-API du fichier `tr4ker.config.json` n'est actif que si
`NUXT_ALLOW_CONFIG_KEY=1` (mode perso mono-compte, utilisé par `make solo`).
Tout le cadencement/budget/cache perso est indexé par `auth.hash` → multi-utilisateur sûr.

## Chat temps réel

`server/routes/ws.ts` relaie `wss://tr4ker.net/api/ws` (auth par cookie de session à
l'upgrade, ping/pong absorbé, **allowlist des types sortants**). Côté client,
`ChatView` orchestre : une instance **flottante** (ChatDock, connectée partout sauf
/chat) et une instance **page** (`/chat`, `primary` = gère les deep-links `?conv`/`?dm`)
— jamais deux WebSockets en même temps (prop `active`). Découpage :
`ChatConversationList` (colonne), `ChatMessage` (rendu d'un message),
`ChatComposer` (saisie, mentions, upload d'images).

## Système de plugins

Voir [PLUGINS.md](PLUGINS.md) (créer un plugin) et [ANCRES.md](ANCRES.md)
(points d'extension). En résumé : zip → `.data/plugins/<id>/`, client chargé par
`import()` avant la navigation, routes serveur dispatchées sous `/api/px/<id>/`,
réglages par utilisateur chiffrés.

## Pièges connus

- Après un changement de `nuxt.config.ts`, **redémarrer** le serveur dev (le HMR laisse
  un état cassé).
- `q=` sans `search_in` est ignoré par l'API → `useTorrentSearch` force `title`.
- Les noms affichés des releases sont souvent décorés (« Release.Name (Titre) ») ≠ nom
  réel du torrent ; en liste il n'y a pas d'`info_hash` (matching par taille/nom).
- Les images `/uploads/` de tr4ker.net sont bloquées en hotlink → toujours `proxyImg()`.
