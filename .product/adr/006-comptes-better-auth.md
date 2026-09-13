# ADR-006 : Comptes utilisateurs avec Better Auth, déployés avec le site

**Date** : 2026-09-13 · **Statut** : accepté · **Décideur** : Claude, sur demande de Pierre (« fais une reco : Auth0 ou autre ? ») avec auto-validation autorisée

## Contexte

Deklic doit proposer un compte optionnel : connexion par Google, Apple ou e-mail, dans une page de connexion classique qui reprend le visuel de l'application. L'ADR-001 prévoyait « lien magique, Better Auth + Drizzle + D1 (Supabase Auth en alternative) » en v1.5, et « les comptes dans le Worker existant ». Trois contraintes tranchent :

1. **Le visuel** : la page de connexion doit être la nôtre (tokens « Le guide », logotype Deklic, textes). Une page hébergée chez un fournisseur (Auth0 Universal Login, WorkOS AuthKit) ou des composants imposés (Clerk) ne le permettent pas.
2. **Le cookie de session** doit être posé sur l'origine du site : un cookie tiers entre `loupeprojet.pages.dev` et `*.workers.dev` est bloqué par Safari. L'API des comptes doit donc répondre **sur l'origine de l'application**.
3. **Le travail en parallèle** : la session principale développe `apps/worker` (`/extract`, enrichissement) en même temps ; y ajouter l'authentification créerait des conflits permanents.

## Décision

| Sujet                 | Choix                                                                                                                                                                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bibliothèque          | **Better Auth** (TypeScript, MIT) : sessions en cookie, code e-mail (plugin `emailOTP`), fournisseurs Google et Apple, mise à jour et suppression du compte, limite de débit. Nous n'écrivons aucune cryptographie.                                          |
| Base                  | **Cloudflare D1** (SQLite, `location_hint` UE), tables Better Auth (`user`, `session`, `account`, `verification`), migration SQL versionnée dans `apps/comptes/migrations/`. Accès par **Kysely + `kysely-d1`** (l'adaptateur Kysely est natif chez Better Auth). |
| Méthode e-mail        | **Code à 6 chiffres** envoyé par e-mail (10 minutes, 3 essais), pas de mot de passe. Le lien magique de la spec est remplacé : on reste sur l'appareil où l'on se connecte.                                                                                 |
| E-mails               | **Resend** (API HTTP, gratuit jusqu'à 3 000/mois). Sans clé (développement) : le code est écrit dans le journal du worker.                                                                                                                                  |
| Déploiement           | Nouveau workspace **`apps/comptes`** (Hono + Better Auth). Le build de `apps/web` produit `dist/_worker.js` (bundle de `apps/comptes` par `wrangler deploy --dry-run`) et `dist/_routes.json` (seul `/api/*` entre dans le worker). Même origine que le site. |
| Développement local   | `wrangler dev` sur `apps/comptes` (D1 locale automatique, secrets dans `.dev.vars`) ; Vite relaie `/api` vers `http://localhost:8787`.                                                                                                                       |
| Instance              | Better Auth est instancié **par requête** (les bindings D1 n'existent que dans la requête), avec `baseURL` = origine de la requête ; les origines de confiance couvrent la production, les previews Pages, localhost et `appleid.apple.com`.               |
| Fournisseurs          | Google et Apple activés par variables d'environnement ; `GET /api/comptes/fournisseurs` dit à l'interface quels boutons afficher. Apple exige le programme développeur (99 $/an) : décision de Pierre, pas un blocage.                                       |
| Sécurité              | Cookies `HttpOnly`, `SameSite=Lax`, `Secure` hors développement ; session 7 jours renouvelée ; suppression du compte réservée aux sessions de moins d'un jour ; aucune adresse e-mail ni code dans les journaux ; secrets uniquement côté worker.            |

## Alternatives écartées

- **Auth0** (gratuit 25 000 utilisateurs/mois, tenant UE possible) : page de connexion hébergée, personnalisable mais pas notre écran ; la connexion « embarquée » est déconseillée par Auth0 (cross-origin, domaine personnalisé). Les utilisateurs vivent chez Auth0 ; 35 $/mois dès qu'on veut des environnements séparés.
- **Clerk** : composants imposés, données aux États-Unis, domaine personnalisé obligatoire en production (pas de `*.pages.dev`).
- **WorkOS AuthKit** : gratuit jusqu'à 1 million d'utilisateurs, mais page hébergée et données aux États-Unis.
- **Supabase Auth** : sans interface imposée et en UE, mais le projet gratuit se met en pause après sept jours sans trafic (déjà écarté par l'ADR-001) et c'est un second fournisseur d'infrastructure.
- **Drizzle** comme couche d'accès : possible (c'était l'idée de l'ADR-001) mais ajoute un schéma et un outil de migration ; Kysely est déjà une dépendance de Better Auth et `kysely-d1` fait quinze lignes.
- **Auth dans `apps/worker`** avec un proxy Pages vers le Worker (service binding) : même résultat pour le cookie, mais dépend du déploiement du Worker (pas encore fait) et d'un binding de plus à configurer ; conflits avec la session principale. Reste la cible quand un domaine unique portera le site et l'API.
- **Migrer Pages vers « Workers static assets »** : un seul déploiement pour le site et l'API, plus simple à terme, mais c'est un changement d'infrastructure (nouvelle URL tant que le domaine n'est pas acheté) : à décider séparément.

## Conséquences

- Nouvelles étapes de mise en place pour Pierre (documentées dans le README) : créer la base D1 et appliquer la migration, renseigner les secrets du projet Pages (`BETTER_AUTH_SECRET`, Resend, Google, Apple), activer le flag `nodejs_compat`, enregistrer les URL de retour chez Google et Apple.
- Tant que le domaine n'est pas vérifié chez Resend, les codes ne partent qu'à l'adresse du compte Resend : Google reste le chemin de connexion réel d'ici là.
- Les previews Pages ont chacune leur origine : Google et Apple n'y fonctionnent pas (URL de retour non enregistrées) ; le code e-mail, si.
- `apps/comptes` devient le foyer naturel de la synchronisation des projets (v1.5) : même base, même session.
- Coût : 0 € dans les quotas gratuits (D1 : 5 millions de lectures/jour ; Resend : 3 000 e-mails/mois ; Pages Functions : 100 000 requêtes/jour).
