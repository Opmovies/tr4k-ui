# Les ancres (slots, filtres, actions)

Les **ancres** sont les points d'extension du core sur lesquels les plugins se branchent,
sur le modèle WordPress :

- **Slots d'UI** — un emplacement du template où des composants de plugins sont montés
  (`api.ui.registerSlot`).
- **Filtres** — une valeur que les plugins peuvent transformer en chaîne
  (`api.filters.addFilter`).
- **Actions** — un événement que les plugins peuvent écouter (`api.hooks.addAction`).
- **Enregistrements** — nav, pages `/p/<id>`, onglets de fiche (`registerNav`,
  `registerPage`, `registerTab`).

Le registre central est [`composables/usePluginHost.ts`](../composables/usePluginHost.ts) ;
le composant de rendu est [`components/plugin/PluginSlot.vue`](../components/plugin/PluginSlot.vue).

## Slots d'UI

Usage plugin : `api.ui.registerSlot(nom, composant, order?)`. Le composant reçoit une
prop **`ctx`** dont le contenu dépend du slot. Plusieurs plugins peuvent occuper le même
slot (triés par `order` croissant).

### Coque & navigation

| Slot | Emplacement | `ctx` |
|---|---|---|
| `global` | Monté une fois dans la coque (`app.vue`) — overlays, watchers, boucles de fond | `null` |
| `topbar.actions` | Barre du haut, entre la recherche et la cloche (`layout/AppTopbar.vue`) | `null` |

### Listes de torrents

| Slot | Emplacement | `ctx` |
|---|---|---|
| `torrent.list.toolbar` | Barre tri/vue de la recherche (`pages/index.vue`) **et** en-tête « Derniers ajouts » de Découvrir (`pages/decouvrir.vue`) | `null` |
| `torrent.row.badges` | Métadonnées d'une ligne — recherche/Découvrir (ligne simple **et** sous-ligne de groupe, `torrent/ReleaseList.vue`), tableau `/mes-uploads`, onglets Uploads & Favoris du profil | le torrent |
| `torrent.row.actions` | Boutons d'action d'une ligne, à côté du bouton .torrent — mêmes emplacements que `torrent.row.badges` | le torrent |
| `torrent.group.badges` | En-tête d'un groupe « Par œuvre » replié (`torrent/ReleaseList.vue`) | le **groupe** `{ key, count, rep, releases[], title, … }` |
| `torrent.card.overlay` | Coin de l'affiche en vue cartes : recherche (`pages/index.vue`), grille Exclusivités de Découvrir, grille « Torrents liés » de la fiche | le torrent |

### Fiche torrent

| Slot | Emplacement | `ctx` |
|---|---|---|
| `torrent.detail.badges` | Chips de la fiche, après les tags (`pages/torrent/[slug].vue`) | le torrent **détaillé** (nfo, files, info_hash…) |
| `torrent.detail.actions` | Boutons de la fiche, après « Télécharger » | le torrent détaillé |
| `torrent.uploader.actions` | Carte uploadeur, avant le chevron | le torrent détaillé |
| `torrent.files.row.actions` | Onglet Fichiers, en fin de chaque ligne | `{ file, torrent }` |
| `torrent.comment.actions` | En-tête d'un commentaire (pseudo + date) | `{ comment, torrent }` |

### Chat

| Slot | Emplacement | `ctx` |
|---|---|---|
| `chat.message.actions` | Boutons d'un message (réagir/répondre/supprimer), page `/chat` **et** dock flottant (`chat/ChatMessage.vue`) | le message |
| `chat.composer.actions` | Zone de saisie, entre le bouton image et Envoyer (`chat/ChatComposer.vue`) | la conversation courante `{ id, name, type, … }` |

### Autres pages

| Slot | Emplacement | `ctx` |
|---|---|---|
| `profile.duplicates.actions` | Onglet Doublons du profil, à côté du bouton .torrent de chaque ligne (`pages/profil.vue`) | le doublon `{ retired_slug, retired_name, kept_slug, kept_name, kept_seeders, size_bytes, scheduled_for }` |
| `stats.kpis` | Page `/stats`, à la suite des KPI 24 h / 7 j | l'objet stats complet `{ summary, statistics, snapshots, … }` |
| `shop.item.actions` | Carte d'un article de la boutique, à côté du prix | l'article `{ id, name, price, bonus_bytes, … }` |
| `plugin.settings.<id>` | Sous le formulaire de réglages du plugin `<id>` sur `/plugins` — ex. bouton « Tester la connexion » | le manifest + état `{ …manifest, enabled }` |

**`stop`** : dans les lignes/cartes qui sont des `NuxtLink`, le slot est enveloppé d'un
`@click.stop.prevent` (prop `stop` de `PluginSlot`) — les clics de tes boutons ne
déclenchent pas la navigation vers la fiche. C'est le cas pour les slots
`torrent.row.*` (dans `ReleaseList`), `torrent.group.badges`, `torrent.card.overlay`
et `torrent.uploader.actions`. Les tableaux (`/mes-uploads`, profil) et la fiche ne
sont pas des liens : pas besoin de `stop`.

### Objets `ctx` torrent : deux formes

- **Ligne/carte de liste** : champs de `/api/torrents` (id, slug, name, tags, seeders,
  leechers, size_bytes, poster_url, parent_cat_slug, is_freeleech, …). **Pas de
  `info_hash`** en liste — le matching par hash n'est possible que sur la fiche.
  Nuances : les lignes de `/mes-uploads` ont en plus `status`/`is_anonymous` ; les
  favoris du profil sont plus maigres (pas de tags).
- **Fiche** (`torrent.detail.*`, `torrent.uploader.actions`, `torrent.files.*`,
  `torrent.comment.*`) : la réponse complète de `/api/torrents/<slug>`
  (info_hash, files[], nfo, tech_info_xml, uploader, …).

## Filtres

Usage plugin : `api.filters.addFilter(nom, (valeur, ctx) => nouvelleValeur, priority?)`.
Les filtres s'enchaînent par `priority` croissante. Les refs Vue lues dans un filtre
restent **réactives** (les `applyFilters` du core sont dans des `computed`).

| Filtre | Où | Valeur | Usage type |
|---|---|---|---|
| `torrent.list.items` | Résultats de la recherche (`useTorrentSearch`) **et** listes de Découvrir. `ctx = { source: 'search' \| 'recent' \| 'exclu' }` | `torrent[]` | Masquer/annoter/réordonner des résultats (ex. toggle « Masquer seedbox »). |
| `torrent.detail.data` | Fiche torrent, entre la réponse API et l'affichage (`pages/torrent/[slug].vue`) | le torrent détaillé | Enrichir/corriger une fiche (champs calculés, badges dérivés). |
| `torrent.download.url` | Tous les boutons .torrent (recherche, Découvrir, fiche, `/mes-uploads`, profil) via `torrentDlUrl()` (`composables/useTorrentDl.ts`). `ctx` = le torrent | `string` (URL, défaut `/api/download/<slug>`) | Réécrire le lien — ex. router le .torrent vers la seedbox au lieu du navigateur. |
| `nav.items` | Entrées de la sidebar, core + plugins confondus, après tri par `order` (`layout/AppSidebar.vue`) | `{ to, label, icon, order }[]` | Masquer, réordonner ou renommer des entrées de navigation. |

## Actions

Usage plugin : `api.hooks.addAction(nom, (payload) => {}, priority?)`.

| Action | Émise quand | Payload |
|---|---|---|
| `torrent.detail.viewed` | Une fiche torrent vient d'être chargée | le torrent détaillé |
| `torrent.download.clicked` | Clic sur un bouton .torrent (tous les emplacements passés par `useTorrentDl`) | le torrent |
| `chat.message.received` | Un message de chat arrive par le WebSocket (une seule instance active : page `/chat` **ou** dock) | le message brut du tracker `{ conv_id, sender, body, … }` |
| `notification.received` | Une notification temps réel arrive par le WebSocket | la notification brute `{ notif_type, title, body, link, … }` |

## Enregistrements (nav, pages, onglets)

- `api.ui.registerNav({ to, label, icon?, order? })` — entrée de sidebar. Les entrées
  core ont les `order` 0-6 ; défaut plugin : 50 (donc en bas). La liste finale passe
  ensuite par le filtre `nav.items`.
- `api.ui.registerPage({ path: '/p/<id>/…', component, title?, icon?, nav?, order? })` —
  route ajoutée au router **avant la navigation initiale** (les deep-links `/p/…`
  marchent au premier chargement).
- `api.ui.registerTab({ id, label, icon?, component, visible? })` — onglet de la fiche
  torrent, affiché après les onglets core ; `visible(torrent)` le conditionne ;
  le composant reçoit `:ctx="torrent"`.

## Ajouter une nouvelle ancre au core

1. **Slot d'UI** : placer `<PluginSlot name="mon.slot" :ctx="objet" />` dans le template
   (ajouter `stop` si l'emplacement vit dans un lien cliquable).
2. **Filtre** : envelopper la valeur dans un `computed` —
   `const items = computed(() => pluginHost.filters.applyFilters('mon.filtre', source.value))`.
3. **Action** : `pluginHost.hooks.doAction('mon.action', payload)` à l'endroit voulu.
4. **Documenter l'ancre dans ce fichier** (emplacement + forme du `ctx`), c'est le
   contrat public des plugins.

Conventions de nommage : `domaine.zone[.détail]` en kebab/point —
`torrent.row.badges`, `plugin.settings.<id>`. Un slot dont le `ctx` change de forme
est un breaking change pour les plugins : préférer ajouter un nouveau slot.
