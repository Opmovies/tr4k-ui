# Le proxy API (`/api/t/*` et compagnie)

Tout accès à l'API TR4KER passe par Nitro. Objectifs : ne jamais exposer le token au
navigateur, encaisser le quota Cloudflare du tracker (fenêtre glissante longue), et
interdire par construction toute route dangereuse.

## Règles de trafic (server/utils/tr4ker.ts)

Par **utilisateur** (indexé sur `auth.hash`) :

| Règle | Valeur |
|---|---|
| Intervalle minimum entre deux requêtes | 700 ms (file sérialisée) |
| Budget local | 20 req/min (fenêtre glissante) — au-delà : 429 local, le cache répond |
| Après un **429 du tracker** | blocage total 90 s, **jamais de retry** |
| 401 du tracker | « Session TR4KER expirée » (l'UI renvoie au login) |

Cache serveur : single-flight (une seule requête simultanée par clé), éviction LRU
(~800 entrées), **stale-while-error** (une erreur/429 ressert la version périmée si
elle existe). Réponses annotées `X-Tr4k-Cache: hit | miss | stale`.

Cloisonnement : la clé de cache est préfixée par l'utilisateur pour `me/*`,
`conversations*` et `shop/history` — aucune fuite de données perso entre comptes ;
le catalogue public est partagé.

### TTL par route (GET)

| Route | TTL |
|---|---|
| `public/categories`, `tmdb/*` | 24 h |
| `torrents/<slug>/related` | 30 min |
| `torrents/<slug>` (fiche) | 15 min |
| `public/*`, `announcements` | 15 min |
| `me` (défaut me/*), `users/<x>` | 10 min |
| `me/stats`, `exclu`, `torrents/<slug>/comments|thanks` | 5 min |
| `me/downloads` | 3 min |
| défaut | 2 min |
| `torrents` (recherche) | 90 s |
| `torrents/recent`, `users/search` | 60 s |
| `conversations*` | 20 s |
| `me/notifications*` | 5 s |

## Allowlists par méthode

Un chemin hors liste → **403**. C'est le seul mécanisme de sécurité côté proxy, il est
volontairement minimal et lisible — le modifier = relire ces quatre fichiers :

- **GET** [`server/api/t/[...path].get.ts`](../server/api/t/%5B...path%5D.get.ts) —
  catalogue, fiche (+related/comments/thanks), `me/*` (stats, downloads, torrents,
  favorites, duplicates, notifications, featured-badges, titles…), catégories, tmdb,
  users/search, shop (lecture), badges, channels, conversations + messages.
  ⚠️ `me/api-key` est **exclu exprès** (un POST dessus régénérerait la clé).
- **POST** `dm/<username>` uniquement (ouvrir un MP). Rien qui dépense des crédits.
- **PATCH** `me/notifications/<id>/read` et `me/notifications/read` uniquement.
- **DELETE** `messages/<id>` uniquement (le tracker vérifie l'auteur).
- L'achat boutique (`POST /shop/buy`) n'est volontairement **pas** proxifié.

## Endpoints annexes

| Endpoint | Rôle |
|---|---|
| `GET /api/download/<slug>` | Relaie le `.torrent` (cadencé, jamais caché). |
| `GET /api/img?u=<url>` | Proxy image pour `tr4ker.net/uploads|badges` (bloqués en hotlink par Cloudflare). Cache 24 h, `Cache-Control: immutable`. Les posters TMDB restent en direct. |
| `GET /api/gifs?q=` | Recherche GIF via la gateway Klipy communautaire (hors quota tracker), cache 10 min. |
| `POST /api/upload-image` | Upload vers imgbb (clé `imgbb_key` du config ou `NUXT_IMGBB_KEY`) → URL `i.ibb.co` insérable dans le chat. 501 explicite si pas de clé. |
| `GET/PUT /api/plugins/*`, `ALL /api/px/<id>/*` | Système de plugins — voir [PLUGINS.md](PLUGINS.md). |

## WebSocket `/ws` (server/routes/ws.ts)

Relay authentifié vers `wss://tr4ker.net/api/ws` :

- Auth à l'upgrade via le cookie de session (sinon `relay.error` + fermeture).
- `ping` du tracker : le relay répond `pong` lui-même, ET retransmet le `ping` au
  navigateur (signal de vie pour le watchdog de ChatView).
- **Heartbeat local** : un `{type:"ping"}` envoyé par le navigateur reçoit un
  `{type:"pong"}` du relay directement — jamais relayé au tracker. Le client en émet
  un toutes les 25 s et force une reconnexion si rien n'est reçu depuis 60 s
  (sockets mortes en silence, fréquent sur mobile).
- **Types sortants allowlistés** : `msg.send`, `read`, `pong`, `typing`,
  `typing.start`, `typing.stop`, `reaction.add`, `reaction.remove`. Tout le reste est
  jeté silencieusement.
- Messages mis en file tant que l'upstream n'est pas ouvert.
- À la **re**connexion, ChatView resynchronise : historique de la conversation
  courante rechargé (REST) + liste des MP, pour rattraper les messages manqués.

Protocole (observé, cf. TR4KER_API.md) : entrants `connected`, `msg.received` (ou
message brut), `msg.edited`, `msg.deleted`, `reaction.updated`, `typing{conv_id,user}`,
`chan.cleared`, `new_dm`, `notification`, `error`.

## Étendre le proxy

1. Ajouter la regex du chemin dans l'allowlist de la bonne méthode.
2. Choisir un TTL dans `ttlFor()` (GET seulement) — court pour du personnel, long pour
   du référentiel.
3. Si la donnée est personnelle, vérifier qu'elle matche `userScoped()` (sinon le cache
   fuiterait entre comptes).
4. Documenter la route ici.

**Ne jamais** proxifier : régénération de clé API, achats, suppression de compte,
et plus largement tout ce qui dépense ou détruit.
