# TR4K UI

Surcouche web moderne pour le tracker **tr4ker.net** : recherche avancée, fiches
riches, statistiques, chat temps réel, notifications, et un **système de plugins**
façon WordPress. Application **Nuxt 3** en SPA doublée d'un **proxy Nitro prudent**
(cache, quotas, allowlist) — le navigateur ne parle jamais directement au tracker.

> ⚠️ Client tiers non officiel. Utilisez-le avec votre propre compte, dans le respect
> des règles du tracker. Aucun secret ni donnée de compte n'est inclus dans ce dépôt.

---

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Démarrage rapide](#démarrage-rapide)
- [Déploiement Docker (production)](#déploiement-docker-production)
- [Authentification : login ou clé API](#authentification--login-ou-clé-api)
- [Mises à jour](#mises-à-jour)
- [Variables d'environnement](#variables-denvironnement)
- [Architecture](#architecture)
- [Plugins](#plugins)
- [Tests](#tests)
- [Sécurité](#sécurité)
- [Documentation](#documentation)
- [Contribuer](#contribuer)
- [Licence](#licence)

---

## Fonctionnalités

- 🔎 **Recherche** avec autocomplétion TMDB, filtres et regroupement par œuvre.
- 🎬 **Fiches torrent** riches : description (BBCode/Markdown/HTML assainis), casting,
  infos techniques, NFO, liste de fichiers, commentaires.
- 💬 **Chat temps réel** (WebSocket) : salons et messages privés, mentions, réactions,
  émojis/GIFs, images.
- 🔔 **Notifications** en direct et **statistiques** (KPI, courbe de ratio, uploads).
- 🧩 **Plugins installables à chaud** : un `.zip` déposé dans l'interface ajoute des
  slots d'UI et/ou des routes serveur — sans rebuild.
- 🌗 **Thème clair/sombre**, pages d'erreur personnalisées, UI 100 % en français.
- 🛡️ **Proxy prudent** : cache à deux niveaux, budget de 20 req/min par utilisateur,
  recul automatique sur HTTP 429, allowlist stricte des endpoints.

## Démarrage rapide

Prérequis : **Node.js 22+**.

```bash
npm install
npm run dev          # http://localhost:3010 — connexion TR4KER requise
```

Par défaut, une **connexion** avec un compte TR4KER est exigée. Le mot de passe n'est
transmis qu'au tracker ; seule la session (JWT) est conservée, **chiffrée** (AES-256-GCM)
dans un cookie `HttpOnly`.

## Déploiement Docker (production)

Image multi-stage (build Nuxt → runtime `node:22-alpine` non-root), **multi-arch
(amd64 + arm64)**, avec `HEALTHCHECK` et volume persistant pour les plugins.

### Sans cloner le dépôt — `docker run`

L'image est publiée publiquement sur GHCR : un seul `docker run` suffit, aucune source requise.

```bash
docker run -d --name tr4k-ui \
  -p 3010:3000 \
  -e NUXT_SESSION_SECRET="$(openssl rand -hex 32)" \
  -v tr4k-data:/app/.data \
  --restart unless-stopped \
  ghcr.io/n-ramos/tr4k-ui:latest
```

> ⚠️ Générez `NUXT_SESSION_SECRET` **une seule fois** et réutilisez la même valeur : en
> régénérer une à chaque recréation du conteneur invaliderait toutes les sessions. Pour une
> instance multi-comptes, ajoutez `-e NUXT_PLUGIN_ADMINS=…` (voir [Sécurité](#sécurité)).

### Avec le dépôt — `docker compose`

```bash
cp .env.example .env
# éditez .env : renseignez au minimum NUXT_SESSION_SECRET (openssl rand -hex 32)

docker compose up -d --build
```

L'application écoute sur le port **3010** de l'hôte (configurable via `PORT`). Le
conteneur expose `3000` en interne et se déclare *healthy* dès que
`/api/auth/session` répond.

### Sur Dokploy (ou PaaS avec Traefik)

Un compose prêt à l'emploi est fourni : [`docker-compose.dokploy.yml`](docker-compose.dokploy.yml).
Créez un service **Compose**, collez le fichier, définissez `NUXT_SESSION_SECRET` dans l'onglet
_Environment_, puis ajoutez votre domaine (_Domains_ → service `tr4k-ui`, port `3000`, HTTPS).
Pas de port publié ni de reverse-proxy à gérer : Dokploy s'en charge, et les mises à jour se font
via son bouton **Redeploy** (ou un webhook d'auto-déploiement).

```bash
docker compose logs -f      # suivre les logs
docker compose ps           # état + santé
docker compose down         # arrêter (le volume tr4k-data est conservé)
```

## Authentification : login ou clé API

Deux modes, **exclusifs** :

- **Mode login (par défaut, recommandé)** — chaque utilisateur se connecte avec son compte
  TR4KER via `/login`. Le JWT de session est chiffré dans un cookie. **Aucune clé API
  n'est nécessaire.** C'est le mode à utiliser pour une instance partagée (plusieurs comptes).
- **Mode clé-config (optionnel, mono-compte)** — pour un usage perso sans login : tout le
  monde utilise une seule clé API. Activé **uniquement** si vous posez
  `NUXT_ALLOW_CONFIG_KEY=1`. C'est **seulement dans ce mode** que `NUXT_TR4KER_API_KEY` est
  utile.

> La seule variable réellement requise en production est **`NUXT_SESSION_SECRET`** (elle
> chiffre les cookies de session) — **pas** la clé API.

## Mises à jour

L'application vérifie les **releases GitHub** (cache 6 h, aucune clé requise) et signale les
nouvelles versions dans **Paramètres → Mises à jour**.

- **Docker (recommandé)** — chaque release publie une image sur GHCR :

  ```bash
  docker compose pull && docker compose up -d
  ```

- **Mise à jour en un clic depuis l'UI** — activez le profil `autoupdate` (watchtower).
  Un bouton **« Mettre à jour maintenant »** apparaît alors dans _Paramètres → Mises à jour_
  (et sur /plugins) : il tire la nouvelle image et recrée le conteneur, puis la page se
  recharge automatiquement. Watchtower vérifie aussi en tâche de fond toutes les 6 h.

  ```bash
  # openssl rand -hex 16 → WATCHTOWER_TOKEN dans votre .env
  docker compose --profile autoupdate up -d
  ```

  > **Sécurité.** Le jeton `WATCHTOWER_TOKEN` est partagé entre l'app et watchtower ; l'API
  > n'est pas exposée sur l'hôte (réseau interne au compose) ; l'action est réservée aux
  > admins de l'instance et ne met à jour que l'image déjà configurée. Watchtower **n'accède
  > pas au socket Docker brut** : il passe par un `docker-socket-proxy` (inclus dans le profil)
  > qui ne lui ouvre que les endpoints conteneurs/images nécessaires, le socket étant monté
  > en lecture seule. Cela limite fortement la surface en cas de compromission.

- **Installation git** : `git pull && npm ci && npm run build`, puis redémarrez.

### Mise à jour des plugins

Un plugin qui déclare `"repository": "owner/repo"` dans son `plugin.json` est vérifié
contre les releases de son dépôt : la page **/plugins** affiche un badge
« vX.Y.Z disponible » et un bouton **Mettre à jour** qui télécharge le zip de la release et
le réinstalle (action réservée aux admins de plugins — voir `NUXT_PLUGIN_ADMINS`).

## Variables d'environnement

| Variable | Rôle | Défaut |
|---|---|---|
| `NUXT_SESSION_SECRET` | **Requis en prod.** Clé de chiffrement des cookies de session (`openssl rand -hex 32`). Sans elle, un secret aléatoire local (`.session-secret`) est généré. | — |
| `NUXT_TR4KER_BASE` | URL de base de l'API du tracker. | `https://tr4ker.net` |
| `NUXT_ALLOW_CONFIG_KEY` | `1` active le mode clé-config (mono-compte, sans login). Laissez à `0` pour exiger un login. | `0` |
| `NUXT_TR4KER_API_KEY` | Clé API — **utilisée seulement si `NUXT_ALLOW_CONFIG_KEY=1`** (mode mono-compte). Inutile en mode login. À défaut, lue dans `../tr4ker.config.json`. | — |
| `NUXT_PLUGIN_ADMINS` | IDs des comptes autorisés à gérer les plugins (ex. `12,34`). **Indispensable en instance multi-comptes** (voir [Sécurité](#sécurité)). | vide |
| `NUXT_IMGBB_KEY` | Clé imgbb pour l'upload d'images du chat/commentaires. | — |
| `PORT` | Port exposé côté hôte (Docker). | `3010` |

## Architecture

SPA Nuxt 3 (`ssr: false`) + serveur Nitro faisant office de proxy. **Règle d'or : le
navigateur ne parle jamais directement à tr4ker.net** (hors posters TMDB).

```
Navigateur ──/api/t/*──▶ Nitro (allowlist + cache + quota) ──▶ https://tr4ker.net/api/*
    │                        │
    ├──/ws (WebSocket)──────▶ relay authentifié ─────────────▶ wss://tr4ker.net/api/ws
    ├──/api/px/<id>/*───────▶ routes des plugins (server.mjs)
    └──images TMDB──────────────────────────────────────────▶ image.tmdb.org (direct)
```

- **Cache à deux niveaux** avec TTL par type d'endpoint, cloisonné par utilisateur pour
  les données personnelles (`me/*`, conversations…) — aucune fuite entre comptes.
- **Cadencement & budget** par utilisateur (700 ms mini entre requêtes, 20 req/min),
  repli « stale » sur erreur, pause de 90 s sur 429.

Détails complets dans [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Plugins

Un plugin est un dossier (`plugin.json` + `client.mjs` + `server.mjs` optionnel) livré
en `.zip`. Il peut greffer des composants dans les **slots d'UI** (ancres) et exposer
des routes serveur sous `/api/px/<id>/*`.

- Créer un plugin : [docs/PLUGINS.md](docs/PLUGINS.md)
- Slots et contextes disponibles : [docs/ANCRES.md](docs/ANCRES.md)
- Packager : `npm run plugin:pack -- <dossier-du-plugin>`

**Marketplace** : la page /plugins propose un catalogue curé de plugins installables en un
clic depuis leur dernière release GitHub (section « Marketplace »). Pour y figurer, un plugin
doit être un dépôt public publiant des releases avec l'archive `<id>-x.y.z.zip` ; on l'ajoute
au registre `server/utils/plugin-registry.ts`. Une pastille **Mises à jour** apparaît dans la
barre latérale dès qu'une nouvelle version (app ou plugin) est disponible.

> **Attention :** le `server.mjs` d'un plugin s'exécute sans bac à sable côté serveur,
> et le `client.mjs` est du JavaScript exécuté dans le navigateur de tous les
> utilisateurs. N'installez que des plugins de confiance et restreignez l'accès via
> `NUXT_PLUGIN_ADMINS` dès qu'il y a plus d'un compte.

## Tests

Tests unitaires avec [Vitest](https://vitest.dev/) (fonctions pures : formatage,
rendu BBCode/Markdown, assainissement HTML, regroupement, chiffrement de session).

```bash
npm test            # exécution unique
npm run test:watch  # mode watch
```

## Sécurité

Points d'attention pour un déploiement partagé :

- **Définissez `NUXT_SESSION_SECRET`** et servez l'app **derrière TLS** (le cookie
  n'est marqué `Secure` qu'en `NODE_ENV=production`).
- **Restreignez les plugins** avec `NUXT_PLUGIN_ADMINS` : installer un plugin revient à
  exécuter du code sur le serveur (RCE) et dans les navigateurs des visiteurs.
- Le rendu des contenus utilisateur (chat, descriptions, commentaires) est **échappé et
  assaini** (échappement des guillemets, schémas d'URL limités à http(s), retrait des
  balises/handlers dangereux). Envisagez d'ajouter une **CSP** en reverse-proxy.
- Le proxy d'images restreint les hôtes autorisés (anti-SSRF) ; l'anti-zip-slip protège
  l'extraction des plugins.

Pour signaler une vulnérabilité, suivez [SECURITY.md](SECURITY.md) (signalement privé) —
n'ouvrez **pas** d'issue publique.

## Documentation

| Document | Contenu |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arborescence, flux des requêtes, cache, auth, chat. |
| [docs/PLUGINS.md](docs/PLUGINS.md) | Créer un plugin : manifest, client/server, réglages, packaging. |
| [docs/ANCRES.md](docs/ANCRES.md) | Référence des slots d'UI, filtres et actions, avec leur `ctx`. |
| [docs/API-PROXY.md](docs/API-PROXY.md) | Le proxy `/api/t/*` : allowlists, TTL, quotas, relay WebSocket. |

## Contribuer

Les contributions sont bienvenues ! Consultez [CONTRIBUTING.md](CONTRIBUTING.md) pour le
workflow (issue → fork → branche → PR), les conventions et les prérequis. `main` est protégée :
tout passe par une Pull Request avec CI verte.

## Licence

[MIT](LICENSE).
