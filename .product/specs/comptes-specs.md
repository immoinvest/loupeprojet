# Specs — Comptes utilisateurs (connexion Google, Apple, code e-mail)

Discovery validée : `.product/features/comptes-discovery.md`. Branche `feat/comptes`.

## Épics

| Épic | Titre                                  | Stories       |
| ---- | -------------------------------------- | ------------- |
| E1   | API des comptes (`apps/comptes`)       | US-1 à US-5   |
| E2   | Écrans et coque (`apps/web`)           | US-6 à US-8   |
| E3   | Documentation et mise en place         | fin de pipeline (ADR-006, guide, docs communes) |

## Stories

### US-1 : Socle `apps/comptes`

En tant que développeur, je veux une application Hono `apps/comptes` avec dépendances injectées, journal et erreurs en codes, pour accueillir l'authentification et la déployer comme worker Pages.

Priorité **P0** · Effort **S**

```gherkin
Scénario : santé
  Étant donné l'application construite avec des doubles
  Quand je demande GET /api/comptes/sante
  Alors la réponse est 200 { ok: true, version, environnement }

Scénario : fournisseurs disponibles
  Étant donné une configuration sans clé Google ni Apple, en environnement dev
  Quand je demande GET /api/comptes/fournisseurs
  Alors la réponse est 200 { email: true, google: false, apple: false }

Scénario : route inconnue et erreur interne
  Quand je demande GET /api/rien
  Alors la réponse est 404 { code: 'INTROUVABLE' } en JSON
  Et une exception imprévue rend 500 { code: 'ERREUR_INTERNE' } et une ligne de journal sans donnée personnelle

Scénario : build
  Quand j'exécute npm run build -w apps/comptes
  Alors wrangler produit un bundle en mode dry-run sans compte Cloudflare
```

### US-2 : Connexion par code e-mail

En tant que Camille, je veux recevoir un code à 6 chiffres par e-mail et le saisir, pour me connecter sans mot de passe (et créer mon compte au passage).

Priorité **P0** · Effort **M**

```gherkin
Scénario : premier code, compte créé
  Étant donné aucun compte pour camille@example.org
  Quand je POST /api/auth/email-otp/send-verification-otp { email, type: 'sign-in' }
  Alors l'envoyeur d'e-mails reçoit un message avec un code à 6 chiffres et la réponse est 200
  Quand je POST /api/auth/sign-in/email-otp { email, otp: <le code> }
  Alors la réponse est 200 avec un cookie de session HttpOnly, SameSite=Lax (Secure en production)
  Et GET /api/auth/get-session renvoie l'utilisateur (e-mail vérifié)
  Et POST /api/auth/sign-out efface la session

Scénario : code faux, expiré ou trop d'essais
  Étant donné un code envoyé
  Quand je saisis un code faux
  Alors la réponse est 400 avec un code d'erreur (INVALID_OTP), le journal ne contient ni l'e-mail ni le code
  Quand j'ai saisi trois codes faux
  Alors la réponse est TOO_MANY_ATTEMPTS et le code est invalidé
  Quand le code a plus de 10 minutes
  Alors la réponse est OTP_EXPIRED

Scénario : e-mail invalide et abus
  Quand je demande un code pour « pas-un-email »
  Alors la réponse est 400
  Quand je demande plus de 3 codes en une minute depuis la même adresse IP
  Alors la réponse est 429

Scénario : environnement de développement
  Étant donné aucune clé Resend
  Quand un code est envoyé
  Alors il est écrit dans le journal (événement `courriel.dev`) au lieu d'être envoyé
```

### US-3 : Continuer avec Google, continuer avec Apple

En tant que Camille, je veux me connecter avec mon compte Google (ou Apple), pour ne rien saisir.

Priorité **P0** (Google) / **P1** (Apple) · Effort **S**

```gherkin
Scénario : Google configuré
  Étant donné GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET
  Quand je POST /api/auth/sign-in/social { provider: 'google', callbackURL: '/projets' }
  Alors la réponse contient une URL accounts.google.com avec client_id, redirect_uri = <origine>/api/auth/callback/google, state et code_challenge
  Et GET /api/comptes/fournisseurs indique google: true

Scénario : Apple configuré
  Étant donné APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY
  Alors le secret client est un JWT ES256 signé avec la clé, valable moins de six mois
  Et https://appleid.apple.com est une origine de confiance (réponse en form_post)
  Et GET /api/comptes/fournisseurs indique apple: true

Scénario : fournisseur non configuré
  Étant donné aucune clé Google
  Quand je POST /api/auth/sign-in/social { provider: 'google' }
  Alors la réponse est une erreur 4xx (fournisseur inconnu), jamais 500
```

### US-4 : Persistance D1

En tant qu'exploitant, je veux les comptes dans une base D1 (UE) créée par une migration versionnée, pour que rien ne dépende d'un fournisseur d'identité.

Priorité **P0** · Effort **M**

```gherkin
Scénario : migration
  Étant donné une base D1 locale vide (Miniflare)
  Quand j'applique migrations/0001_comptes.sql
  Alors les tables user, session, account, verification existent avec les colonnes attendues par Better Auth

Scénario : flux complet sur D1
  Étant donné l'application branchée sur cette base par l'adaptateur Kysely + D1
  Quand je joue le flux code e-mail (envoi, connexion, session, déconnexion)
  Alors chaque étape réussit et les lignes sont visibles dans la base

Scénario : configuration
  Étant donné wrangler.toml (binding DB, nodejs_compat) et .dev.vars.example
  Quand je lance npm run dev -w apps/comptes
  Alors une D1 locale est créée automatiquement et l'API répond sur http://localhost:8787
```

### US-5 : Déployé avec le site

En tant qu'exploitant, je veux que le build de `apps/web` produise le worker Pages, pour que l'API réponde sur l'origine du site (cookie de même origine) sans étape de déploiement supplémentaire.

Priorité **P0** · Effort **S**

```gherkin
Scénario : bundle
  Quand j'exécute npm run build -w apps/web
  Alors dist/ contient index.html, _redirects, _routes.json (include ['/api/*']) et _worker.js (bundle autonome de apps/comptes)

Scénario : routage
  Étant donné le worker Pages
  Quand une requête arrive sur /api/auth/get-session
  Alors elle est traitée par apps/comptes
  Quand une requête arrive sur /projets
  Alors elle n'entre pas dans le worker (statique + _redirects) ; s'il est appelé malgré tout, il délègue à env.ASSETS

Scénario : développement
  Étant donné vite en cours d'exécution
  Quand le navigateur appelle /api/…
  Alors Vite relaie vers http://localhost:8787 (wrangler dev de apps/comptes)
```

### US-6 : Client de compte dans l'application

En tant que développeur, je veux un `CompteProvider` (session, actions) avec un double en mémoire, pour que les écrans et leurs tests ne dépendent pas du réseau.

Priorité **P0** · Effort **S**

```gherkin
Scénario : états
  Étant donné le provider
  Alors useCompte() expose etat: 'chargement' | 'anonyme' | 'connecte', utilisateur (id, nom, e-mail, image) et les actions (demanderCode, verifierCode, continuerAvec, deconnecter, renommer, supprimer, fournisseurs)

Scénario : double en mémoire
  Étant donné clientMemoire({ fournisseurs, utilisateurs })
  Quand un test appelle demanderCode puis verifierCode avec le code retenu
  Alors l'état passe à connecte sans requête réseau

Scénario : erreurs traduites
  Quand le client réel reçoit une erreur Better Auth (INVALID_OTP, OTP_EXPIRED, TOO_MANY_ATTEMPTS, 429, réseau)
  Alors l'écran obtient un code stable et src/textes/compte.ts le transforme en phrase en français
```

### US-7 : Page de connexion classique

En tant que Camille, je veux une page de connexion claire et familière, dans le visuel Deklic, pour me connecter en moins d'une minute.

Priorité **P0** · Effort **M**

```gherkin
Scénario : mise en page
  Quand j'ouvre /connexion sans être connectée
  Alors je vois le logotype Deklic, un titre, « Continuer avec Google » et « Continuer avec Apple » (seulement si disponibles), un séparateur « ou », un champ e-mail, « Recevoir un code » et « Continuer sans compte »
  Et la page est centrée sur le fond chaud, sans barre latérale

Scénario : code
  Quand je saisis mon e-mail et demande un code
  Alors la page passe à l'étape « Saisissez le code reçu » (6 chiffres, autocomplete one-time-code), avec « Renvoyer un code » et « Changer d'adresse »
  Quand je saisis le bon code
  Alors je suis redirigée vers la page d'origine (ou /projets)

Scénario : erreurs
  Quand je saisis un e-mail invalide
  Alors un message s'affiche sous le champ, rien n'est envoyé
  Quand le code est faux, expiré ou trop essayé
  Alors la phrase correspondante s'affiche et je peux redemander un code
  Quand la connexion Google échoue (retour ?erreur=…)
  Alors la page l'explique en une phrase

Scénario : déjà connectée
  Quand j'ouvre /connexion en étant connectée
  Alors je suis renvoyée vers /projets
```

### US-8 : Profil dans la coque et page Mon compte

En tant que Camille connectée, je veux voir qui je suis, gérer mon compte et me déconnecter.

Priorité **P0** (profil, déconnexion) / **P1** (nom, suppression) · Effort **M**

```gherkin
Scénario : barre latérale
  Étant donné que je suis anonyme
  Alors le bloc du bas affiche « Sans compte » et un lien « Se connecter » vers /connexion
  Étant donné que je suis connectée
  Alors il affiche mes initiales (ou mon image), mon nom (ou mon e-mail) et un lien « Mon compte »

Scénario : Mes projets
  Étant donné que je suis anonyme
  Alors la carte « Retrouvez vos projets sur tous vos appareils » a un bouton « Créer mon compte » actif vers /connexion
  Étant donné que je suis connectée
  Alors la carte dit que la synchronisation arrive bientôt (sans bouton)

Scénario : Mon compte
  Quand j'ouvre /compte connectée
  Alors je vois mon e-mail, mon nom modifiable (enregistré sur Entrée ou bouton), mes méthodes de connexion (Google, Apple, e-mail), « Se déconnecter » et « Supprimer mon compte » (confirmation explicite)
  Quand j'ouvre /compte anonyme
  Alors je suis renvoyée vers /connexion

Scénario : suppression
  Quand je confirme la suppression
  Alors le compte et ses sessions sont supprimés, je suis anonyme sur /projets ; si la session est trop ancienne, un message me demande de me reconnecter d'abord
```

## Contrats HTTP

Base : l'origine du site, préfixe `/api`. Cookies : `HttpOnly`, `SameSite=Lax`, `Secure` hors développement, durée 7 jours renouvelée chaque jour.

| Route                                                | Corps / réponse                                                                                       |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `GET /api/comptes/sante`                             | `200 { ok: true, version, environnement }`                                                            |
| `GET /api/comptes/fournisseurs`                      | `200 { email: boolean, google: boolean, apple: boolean }`                                            |
| `POST /api/auth/email-otp/send-verification-otp`     | `{ email, type: 'sign-in' }` → `200 { success: true }` ; `400` e-mail invalide ; `429`                |
| `POST /api/auth/sign-in/email-otp`                   | `{ email, otp }` → `200 { token, user }` + cookie ; `400 INVALID_OTP / OTP_EXPIRED / TOO_MANY_ATTEMPTS` |
| `POST /api/auth/sign-in/social`                      | `{ provider: 'google' \| 'apple', callbackURL, errorCallbackURL }` → `200 { url, redirect: true }`    |
| `GET /api/auth/callback/:provider`                   | `302` vers `callbackURL` (cookie posé) ou `errorCallbackURL?error=…`                                  |
| `GET /api/auth/get-session`                          | `200 { session, user }` ou `200 null`                                                                 |
| `POST /api/auth/sign-out`                            | `200 { success: true }`                                                                               |
| `POST /api/auth/update-user`                         | `{ name }` → `200 { status: true }`                                                                   |
| `GET /api/auth/list-accounts`                        | `200 [{ id, providerId, accountId, createdAt, … }]`                                                   |
| `POST /api/auth/delete-user`                         | `200 { success: true }` ; `400 SESSION_NOT_FRESH` si la session date de plus d'un jour                |
| Erreurs `apps/comptes`                               | `{ code }` : `404 INTROUVABLE`, `500 ERREUR_INTERNE` ; Better Auth : `{ code, message }`              |

Les routes `/api/auth/*` sont celles de Better Auth (préfixe `basePath = /api/auth`), documentées ici pour les tests ; l'interface passe par le client Better Auth, jamais par `fetch` à la main.

## Modèle de données (D1, tables Better Auth)

```
user          id TEXT PK · name TEXT · email TEXT UNIQUE · emailVerified INTEGER · image TEXT? · createdAt · updatedAt
session       id TEXT PK · token TEXT UNIQUE · expiresAt · ipAddress? · userAgent? · userId → user (cascade) · createdAt · updatedAt
account       id TEXT PK · accountId · providerId ('google' | 'apple' | 'credential'…) · userId → user (cascade) · accessToken? · refreshToken? · idToken? · accessTokenExpiresAt? · refreshTokenExpiresAt? · scope? · password? · createdAt · updatedAt
verification  id TEXT PK · identifier · value · expiresAt · createdAt · updatedAt
```

Le SQL exact est généré par Better Auth (US-4) et versionné dans `apps/comptes/migrations/0001_comptes.sql`. Identifiants générés côté application (base62). Aucune donnée d'annonce, aucun projet : la synchronisation viendra avec sa propre migration.

## Variables et secrets (`apps/comptes`)

| Nom                                             | Où                              | Rôle                                                              |
| ----------------------------------------------- | ------------------------------- | ----------------------------------------------------------------- |
| `ENVIRONNEMENT`                                 | vars                            | `dev` / `preview` / `production`                                  |
| `BETTER_AUTH_SECRET`                            | secret                          | signature des cookies et jetons (≥ 32 caractères)                 |
| `RESEND_API_KEY`, `COURRIEL_EXPEDITEUR`         | secret, var                     | envoi des codes (absents en dev : journal)                        |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`      | var, secret                     | bouton Google                                                     |
| `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | var, var, var, secret | bouton Apple                                        |
| Binding `DB`                                    | D1                              | base des comptes                                                  |

## MoSCoW

| Story | Priorité | Effort | Dépend de     |
| ----- | -------- | ------ | ------------- |
| US-1  | Must     | S      | —             |
| US-2  | Must     | M      | US-1          |
| US-3  | Must (Google) / Should (Apple) | S | US-2 |
| US-4  | Must     | M      | US-2          |
| US-5  | Must     | S      | US-1          |
| US-6  | Must     | S      | US-2, US-3    |
| US-7  | Must     | M      | US-6          |
| US-8  | Must (profil, déconnexion) / Should (nom, suppression) | M | US-6 |

Ordre d'implémentation : US-1 → US-2 → US-3 → US-4 → US-5 → US-6 → US-7 → US-8. Effort total : ~L (une session).

## Auto-revue

- **Ce qui pourrait être faux** : les noms exacts des routes et codes d'erreur de Better Auth 1.7 (vérifiés dans le paquet installé pendant l'architecture, et par les tests) ; la faisabilité d'un test Miniflare + D1 en Node (repli : SQLite Node si Miniflare ne se lance pas dans Vitest).
- **Ce qui a changé après relecture** : `fournisseurs` renvoie aussi `email` (faux en production sans clé Resend) pour que la page ne propose jamais une méthode qui échouerait ; l'écran Mes projets connecté annonce « synchronisation bientôt » au lieu de laisser un bouton mort ; la suppression du compte exige une session fraîche (comportement par défaut de Better Auth) plutôt qu'une vérification par e-mail, pour rester simple.
- **Limites assumées** : pas de changement d'e-mail, pas de liaison manuelle d'un second fournisseur (Better Auth relie automatiquement les comptes Google/Apple à un utilisateur existant si l'e-mail est vérifié), pas d'envoi d'e-mail réel avant la vérification du domaine chez Resend.
