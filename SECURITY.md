# Politique de sécurité

## Signaler une vulnérabilité

Merci de **ne pas ouvrir d'issue publique** pour une faille de sécurité.

Utilise plutôt l'onglet **Security → Report a vulnerability** du dépôt
(GitHub Private Vulnerability Reporting), ou contacte directement le mainteneur en privé.

Merci d'inclure si possible :

- une description de la faille et de son impact ;
- les étapes de reproduction (ou un PoC minimal) ;
- la version / le commit concerné.

Une réponse est visée sous **7 jours**. Merci de laisser un délai raisonnable de correction
avant toute divulgation publique (divulgation coordonnée).

## Bonnes pratiques de déploiement

TR4K UI est conçu pour être auto-hébergé. Pour un déploiement partagé (multi-comptes) :

- Définis `NUXT_SESSION_SECRET` (`openssl rand -hex 32`) et sers l'application **derrière
  HTTPS** (le cookie de session n'est marqué `Secure` qu'en `NODE_ENV=production`).
- **Restreins la gestion des plugins** avec `NUXT_PLUGIN_ADMINS`. Installer un plugin revient
  à exécuter du code côté serveur **et** dans le navigateur des autres utilisateurs :
  n'ouvre cette capacité qu'à des comptes de confiance.
- N'active `NUXT_ALLOW_CONFIG_KEY` que pour un usage mono-compte volontaire.
- Envisage une **CSP** au niveau du reverse-proxy.

Les contenus utilisateur (chat, descriptions, commentaires) sont échappés et assainis, et le
proxy d'images applique une allowlist d'hôtes (anti-SSRF).
