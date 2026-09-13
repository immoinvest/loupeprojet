# Architecture — `comptes` : connexion Google, Apple, code e-mail

Specs : `.product/specs/comptes-specs.md` · Décision : `.product/adr/006-comptes-better-auth.md`.

## Vue d'ensemble

```
Navigateur (apps/web, SPA)                      Cloudflare Pages (une seule origine)
┌────────────────────────────┐    /api/auth/*      ┌──────────────────────────────────┐
│ /connexion  /compte        │ ─────────────────▶ │ dist/_worker.js  (= apps/comptes) │
│ barre latérale (profil)    │ ◀───── cookie ──── │  Hono                             │
│ src/compte/ : ClientCompte │    /api/comptes/*   │   ├ /api/comptes/sante            │
│  ├ reseau.ts (Better Auth  │                     │   ├ /api/comptes/fournisseurs     │
│  │   client + emailOTP)    │                     │   └ /api/auth/*  → Better Auth    │
│  └ memoire.ts (tests)      │    tout le reste    │        (instance par requête)     │
└────────────────────────────┘ ── statique ──────▶ │ _routes.json : include ["/api/*"] │
                                 (_redirects SPA)  └─────┬────────────────┬────────────┘
                                                         ▼                ▼
                                                   D1 « deklic-comptes »  Resend (e-mails)
                                                   user · session ·       Google · Apple (OAuth)
                                                   account · verification
```

Développement : `wrangler dev` sur `apps/comptes` (port 8787, D1 locale, `.dev.vars`) et Vite (`server.proxy['/api'] → 8787`). Production : le build de `apps/web` bundle `apps/comptes` en `dist/_worker.js` (plugin Vite `closeBundle` → `wrangler deploy --dry-run --outdir`).

## Fichiers

### À créer — `apps/comptes` (nouveau workspace `@loupe/comptes`)

```
apps/comptes/
├── package.json             dev (wrangler dev), build (wrangler deploy --dry-run --outdir dist), typecheck, test, test:coverage, migration:generer
├── wrangler.toml            name loupe-comptes, main src/index.ts, compatibility_date, compatibility_flags ["nodejs_compat"], [vars] ENVIRONNEMENT, [[d1_databases]] DB (migrations_dir), [observability]
├── .dev.vars.example        ENVIRONNEMENT=dev, BETTER_AUTH_SECRET, RESEND_API_KEY, COURRIEL_EXPEDITEUR, GOOGLE_*, APPLE_*
├── tsconfig.json            comme apps/worker (types @cloudflare/workers-types) + scripts/
├── vitest.config.ts         name 'comptes', environnement node, tests/**, couverture src/** (hors index.ts)
├── migrations/0001_comptes.sql   généré par Better Auth (getMigrations → compileMigrations) sur une D1 locale
├── scripts/generer-migration.ts  Miniflare D1 vide + optionsAuth → SQL → migrations/0001_comptes.sql
├── src/
│   ├── index.ts             export default { fetch } : creerApp(dependancesDepuisEnv(env)) une fois par isolat ; /api/* → app ; sinon env.ASSETS.fetch (ou 404 en dev)
│   ├── app.ts               creerApp(deps) : GET /api/comptes/sante, GET /api/comptes/fournisseurs, app.on(['GET','POST'], '/api/auth/*', → auth(origine).handler(requête)), notFound, onError
│   ├── dependances.ts       Bindings (DB: D1Database, ASSETS?, variables) ; VariablesSchema (Zod) ; Dependances ; dependancesDepuisEnv(env)
│   ├── auth.ts              optionsAuth(deps, origine) : BetterAuthOptions ; creerAuth(deps) : (origine) => Auth (cache par origine)
│   ├── fournisseurs.ts      ConfigFournisseurs (google?, apple?) depuis les variables ; disponibles(deps) → { email, google, apple } ; secretClientApple(config, maintenant) (jose, ES256, 180 jours)
│   ├── courriel.ts          Envoyeur { envoyer(message) } ; envoyeurResend(cle, expediteur, fetcher) ; envoyeurJournal(journal) ; messageCode(code) (sujet, texte, html en français)
│   ├── journal.ts           journal structuré (copie de apps/worker : la seule console autorisée) + journalMemoire
│   └── erreurs.ts           CodeErreur ('INTROUVABLE' | 'ERREUR_INTERNE'), reponseErreur, ErreurConfiguration
└── tests/
    ├── aide.ts              banc(surcharges) : memoryAdapter, envoyeur mémoire (garde les codes), journal mémoire, horloge, jarre à cookies
    ├── app.test.ts          santé, fournisseurs (selon config), 404, 500 + journal, index.ts (routage /api vs ASSETS)
    ├── auth.test.ts         flux code complet (envoi → cookie → session → déconnexion), code faux / expiré / 3 essais, e-mail invalide, 429, update-user, list-accounts, delete-user (session fraîche / ancienne), sign-in/social Google (URL) et fournisseur absent, secret Apple
    ├── modules.test.ts      dependances (Zod, config invalide), fournisseurs, courriel (Resend : requête, erreur HTTP ; journal en dev), erreurs
    └── migration.test.ts    Miniflare D1 : applique 0001_comptes.sql, joue le flux code sur D1 (même code que la production), vérifie les lignes
```

### À créer — `apps/web`

```
apps/web/
├── public/_routes.json                 { "version": 1, "include": ["/api/*"], "exclude": [] }
├── src/compte/
│   ├── types.ts                        Utilisateur, Fournisseurs, CodeErreurCompte, ClientCompte (contrat)
│   ├── reseau.ts                       clientReseau(fetch?) : createAuthClient (better-auth/client + emailOTPClient) → ClientCompte ; traduction des erreurs en codes
│   ├── memoire.ts                      clientMemoire(options) : double déterministe pour les tests (code attendu, fournisseurs, utilisateur initial)
│   └── CompteContext.tsx               CompteProvider({ client }) : etat 'chargement' | 'anonyme' | 'connecte', utilisateur, actions ; useCompte()
├── src/textes/compte.ts                phrases des codes d'erreur, libellés des fournisseurs, initiales(nom)
├── src/ecrans/Connexion.tsx            page classique (hors coque) : logotype, boutons, e-mail → code, erreurs, retour
├── src/ecrans/Compte.tsx               page Mon compte (dans la coque) : e-mail, nom, méthodes, déconnexion, suppression
├── src/coque/Profil.tsx                bloc bas de la barre latérale (anonyme / connecté)
└── tests/compte.test.tsx, tests/connexion.test.tsx  (+ ajustements de app.test.tsx)
```

### À modifier

| Fichier                              | Changement                                                                                                           |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `apps/web/package.json`              | dépendance `better-auth` (client), devDependency `wrangler` (bundle du worker)                                        |
| `apps/web/vite.config.ts`            | `server.proxy['/api']` → `http://localhost:8787` ; plugin `workerPages()` (closeBundle : bundle `apps/comptes` → `dist/_worker.js`) |
| `apps/web/wrangler.toml`             | `compatibility_flags = ["nodejs_compat"]`, `[vars]`, `[[d1_databases]]` DB (id à renseigner)                          |
| `apps/web/src/App.tsx`               | routes `/connexion` (hors coque) et `/compte` ; `CompteProvider` (réseau) ; `AppEnMemoire({ compte })`               |
| `apps/web/src/coque/Sidebar.tsx`     | bloc profil → `<Profil />`                                                                                           |
| `apps/web/src/ecrans/MesProjets.tsx` | carte « Créer mon compte » active (lien `/connexion`) ; connectée : « synchronisation bientôt »                     |
| `vitest.config.ts` (racine)          | seuils 100 % : `apps/comptes/src/**`, `apps/web/src/compte/**` (+ `textes` déjà couvert)                             |
| `eslint.config.js` (racine)          | `no-console` off pour `apps/comptes/src/journal.ts` (une ligne)                                                      |
| `.claude/launch.json`                | configuration `comptes` (`npm run dev -w apps/comptes`, port 8787)                                                   |
| Docs (fin)                           | README (mise en place), CLAUDE.md, technical-spec, functional-spec, architecture-overview, registre, `_commun.md`     |

## Interfaces

```ts
// apps/comptes/src/dependances.ts
export interface Bindings {
  readonly DB: D1Database;
  readonly ASSETS?: { fetch(requete: Request): Promise<Response> } | undefined;
  readonly ENVIRONNEMENT?: string; readonly BETTER_AUTH_SECRET?: string;
  readonly RESEND_API_KEY?: string; readonly COURRIEL_EXPEDITEUR?: string;
  readonly GOOGLE_CLIENT_ID?: string; readonly GOOGLE_CLIENT_SECRET?: string;
  readonly APPLE_CLIENT_ID?: string; readonly APPLE_TEAM_ID?: string; readonly APPLE_KEY_ID?: string; readonly APPLE_PRIVATE_KEY?: string;
  readonly ORIGINES_AUTORISEES?: string;
}
export interface Dependances {
  readonly environnement: 'dev' | 'preview' | 'production';
  readonly secret: string;                         // ≥ 32 caractères (BETTER_AUTH_SECRET) ; en dev, valeur par défaut
  readonly base: BetterAuthOptions['database'];    // D1Database en production, memoryAdapter en test
  readonly fournisseurs: ConfigFournisseurs;       // { google?: { clientId, clientSecret }, apple?: { clientId, teamId, keyId, privateKey } }
  readonly courriel: Envoyeur | null;              // null → journal (dev) ; Resend en production
  readonly origines: readonly string[];            // origines de confiance supplémentaires
  readonly journal: Journal;
  readonly maintenant: () => number;
}

// apps/comptes/src/auth.ts
export function optionsAuth(deps: Dependances, origine: string): BetterAuthOptions; // baseURL = origine, basePath '/api/auth'
export function creerAuth(deps: Dependances): (origine: string) => ReturnType<typeof betterAuth>;

// apps/web/src/compte/types.ts
export interface Utilisateur { readonly id: string; readonly nom: string; readonly email: string; readonly image: string | null; }
export interface Fournisseurs { readonly email: boolean; readonly google: boolean; readonly apple: boolean; }
export type CodeErreurCompte = 'email_invalide' | 'code_invalide' | 'code_expire' | 'trop_essais' | 'trop_de_demandes' | 'session_ancienne' | 'fournisseur_indisponible' | 'reseau' | 'inconnue';
export type Resultat<T = void> = { ok: true; valeur: T } | { ok: false; code: CodeErreurCompte };
export interface ClientCompte {
  session(): Promise<Utilisateur | null>;
  fournisseurs(): Promise<Fournisseurs>;
  demanderCode(email: string): Promise<Resultat>;
  verifierCode(email: string, code: string): Promise<Resultat<Utilisateur>>;
  continuerAvec(fournisseur: 'google' | 'apple', retour: string): Promise<Resultat>; // redirige le navigateur
  deconnecter(): Promise<void>;
  renommer(nom: string): Promise<Resultat<Utilisateur>>;
  methodes(): Promise<readonly string[]>;   // providerId des comptes liés
  supprimer(): Promise<Resultat>;
}
```

## Options Better Auth (décisions)

| Option                    | Valeur                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `database`                | le binding D1 tel quel (Better Auth 1.7 détecte `prepare/batch/exec` et utilise son dialecte D1, sans transaction) ; `memoryAdapter` en test |
| `baseURL` / `basePath`    | origine de la requête / `/api/auth`                                                                                |
| `secret`                  | `BETTER_AUTH_SECRET` (obligatoire hors dev)                                                                        |
| `trustedOrigins`          | `https://loupeprojet.pages.dev`, `https://*.loupeprojet.pages.dev`, `http://localhost:5173`, `http://localhost:8787`, `https://appleid.apple.com`, + `ORIGINES_AUTORISEES` |
| `plugins`                 | `emailOTP({ otpLength: 6, expiresIn: 600, allowedAttempts: 3, sendVerificationOTP })` — envoi seulement pour `type === 'sign-in'` |
| `socialProviders`         | `google` (`prompt: 'select_account'`) et `apple` (secret JWT ES256 généré et mis en cache) seulement si configurés |
| `session`                 | défauts (7 jours, renouvelée après 1 jour, `freshAge` 1 jour)                                                      |
| `user.deleteUser`         | `{ enabled: true }` (session fraîche exigée)                                                                       |
| `account.accountLinking`  | défaut (liaison automatique quand le fournisseur confirme l'e-mail)                                                |
| `rateLimit`               | `enabled: true`, fenêtre 60 s / 60 requêtes ; le plugin impose 3/min sur l'envoi de codes                          |
| `advanced`                | `cookiePrefix: 'deklic'`, `useSecureCookies: origine https`, `ipAddress.ipAddressHeaders: ['cf-connecting-ip']`   |
| `logger`                  | routé vers le journal JSON (niveau warn+), messages seuls                                                          |
| `emailAndPassword`        | désactivé (défaut)                                                                                                 |

## Flux

```
Code e-mail : page /connexion → client.demanderCode(email) → POST /api/auth/email-otp/send-verification-otp
   → Better Auth crée une vérification (identifiant sign-in-otp:<email>, valeur code:essais) → sendVerificationOTP → Envoyeur (Resend | journal)
   → client.verifierCode(email, code) → POST /api/auth/sign-in/email-otp → utilisateur créé si absent (e-mail vérifié) → session en base → Set-Cookie deklic.session_token
   → CompteProvider passe à 'connecte' → navigation vers la page d'origine

Google : client.continuerAvec('google', '/projets') → POST /api/auth/sign-in/social { provider, callbackURL, errorCallbackURL: '/connexion?erreur=fournisseur' }
   → { url } → redirection navigateur → Google → GET /api/auth/callback/google?code&state → compte lié ou créé → cookie → 302 callbackURL

Ouverture de l'app : CompteProvider → client.session() → GET /api/auth/get-session → 'anonyme' | 'connecte'
```

## Sécurité

- Cookies `HttpOnly`, `SameSite=Lax`, `Secure` sur https ; jeton de session opaque en base, jamais dans `localStorage`.
- Origine vérifiée par Better Auth sur toute requête POST (`Origin` ∈ baseURL + trustedOrigins) ; `callbackURL` restreinte aux origines de confiance.
- Codes : 6 chiffres, 10 minutes, 3 essais, 3 envois/minute/IP ; `sign-in/email-otp` limité par la fenêtre globale.
- Journal : événements sans e-mail, sans code, sans IP (le journal de dev écrit le code, en dev seulement).
- Secrets uniquement dans les variables du worker ; le client ne voit que `fournisseurs` (booléens).
- Aucune suppression sans session fraîche ; suppression en cascade des sessions et comptes liés.

## Ordre d'implémentation

1. US-1 socle `apps/comptes` (package, wrangler, deps, app, journal, erreurs, tests) → commit
2. US-2 Better Auth + code e-mail (auth.ts, courriel.ts, tests du flux) → commit
3. US-3 Google et Apple (fournisseurs.ts, secret Apple, tests) → commit
4. US-4 D1 (script de génération, migration SQL, test Miniflare) → commit
5. US-5 déploiement (vite plugin, `_routes.json`, wrangler Pages, proxy, launch.json) → commit
6. US-6 client web (`src/compte/`, textes, provider, tests) → commit
7. US-7 page `/connexion` → commit
8. US-8 profil + `/compte` + Mes projets → commit
9. Refactor, QA, audit, docs, PR.

## Risques et parades

| Risque                                                            | Parade                                                                                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Miniflare ne démarre pas dans Vitest (workerd sous Windows)       | Test D1 dans un fichier séparé ; repli : dialecte `node:sqlite` de `@better-auth/kysely-adapter`        |
| `_worker.js` non pris en charge par le projet Pages (flags, D1)   | Documenter le tableau de bord (Bindings, Compatibility flags) en plus de `wrangler.toml`                |
| Instance Better Auth par requête coûteuse                         | Cache par origine dans l'isolat (bindings stables)                                                      |
| Cookie non `Secure` en production                                 | `useSecureCookies` calculé sur l'origine https, vérifié par un test                                     |
| Conflit `package-lock.json` avec les PR parallèles                | `git merge origin/master` + `npm install` avant l'auto-merge                                            |

## Pré-implémentation

- [x] Aucun conflit avec le code existant (nouveau workspace ; `apps/web` touché sur la coque, App, Mes projets ; fichiers des autres sessions intacts)
- [x] Patterns du dépôt : `creerApp(deps)`, journal, codes d'erreur, `AppEnMemoire`, `Carte`/`Bouton`/`Pastille`
- [x] Migration versionnée (montée seulement : D1 n'a pas de « down » ; une suppression de table serait une migration séparée)
- [x] Aucun changement des routes existantes
- [x] Entrées validées (Zod pour l'environnement, Better Auth pour les corps), auth appliquée par Better Auth
- [x] Aucun fichier > 300 lignes prévu ; fonctions courtes
- [x] Cas limites listés : e-mail invalide, code faux/expiré/épuisé, 429, fournisseur absent, session ancienne, ASSETS absent, secret manquant hors dev
