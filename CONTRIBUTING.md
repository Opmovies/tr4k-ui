# Contribuer à TR4K UI

Merci de vouloir améliorer TR4K UI ! Ce guide résume comment proposer un changement de
façon fluide. Les échanges se font en français ou en anglais, comme tu préfères.

## Prérequis

- **Node.js 22+** et npm.
- Un compte **tr4ker.net** pour tester en conditions réelles (facultatif pour la plupart
  des changements d'UI).

```bash
npm install
npm run dev      # http://localhost:3010
```

## Workflow de contribution

1. **Ouvre d'abord une issue** pour les changements non triviaux (bug, fonctionnalité),
   afin d'aligner l'approche avant de coder.
2. **Forke** le dépôt et crée une branche depuis `main` :
   `git checkout -b feat/ma-fonctionnalite` (ou `fix/…`, `docs/…`, `chore/…`).
3. Développe, **ajoute des tests** si tu touches à de la logique, et garde les commits
   clairs (voir [Commits](#commits)).
4. Vérifie que **tout passe en local** (voir [Avant de soumettre](#avant-de-soumettre)).
5. Ouvre une **Pull Request** vers `main`. Décris le _quoi_ et le _pourquoi_, lie l'issue,
   ajoute des captures pour un changement visuel.
6. La **CI doit être verte** et la branche à jour avec `main` pour pouvoir fusionner.

> `main` est une branche protégée : on n'y pousse jamais directement, tout passe par une PR.

## Avant de soumettre

```bash
npm test          # les tests unitaires doivent tous passer
npm run build     # le build de production doit réussir
```

Si ton changement est visible dans l'interface, vérifie-le dans le navigateur en thème
**clair et sombre**.

## Tests

- Framework : [Vitest](https://vitest.dev/) — les tests vivent dans `tests/*.spec.ts`.
- Priorise les **fonctions pures** (composables de formatage/rendu, utilitaires serveur) :
  elles se testent sans runtime Nuxt.
- Toute correction de bug devrait venir avec un test qui échoue **avant** le correctif.
- Toute logique de sécurité (échappement, validation d'URL, chiffrement) **doit** être
  couverte.

```bash
npm test          # exécution unique
npm run test:watch
```

## Style de code

- **Vue 3 `<script setup>` + TypeScript**, cohérent avec l'existant.
- Composants rangés par domaine dans `components/<domaine>/` mais **noms plats**
  (`pathPrefix: false`) — voir `nuxt.config.ts`.
- La logique lourde d'une page vit dans un **composable** (`composables/use*.ts`), la page
  reste surtout du template.
- Commentaires en français, concis, réservés au _pourquoi_ (une contrainte non évidente),
  pas au _quoi_.
- Pas d'outil de formatage imposé : garde le style du fichier que tu modifies.

## Règles d'or de l'architecture

- **Le navigateur ne parle jamais directement à tr4ker.net.** Toute donnée du tracker passe
  par le proxy Nitro (`server/api/t/[...path].*`) qui applique allowlist, cache et quota.
- Une nouvelle route de tracker consommée doit être **ajoutée à l'allowlist** du proxy avec
  un TTL de cache adapté (voir [docs/API-PROXY.md](docs/API-PROXY.md)).
- Le **quota est précieux** : 20 req/min/utilisateur côté proxy. Réutilise le cache plutôt
  que de multiplier les appels.
- Après un changement de `nuxt.config.ts`, **redémarre** le serveur de dev (le HMR ne suffit
  pas).

## Sécurité

- Ne rends jamais du contenu utilisateur sans échappement/assainissement (voir
  `composables/useRichText.ts`). Les URL insérées dans des attributs doivent être échappées
  et limitées aux schémas `http(s)`.
- Ne commite **aucun secret** (`.env`, `.session-secret`, clés). Le `.gitignore` les couvre ;
  vérifie ton diff avant de pousser.
- Pour signaler une vulnérabilité, suis [SECURITY.md](SECURITY.md) — **pas** d'issue publique.

## Plugins

Un plugin est un projet indépendant (dossier `plugin.json` + `client.mjs` + `server.mjs`).
Consulte [docs/PLUGINS.md](docs/PLUGINS.md) et la référence des slots
[docs/ANCRES.md](docs/ANCRES.md). **Si tu ajoutes une ancre** dans le cœur, documente-la
dans `docs/ANCRES.md` : c'est le contrat public des plugins.

## Commits

Format conseillé (type + résumé impératif court) :

```
feat: autocomplétion TMDB dans la recherche
fix: purge du typing en changeant de canal
docs: précise la config Docker
```

Types courants : `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.

## Licence

En contribuant, tu acceptes que ton code soit publié sous la licence [MIT](LICENSE) du projet.
