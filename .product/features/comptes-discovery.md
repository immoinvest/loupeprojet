# Feature Discovery : Comptes utilisateurs (connexion Google, Apple, e-mail)

**Slug** : `comptes` · **Branche** : `feat/comptes` (worktree séparé, base `origin/master` après la PR #9) · **Date** : 2026-09-13

## Demande d'origine

« Met en place le système d'utilisateur : connexion via Google ou Apple ou via e-mail. Reprend le visuel actuel de l'app. Ça doit être un login classique. Fais une reco sur quoi utiliser : Auth0 ou autre ? Il y a d'autres branches en cours de développement (utiliser une autre branche). »

## Analyse

### Quoi

Un **compte optionnel** : l'utilisateur peut se connecter avec Google, Apple ou son adresse e-mail, voir qui il est dans la barre latérale, gérer son compte et se déconnecter. Une page de connexion **classique** (logo, boutons Google et Apple, champ e-mail), dans le visuel « Le guide » et l'identité Deklic.

### Pourquoi

- La spec (v1.5, « Garder ») prévoit un compte pour retrouver ses projets sur tous ses appareils. Cette feature pose l'identité ; la synchronisation des projets est la feature suivante (`sync-projets`).
- L'écran Mes projets affiche déjà « Créer mon compte » (désactivé) et « Un compte par e-mail, sans mot de passe. Gratuit. » : on tient cette promesse.

### Pour qui

Camille, sans compte tant qu'elle ne le veut pas. **Rien n'est verrouillé** : la première analyse ne demande toujours rien (principe 9). Le compte est une commodité, jamais une condition.

### Où

Full-stack :

- `apps/web` : page `/connexion`, page `/compte`, bloc profil de la barre latérale, carte « Créer mon compte » activée.
- **Nouveau** `apps/comptes` : l'API d'authentification (Hono + Better Auth), déployée **avec le site** sur Cloudflare Pages (`_worker.js`, routes `/api/*` uniquement) pour que le cookie de session soit sur la même origine que l'application.
- Cloudflare D1 (base SQLite, région UE) : tables utilisateur, session, compte lié, vérification.
- Envoi d'e-mails : Resend (gratuit jusqu'à 3 000 e-mails/mois).

## Recommandation : Auth0 ou autre ?

| Critère                              | Auth0 (gratuit 25 000 utilisateurs/mois)                                                 | Clerk / WorkOS AuthKit                                                    | Supabase Auth                                                       | **Better Auth** (bibliothèque TypeScript, auto-hébergée)                                  |
| ------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Page de connexion **dans notre app** | Non : « Universal Login » hébergé chez Auth0, personnalisable mais pas notre écran       | Composants imposés (Clerk) ou page hébergée (AuthKit)                     | Oui (sans interface imposée)                                        | **Oui** : nos écrans, nos tokens, nos textes                                              |
| Google + Apple + e-mail sans mot de passe | Oui                                                                                 | Oui                                                                       | Oui                                                                 | **Oui** (Google, Apple, code par e-mail)                                                  |
| Données en UE                        | Oui si le tenant est créé en région UE                                                   | Non (États-Unis)                                                          | Oui (Francfort)                                                     | **Oui** : D1 avec `location_hint` UE, sur notre compte Cloudflare                         |
| Coût                                 | 0 € puis 35 $/mois dès qu'on veut plus (environnements séparés, support)                 | 0 € puis 25 $/mois (Clerk)                                                | 0 € mais le projet gratuit se met en pause après 7 jours sans trafic | **0 €** (quotas gratuits D1 et Resend)                                                    |
| Dépendance / réversibilité           | Utilisateurs chez Auth0 ; export possible mais migration lourde                          | Idem                                                                      | Idem (mais base ouverte)                                            | **Aucune** : nos tables, dans notre base ; la bibliothèque est open source (MIT)          |
| Cohérence avec la stack              | SDK React + validation de jetons dans le Worker                                          | Idem                                                                      | Un second fournisseur d'infrastructure                              | **Même stack** : TypeScript, Hono, Workers, Zod, D1 ; la synchro des projets ira dans la même base |
| Ce qu'on doit maintenir              | Presque rien côté auth ; la page hébergée et sa marque                                   | Presque rien                                                              | Un projet Supabase                                                  | Une configuration, une migration SQL, des tests (la bibliothèque gère sessions, cookies, OTP, OAuth) |

**Décision : Better Auth**, auto-hébergé dans notre Cloudflare (D1 + Resend), avec les écrans dans l'application. Raisons dans l'ordre : (1) c'est la seule option qui donne **exactement notre visuel** sans page hébergée ni composants imposés ; (2) données en UE et zéro coût ; (3) aucune dépendance à un fournisseur d'identité, les comptes sont dans notre base et serviront à la synchronisation ; (4) une seule stack, la plus documentée en TypeScript en 2025-2026, donc la mieux maîtrisée par les outils de code. Auth0 reste une bonne solution quand on veut déléguer la page de connexion ; ici, la demande est l'inverse. Détail dans l'ADR-006.

**Méthode e-mail retenue : un code à 6 chiffres envoyé par e-mail** (pas de mot de passe, comme le promet déjà l'écran Mes projets). Par rapport au lien magique de la spec : on reste sur l'appareil où l'on se connecte (un lien ouvert sur le téléphone ne connecte pas l'ordinateur), et la page reste « classique » (e-mail, puis code). Un mot de passe est écarté : rien à protéger, rien à réinitialiser ; l'option reste activable dans Better Auth si Pierre le demande (une ligne de configuration et deux écrans).

## Outcomes

1. Se connecter prend moins d'une minute, avec Google, Apple ou un code reçu par e-mail ; l'inscription est implicite (pas de formulaire d'inscription).
2. La session tient 7 jours glissants (cookie sécurisé) ; la barre latérale montre qui est connecté ; déconnexion en un clic.
3. Le gratuit sans compte reste intact : aucune fonctionnalité verrouillée, aucun bandeau.
4. L'application dispose d'un identifiant utilisateur stable côté serveur : la synchronisation des projets (v1.5) peut s'y appuyer.

## Outputs

1. `apps/comptes` : application Hono avec Better Auth — `/api/auth/*` (Better Auth : envoi et vérification du code, Google, Apple, session, déconnexion, mise à jour et suppression du compte), `GET /api/comptes/fournisseurs` (quels boutons afficher), `GET /api/comptes/sante`. Dépendances injectées, journal structuré, codes d'erreur, tests en Node.
2. Migration D1 `apps/comptes/migrations/0001_comptes.sql` (tables Better Auth : `user`, `session`, `account`, `verification`), vérifiée par un test sur une vraie base D1 locale (Miniflare).
3. Déploiement : `apps/web` produit `dist/_worker.js` (bundle de `apps/comptes`) et `dist/_routes.json` (seul `/api/*` passe par le worker ; le reste reste statique, `_redirects` inchangé). Développement local : `wrangler dev` sur `apps/comptes` (D1 locale, `.dev.vars`) et proxy Vite `/api` → `localhost:8787`.
4. `apps/web/src/compte/` : client d'authentification (Better Auth React), `CompteProvider` + `useCompte()`, double en mémoire pour les tests.
5. Écrans : `/connexion` (page classique : logotype, « Continuer avec Google », « Continuer avec Apple », e-mail puis code, « Continuer sans compte »), `/compte` (nom modifiable, e-mail, méthodes de connexion liées, déconnexion, suppression du compte), bloc profil de la barre latérale (« Se connecter » ou initiales + nom + « Mon compte »), carte « Créer mon compte » de Mes projets activée.
6. Documentation : ADR-006 (choix Better Auth et déploiement sur Pages), guide de mise en place pour Pierre (D1, Google, Apple, Resend, secrets, flags), README, CLAUDE.md, specs, registre.

## Scope

### IN

- Connexion et inscription implicite par Google, Apple (si configuré) et code e-mail.
- Session, déconnexion, page compte (nom, e-mail, méthodes liées, suppression du compte).
- Boutons affichés seulement pour les fournisseurs configurés (Apple coûte 99 $/an : décision de Pierre, pas un blocage).
- Envoi d'e-mails par Resend en production ; en développement, le code est écrit dans le journal du worker.
- Textes en français, ton Deklic, visuel « Le guide ».

### OUT (plus tard)

- Synchronisation des projets avec le compte (`sync-projets`, feature suivante) : les projets restent sur l'appareil.
- Mot de passe, double authentification, changement d'adresse e-mail, avatar téléversé, organisations, rôles, administration.
- Connexion native iOS (Sign in with Apple depuis une app), extension navigateur connectée.
- Migration de Pages vers « Workers static assets » ou domaine personnalisé (infrastructure, quand le domaine sera acheté).

## Contraintes

- **Même origine** : le cookie de session ne fonctionne (Safari) que si l'API répond sur l'origine du site ; d'où le worker déployé avec Pages, et non l'API `apps/worker` (`*.workers.dev`).
- La commande de build Pages n'exécute que `npm run build -w apps/web` : le bundle `_worker.js` doit sortir de cette commande.
- Aucun secret côté client ; `.dev.vars` ignoré par git ; aucune donnée personnelle dans les journaux (jamais l'adresse e-mail en clair).
- Instance Better Auth **par requête** (les bindings D1 n'existent que dans la requête) ; flag `nodejs_compat`.
- Ne pas toucher `apps/worker` (session principale), `apps/web/src/ecrans/NouveauProjet.tsx`, `apps/web/src/annonces/` (session extension), ni les fichiers des autres fiches ; docs communes en toute fin, après merge de `origin/master`.
- Couverture 100 % sur `apps/comptes/src` et `apps/web/src/compte/` ; écrans couverts par des tests de rendu avec le double.
- Node 22 en CI ; build `wrangler deploy --dry-run` (pas de compte Cloudflare nécessaire).

## Risques

- **Resend sans domaine vérifié** n'envoie qu'à l'adresse du propriétaire du compte Resend : le code e-mail ne marche « pour de vrai » qu'après l'achat et la vérification du domaine (déjà à faire pour Deklic). D'ici là : Google, ou le mode développement.
- **Google** : client OAuth à créer par Pierre (gratuit, 10 minutes) ; en mode « test », seuls 100 utilisateurs de test peuvent se connecter tant que l'écran de consentement n'est pas publié (publication immédiate sans validation pour les portées de base).
- **Apple** : adhésion au programme développeur (99 $/an) ; secret client à régénérer tous les six mois ; pas de test sur `localhost` (HTTPS obligatoire).
- **Previews Pages** : chaque branche a sa propre origine ; les connexions Google/Apple ne marchent que sur les origines enregistrées (production, localhost) ; le code e-mail marche partout.
- **Configuration Pages** par Pierre : binding D1, secrets, flag `nodejs_compat` (tableau de bord ou `wrangler.toml` selon le « root directory » du projet Pages).
- **Limite de débit** de Better Auth en mémoire (par isolat) : protection légère ; le code expire en 10 minutes, 3 essais ; des règles WAF Cloudflare restent possibles.
- **Conflits de `package-lock.json`** avec les autres PR en cours : merge de `origin/master` puis `npm install` avant d'armer l'auto-merge.
- **Better Auth + D1** : cas connu de mauvaise initialisation (adaptateur Kysely mal enveloppé, absence de transactions D1) ; couvert par un test sur une vraie D1 locale.

## Definition of Done

- [ ] Un compte se crée et se connecte par code e-mail (dev : code dans le journal ; prod : Resend).
- [ ] Google et Apple fonctionnent quand leurs clés sont fournies ; sinon leurs boutons n'apparaissent pas.
- [ ] Session en cookie `HttpOnly`, `Secure` en production, `SameSite=Lax`, 7 jours renouvelés.
- [ ] Déconnexion ; page compte (nom modifiable, suppression du compte avec confirmation).
- [ ] Barre latérale : « Se connecter » ou profil connecté ; carte « Créer mon compte » active.
- [ ] Rien n'est verrouillé sans compte.
- [ ] Tests : API (flux code complet, fournisseurs, erreurs, journal sans donnée personnelle), migration sur D1 locale, écrans (rendu, saisie, erreurs).
- [ ] Gates verts ; couverture 100 % sur les modules de logique ajoutés.
- [ ] ADR-006, guide de mise en place, README, CLAUDE.md, specs, registre.
- [ ] PR ouverte et armée en auto-merge.

## Auto-revue (points de contrôle validés par Claude, sur autorisation de Pierre)

- **« Login classique »** est lu comme « page de connexion standard » (boutons sociaux + e-mail), pas comme « mot de passe ». Si Pierre voulait un mot de passe, c'est une option Better Auth et deux écrans de plus : rien du socle n'est à refaire.
- **L'API dans le worker Pages** plutôt que dans `apps/worker` s'écarte de l'ADR-001 (« les comptes dans le Worker existant ») pour une raison technique (cookie de même origine) et une raison d'organisation (la session principale travaille dans `apps/worker` en parallèle). Documenté dans l'ADR-006 ; réversible quand un domaine unique portera le site et l'API.
- **Un compte qui ne synchronise rien** peut sembler mince ; c'est le prix d'une feature par session. La synchronisation est la suite logique et immédiate.
- **Code e-mail plutôt que lien magique** : choix d'ergonomie argumenté ci-dessus ; la spec parle de « lien magique », le README et la spec seront mis à jour.
