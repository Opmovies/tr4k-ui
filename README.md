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
- [Variables d'environnement](#variables-denvironnement)
- [Architecture](#architecture)
- [Plugins](#plugins)
- [Tests](#tests)
- [Sécurité](#sécurité)
- [Documentation](#documentation)
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

Image multi-stage (build Nuxt → runtime `node:22-alpine` non-root), avec `HEALTHCHECK`
et volume persistant pour les plugins.

```bash
cp .env.example .env
# éditez .env : renseignez au minimum NUXT_SESSION_SECRET (openssl rand -hex 32)

docker compose up -d --build
```

L'application écoute sur le port **3010** de l'hôte (configurable via `PORT`). Le
conteneur expose `3000` en interne et se déclare *healthy* dès que
`/api/auth/session` répond.

```bash
docker compose logs -f      # suivre les logs
docker compose ps           # état + santé
docker compose down         # arrêter (le volume tr4k-data est conservé)
```

## Variables d'environnement

| Variable | Rôle | Défaut |
|---|---|---|
| `NUXT_SESSION_SECRET` | **Requis en prod.** Clé de chiffrement des cookies de session (`openssl rand -hex 32`). Sans elle, un secret aléatoire local (`.session-secret`) est généré. | — |
| `NUXT_TR4KER_BASE` | URL de base de l'API du tracker. | `https://tr4ker.net` |
| `NUXT_TR4KER_API_KEY` | Clé API pour le repli mono-compte (sinon lue dans `../tr4ker.config.json`). | — |
| `NUXT_ALLOW_CONFIG_KEY` | `1` autorise le repli clé-config (sans login). | `0` |
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

Signalez toute vulnérabilité via une *issue* privée plutôt que publiquement.

## Documentation

| Document | Contenu |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arborescence, flux des requêtes, cache, auth, chat. |
| [docs/PLUGINS.md](docs/PLUGINS.md) | Créer un plugin : manifest, client/server, réglages, packaging. |
| [docs/ANCRES.md](docs/ANCRES.md) | Référence des slots d'UI, filtres et actions, avec leur `ctx`. |
| [docs/API-PROXY.md](docs/API-PROXY.md) | Le proxy `/api/t/*` : allowlists, TTL, quotas, relay WebSocket. |

## Licence

[MIT](LICENSE).
