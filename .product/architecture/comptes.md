# Architecture — `comptes` : connexion Google, Apple, code e-mail

Specs : `.product/specs/comptes-specs.md` · Décision : `.product/adr/006-comptes-better-auth.md` · État : `.product/pipeline/comptes.json`.

## Vue d'ensemble

```
Navigateur (apps/web, SPA)                         Cloudflare Pages (une seule origine)
┌───────────────────────────────┐   /api/auth/*     ┌─────────────────────────────────────────┐
│ /connexion (hors coque)       │ ────────────────▶ │ dist/_worker.js = apps/comptes          │
│ /compte, profil (barre)       │ ◀──── cookie ──── │  index.ts : /api/* → app, sinon ASSETS  │
│ src/compte/                   │   /api/comptes/*  │  app.ts (Hono)                          │
│  reseau.ts  fetch + Zod       │                   │   ├ GET /api/comptes/sante              │
│  memoire.ts double de test    │                   │   ├ GET /api/comptes/fournisseurs       │
│  CompteContext.tsx            │   tout le reste   │   └ /api/auth/* → garde → Better Auth   │
└───────────────────────────────┘ ── statique ────▶ │ _routes.json : include ["/api/*"]       │
                                    (_redirects)     └──────┬───────────────────┬──────────────┘
                                                            ▼                   ▼
                                                  D1 « deklic-comptes »     Resend (codes)
                                                  user · session ·          Google · Apple (OAuth)
                                                  account · verification
```

- Production : `DEKLIC_COMPTES=1` (variable de build Pages) fait déposer `dist/_worker.js` par le build de `apps/web` (plugin Vite `workerDesComptes` : `wrangler deploy --dry-run` dans `apps/comptes`). Sans cette variable, pas de worker : le site se déploie sans flag `nodejs_compat` ni base, et le client voit la connexion « indisponible ».
- Développement : `npm run dev -w apps/comptes` (migrations D1 locales puis `wrangler dev` sur 8787) et `npm run dev -w apps/web` (Vite relaie `/api` vers 8787).

## `apps/comptes` (`@loupe/comptes`)

```
src/
├── index.ts         creerGestionnaire : /api/* → application (construite une fois par isolat) ; configuration
│                    incomplète → 503 CONFIGURATION_INCOMPLETE (journalisé) ; le reste → env.ASSETS (ou 404)
├── app.ts           creerApp(deps) : sante, fournisseurs (Cache-Control: no-store), garde puis Better Auth, 404, 500
├── garde.ts         avant Better Auth : hôte connu (origineConnue, * = un sous-domaine), liste blanche ROUTES_AUTH,
│                    demande de code : envoyeur présent (503) et type « sign-in » seulement (400)
├── auth.ts          optionsAuth(deps, origine) ; creerAuth : une instance par origine (8 au plus) ; envoyerCode
│                    (échec journalisé sans l'adresse) ; masquerCourriels pour le journal de Better Auth
├── sociaux.ts       fournisseursSociaux (Google prompt select_account ; Apple : secret signé, clé illisible → Apple
│                    désactivé) ; originesDeConfiance (+ appleid.apple.com si Apple)
├── fournisseurs.ts  lireConfigFournisseurs (tout ou rien par fournisseur), disponibles, secretClientApple (JWT ES256, 180 j)
├── courriel.ts      Envoyeur ; envoyeurResend (POST api.resend.com/emails) ; envoyeurJournal (dev) ; messageCode
├── dependances.ts   Bindings → Dependances ; variables validées par Zod ; ENVIRONNEMENT = production par défaut
│                    (secret exigé, pas d'origine locale) ; binding DB exigé
├── erreurs.ts       codes (INTROUVABLE, ORIGINE_INCONNUE, TYPE_NON_PRIS_EN_CHARGE, COURRIEL_INDISPONIBLE,
│                    CONFIGURATION_INCOMPLETE, ERREUR_INTERNE), reponseErreur, ErreurConfiguration, messageDe
└── journal.ts       une ligne JSON par événement ; journalMemoire pour les tests
migrations/0001_comptes.sql   tables Better Auth, générée par scripts/generer-migration.ts (npm run migration:generer)
scripts/migration.ts          compilerMigration (getMigrations sur node:sqlite vide), contenuMigration, lireMigration
types/                        alias WebCrypto et fetch pour typer Better Auth sous Node ; stub bun:sqlite
tests/                        aide.ts (banc : base mémoire, envoyeur mémoire, jarre à cookies, IP unique par banc),
                              d1.ts (D1 simulée sur node:sqlite, contrôles de types de D1), app, auth, fournisseurs,
                              modules, migration (fichier = schéma attendu ; parcours complet à travers l'interface D1)
```

### Options Better Auth

| Option                 | Valeur                                                                                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `database`             | le binding D1 (Better Auth 1.7 le détecte et prend son dialecte D1, sans transaction) ; mémoire en test                                                        |
| `baseURL` / `basePath` | origine de la requête (vérifiée par la garde) / `/api/auth`                                                                                                    |
| `trustedOrigins`       | `https://loupeprojet.pages.dev`, `https://*.loupeprojet.pages.dev`, localhost:5173 et 8787 en dev, `ORIGINES_AUTORISEES`, `https://appleid.apple.com` si Apple |
| `plugins`              | `emailOTP` : 6 chiffres, 600 s, 3 essais                                                                                                                       |
| `rateLimit`            | activé, 60 requêtes/min par IP ; plugin : 3 envois/min ; règle `/sign-in/email-otp` : 10 saisies/min                                                           |
| `user.deleteUser`      | activé ; session de moins d'un jour (sinon 400 `SESSION_EXPIRED`)                                                                                              |
| `advanced`             | `cookiePrefix: deklic`, `useSecureCookies` si https, IP = `cf-connecting-ip`, `disableOriginCheck: false` explicite                                            |
| `telemetry` / `logger` | désactivée / niveau warn, messages masqués (adresses e-mail) vers le journal                                                                                   |

### Contrat HTTP

| Route                                                                                                                                                                    | Réponse                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/comptes/sante`                                                                                                                                                 | `{ ok, version, environnement }`                                                                                                         |
| `GET /api/comptes/fournisseurs`                                                                                                                                          | `{ email, google, apple }`                                                                                                               |
| `POST /api/auth/email-otp/send-verification-otp`                                                                                                                         | `{ email, type: 'sign-in' }` → `{ success: true }` ; 400 `TYPE_NON_PRIS_EN_CHARGE` / `INVALID_EMAIL` ; 429 ; 503 `COURRIEL_INDISPONIBLE` |
| `POST /api/auth/sign-in/email-otp`                                                                                                                                       | `{ email, otp }` → `{ token, user }` + cookie ; 400 `INVALID_OTP` / `OTP_EXPIRED` / `TOO_MANY_ATTEMPTS`                                  |
| `POST /api/auth/sign-in/social`                                                                                                                                          | `{ provider, callbackURL, errorCallbackURL }` → `{ url, redirect }` ; 404 `PROVIDER_NOT_FOUND` ; 403 URL de retour étrangère             |
| `GET /api/auth/callback/google`, `GET` et `POST /api/auth/callback/apple`                                                                                                | redirection vers `callbackURL` (cookie posé) ou `errorCallbackURL?error=…`                                                               |
| `GET /api/auth/get-session`, `POST /api/auth/sign-out`, `POST /api/auth/update-user`, `GET /api/auth/list-accounts`, `POST /api/auth/delete-user`, `GET /api/auth/error` | Better Auth                                                                                                                              |
| Toute autre route `/api/auth/*`                                                                                                                                          | 404 `INTROUVABLE` (mot de passe, changement d'adresse… fermés) ; hôte inconnu : 403 `ORIGINE_INCONNUE`                                   |

## `apps/web`

```
src/compte/types.ts          Utilisateur, Fournisseurs, CodeErreurCompte, Resultat, ClientCompte
src/compte/reseau.ts         clientReseau(recuperer, naviguer) : fetch same-origin, réponses validées par Zod, codes serveur → codes
                             de l'interface (429 → trop_de_demandes, 5xx → indisponible), panne → session nulle, aucun fournisseur
src/compte/memoire.ts        clientMemoire(options) : code 123456, erreurs forcées, redirections et codes demandés enregistrés
src/compte/CompteContext.tsx CompteProvider (session et fournisseurs lus au lancement ; état chargement / anonyme / connecté), useCompte
src/compte/saisie.ts         emailPlausible, normaliserCode, codeComplet, cheminDeRetour (interne uniquement)
src/textes/compte.ts         phrases des erreurs, noms des fournisseurs, initiales, nomAffiche
src/textes/connexion.ts      textes de la page de connexion ; src/textes/mon-compte.ts : profil, Mon compte, carte de Mes projets
src/ecrans/Connexion.tsx     page hors coque ; connexion/ : BoutonsFournisseurs, FormulaireEmail, FormulaireCode, styles
src/ecrans/Compte.tsx        profil (nom), méthodes liées, déconnexion, suppression confirmée, reconnexion si session ancienne
src/coque/Profil.tsx         bas de la barre latérale : « Sans compte » + bouton « Se connecter » (icône), ou initiales, nom, « Mon compte » + bouton icône « Se déconnecter » toujours visible ; la page Mon compte a aussi « Se déconnecter » en haut à droite
src/composants/IconesFournisseurs.tsx   « G » de Google, pomme d'Apple
vite.config.ts               proxy /api → 8787 ; plugin workerDesComptes (opt-in DEKLIC_COMPTES=1)
dist/_routes.json            include ["/api/*"], écrit par le plugin avec _worker.js (rien sans DEKLIC_COMPTES=1)
```

`App` fournit `CompteProvider` avec `clientReseau()` ; `AppEnMemoire` avec un client mémoire anonyme (ou celui du test). Couverture 100 % exigée sur `src/compte/**` et `src/textes/**`.

## Décisions prises pendant l'implémentation

- **Garde avant Better Auth** : Better Auth avale les erreurs lancées par `sendVerificationOTP` et répond « envoyé » ; le refus des autres types de code et l'absence d'envoyeur sont donc traités avant lui. La liste blanche ferme les routes inutilisées (mot de passe, changement d'adresse, vérification par lien).
- **Contrôle d'origine explicite** : Better Auth le désactive quand il détecte un environnement de test ; `disableOriginCheck: false` rend le comportement testé identique à la production.
- **Échec fermé** : sans `ENVIRONNEMENT`, c'est la production ; sans secret ou sans base, `/api/*` répond 503 et le site reste servi.
- **D1 simulée** : Miniflare 5 (alpha) et `getPlatformProxy` ne démarrent pas sur la machine de développement ; la migration et le parcours complet sont testés à travers une D1 simulée sur `node:sqlite` qui refuse les mêmes types que D1. Miniflare retiré des dépendances.
- **Client web sans bibliothèque** : fetch + Zod sur les routes Better Auth plutôt que le client Better Auth : aucune dépendance ajoutée au site, réponses validées, erreurs traduites en codes.
- **Pas d'image tierce** : le profil affiche des initiales, jamais la photo Google (aucune ressource tierce chargée).
- **Worker opt-in** : le bundle importe `node:crypto` (utilitaires de Better Auth) ; Pages refuserait le déploiement sans `nodejs_compat`. `DEKLIC_COMPTES=1` évite de casser les déploiements de `master` avant la mise en service.

## Tests

| Où                                        | Quoi                                                                                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/comptes/tests/app.test.ts`          | santé, fournisseurs, 404, 500 journalisé, gestionnaire Pages (API, statique, configuration incomplète)                                   |
| `apps/comptes/tests/auth.test.ts`         | parcours code complet, code faux / expiré / épuisé, 429, 503, types refusés, échec d'envoi, CSRF, cookie https, garde, gestion du compte |
| `apps/comptes/tests/fournisseurs.test.ts` | secret Apple (JWT vérifié), URL Google et Apple, clé illisible, fournisseur absent, URL de retour étrangère                              |
| `apps/comptes/tests/modules.test.ts`      | variables et dépendances, origines connues, courriel (Resend, journal), erreurs, journal                                                 |
| `apps/comptes/tests/migration.test.ts`    | fichier = schéma attendu, application sur base vide, parcours complet à travers l'interface D1                                           |
| `apps/web/tests/compte.test.tsx`          | client réseau (toutes les routes et erreurs), client mémoire, textes, CompteProvider                                                     |
| `apps/web/tests/saisie.test.ts`           | adresse plausible, code, chemin de retour                                                                                                |
| `apps/web/tests/connexion.test.tsx`       | page de connexion : méthodes proposées, code, renvoi, Google/Apple, erreurs, retour, déjà connecté                                       |
| `apps/web/tests/profil.test.tsx`          | profil de la barre latérale, carte de Mes projets, page Mon compte (renommage, déconnexion, suppression)                                 |
