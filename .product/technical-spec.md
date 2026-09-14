# Deklic — Spécification technique

Stack : voir `adr/001-stack.md`. Ce document décrit la structure et les conventions ; il est mis à jour à chaque feature (Rule 8).

## Monorepo

```
loupeprojet/
├── package.json            workspaces: ["packages/*", "apps/*", "data"] ; scripts lint / format / typecheck / test / test:coverage / build
├── tsconfig.base.json      strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, ES2022, bundler resolution
├── tsconfig.json           couvre les fichiers de config racine (ESLint type-checked)
├── eslint.config.js        typescript-eslint strict-type-checked + stylistic, no-console, max-lines 300, prettier
├── marque/                 identité de marque Deklic (ADR-005) : logos SVG, favicon, icônes, image de partage, palette, guide
├── .prettierrc             printWidth 100, singleQuote, trailingComma all, LF
├── vitest.config.ts        projets = packages/*, apps/*, data ; seuils 100 % moteur, capture, worker, comptes, extension, data, modules de logique du web
├── .github/workflows/ci.yml  Node 22 : npm ci → lint → format:check → typecheck → test:coverage → build ; job e2e : Playwright Chromium (npm run test:e2e)
├── .github/workflows/referentiels.yml  cron mensuel + manuel : génère data/dist puis aws s3 sync vers R2 deklic-data
├── packages/moteur/        ← livré (feature moteur-calcul)
├── packages/capture/       ← livré (feature extension) : contrat de capture et moteur de règles, partagés par l'extension, le favori et le web
├── apps/web/               ← livré (socle, nouveau projet, hypothèses, onglets, lecture de la capture, bouton-favori, page /extension, garder) ; e2e Playwright
├── apps/worker/            ← socle livré (feature worker-socle)
├── apps/comptes/           ← livré (feature comptes) : Better Auth sur Hono, servi par le worker Pages, D1
├── apps/extension/         ← livré (feature extension) : WebExtension MV3, règles par portail, build esbuild vers dist/chrome et dist/firefox
└── data/                   ← livré (feature referentiels) : pré-agrégation des référentiels publics
```

## `packages/moteur` (livré)

```
src/
├── index.ts                 API publique
├── calculer-projet.ts       calculerProjet(entree, { avecScenarios }) : Zod parse → règles → base → scénarios → meta
├── calculer-base.ts         financement → fiscalité → revente → rendement → verdict (sans scénarios)
├── schema/                  bien, marche, hypotheses, projet (entrée) ; resultats (sortie, strictObject)
├── regles/                  types.ts, 2026-09.ts (toutes les constantes datées, aConfirmer, simplifications), index.ts
├── commun/                  arrondi, résolution par bissection, VAN, erreurs nommées
├── financement/             frais-acquisition, mensualite, amortissement (différés), taeg, effort (HCSF), ira
├── cashflow/                recettes (3 modes), charges (par régime), point mort, couverture, projection annuelle
├── fiscalite/               amortissements, deficits, interets, micro-bic, lmnp-reel (39 C), micro-foncier, nu-reel, index (4 régimes)
├── revente/                 valeur, plus-value (abattements, surtaxe, réintégration), index
├── rendement/               rendements, tri, enrichissement, index
├── verdict/                 feux (5), vigilance (codes), index
├── scenarios/               prix-cible (3 critères), predefinis (6 transformations), index (deltas)
└── exemples/t3-marseille.ts projet d'exemple
tests/                       un dossier par module + integration/ ; 204 tests ; couverture 100 % lignes/branches/fonctions
```

- TypeScript pur, dépendance runtime unique : Zod. Aucun accès réseau, DOM, date système ou aléatoire.
- Les règles sont toujours **injectées** en paramètre (`regles`), jamais importées dans un module de calcul.
- Fichiers ≤ 300 lignes (ESLint `max-lines`), fonctions courtes, nommage français métier.
- Montants en euros flottants, arrondi explicite à l'affichage (`arrondirEuro`, `arrondirTaux`) ; taux en décimal ; durées nommées (`dureeMois`, `annees`).
- Performance : ~35 ms pour un projet complet (6 scénarios + 3 prix cibles) ; ~5 ms sans scénarios.

## `apps/web` (socle livré)

Voir `architecture/web-socle.md`. React 19 + Vite 7 + Tailwind v4 (`@theme` = tokens ADR-004), React Router 7 déclaratif (`useRoutes`), stockage local Zod (`loupe.projets.v1`), textes des codes du moteur dans `src/textes/`, Vitest + Testing Library (jsdom). Cloudflare Pages : `wrangler.toml`, `public/_redirects`. Couverture 100 % exigée sur `stockage/`, `formatage/`, `textes/`, `compte/` ; les écrans sont couverts par des tests de rendu et de navigation (`AppEnMemoire`). Tests de bout en bout : `apps/web/e2e/` avec Playwright (Chromium, build de production servi par `vite preview` sur 127.0.0.1:5199, sélecteurs par rôle et libellé, contexte neuf par test), `npm run test:e2e` ; voir `architecture/e2e-playwright.md`. Appels au Worker : `src/enrichissement/` (client revalidé par Zod, lecture IA puis règles, enrichissement marché), fourni par le contexte `coque/ClientWorker.tsx` (hors ligne par défaut, donc jamais de réseau en test) ; voir `architecture/enrichissement-marche.md`.

Feature `garder` : voir `architecture/garder.md`. Route `/projets/:id/imprimer` hors coque, rendue sous `ModeDocument` (contexte `composants/document.tsx` : boutons masqués, explications dépliées, grilles à deux colonnes) avec `@media print` dans `index.css` ; partage par fragment d'URL (`stockage/partage.ts`, base64url + Zod, jamais d'exception) ; Comparer (`analyses/comparaison.ts`) ; Méthode générée depuis `obtenirRegles()` (`textes/methode*.ts`, défauts lus par `analyses/defauts.ts`). Couverture 100 % sur ces modules (globs `stockage`, `analyses`, `textes`).

Feature `rapport-cashflow` (fiche de backlog 10) : voir `architecture/rapport-cashflow.md`. Composant `Info` (`composants/info.tsx` : bouton ⓘ de 44 px, bulle `role="tooltip"` absolue sous l'icône, décalage calculé par `decalageBulle` pour tenir dans l'écran, ouverture au clic et au focus, fermeture Échap / clic dehors / perte du focus ; paragraphe en mode document ; pas de `popover` natif, absent de jsdom) ; `LienOnglet` (lien relatif vers un volet, nul en mode document) ; `TitreCarte` avec `info` à côté du `h2` et `action` à droite ; `Pourquoi` supprimé. Dérivés du Rapport dans `analyses/rapport.ts` (`cascadeAutofinancement`, `multipleSurApport`) ; explications chiffrées dans `textes/explications.ts` (fonctions `(r: Resultats) => string`, `EXPLICATIONS` fixes conservées pour Méthode). Tests : `tests/{info,rapport}.test.tsx`, `tests/{rapport-analyses,explications}.test.ts`, variantes de projet partagées dans `tests/projets.ts` ; e2e `e2e/rapport.spec.ts`.

Feature `responsive` : voir `architecture/responsive.md` et ADR-007. Mise en page mobile d'abord (Tailwind `sm` 640, `md` 768, `lg` 1 024, `xl` 1 280, `2xl` 1 536) : tiroir sous `lg` (`coque/menu.ts` : Échap, voile, `inert`, focus rendu), `composants/mise-en-page.tsx` (`Page`, `TitrePage`, `Chapo`, équivalents `print:`), `pointer-coarse:` pour les cibles de 44 px et les champs de 16 px. PWA : manifeste (`id`, `scope`, icônes `maskable`, raccourcis, `share_target` GET vers `/projets/nouveau`), `application/` (suivi de `beforeinstallprompt`, décision de partage natif), service worker IIFE (`vite.hors-ligne.config.ts` → `dist/sw.js`, cache `deklic-<empreinte de index.html>`, stratégies pures dans `hors-ligne/strategie.ts` : navigation en réseau d'abord, annonce partagée coque d'abord, fichiers construits cache d'abord, manifeste et icônes réseau d'abord, `/api/*` ignoré, seule une page HTML gardée comme coque). Couverture 100 % sur `application/` et `hors-ligne/` ; `sw/` prouvé par Playwright.

Feature `coque-fixe` : voir `architecture/coque-fixe.md`. Coque « application » : `AppLayout` en `h-dvh overflow-hidden` (grille `[var(--largeur-menu)_1fr]` à partir de `lg`, `--largeur-menu: 14rem` dans `index.css`), `main` seul conteneur qui défile (`coque/contenu.ts` : `scrollTop = 0` à chaque changement de `pathname`), barre latérale en trois zones (seule la liste des projets défile). En-tête de projet `sticky` compact ; `coque/entete.ts` publie par `ResizeObserver` les variables `--decalage-entete` (début de la bande des volets, `top` négatif sous `md`) et `--hauteur-entete-projet` (partie en vue, `top` de la synthèse d'Hypothèses) sur le cadre `[data-cadre-projet]` ; sans observateur, rien n'est publié (défauts `0px`). La spec des formats (`e2e/formats.ts`) mesure le débordement de `main` et ne l'excuse pas comme conteneur qui défile.

## `apps/worker` (socle livré)

Voir `architecture/worker-socle.md`. Hono 4 sur Cloudflare Workers (`wrangler.toml` : KV `KV_CACHE`, binding Rate Limiting `LIMITEUR` 60/min/IP, `[observability]`), dépendances injectées (`creerApp(deps)`), `GET /health`, `GET /proxy/:service` avec liste blanche de services (`services/`), cache KV par empreinte des paramètres validés, réponses amont validées et normalisées au contrat Loupe, erreurs en codes. Premier service : géocodage Géoplateforme. `POST /extract` : lecture du texte d'une annonce par un modèle de langage (connecteur « chat completions », OpenRouter par défaut), 22 champs validés un par un, cache 30 jours (voir `architecture/extraction-llm.md`). `GET /marche` : médiane DVF, loyer ANIL et zone ABC d'une commune, lus sur R2 (binding `DONNEES`, bucket `deklic-data` en juridiction UE) et assemblés par une fonction pure (voir `architecture/enrichissement-marche.md`). `GET /marche/adresse` : ventes du CSV de la commune classées autour d'une adresse précise (même parcelle, parcelles voisines via l'API Carto cadastre de l'IGN, même côté et en face par code de voie et parité, cercles de 100 à 300 m) par un moteur pur sans modèle de langage ; les CSV DVF publiés par `data/` portent pour cela `idParcelle, numero, suffixe, codeVoie, voie, carrez` (voir `architecture/dvf-adresse.md`) ; chaque vente y est ramenée au dernier semestre publié grâce à `dvf/<millésime>/tendance/<dep>.json` (série de la commune ou du département, lissée), et l'estimation du bien est calculée ensuite par le moteur (`packages/moteur/src/estimation/`, voir `architecture/estimation-prix.md`). Les ventes des communes voisines (huit points à 300 m situés par API Géo) comptent dans les cercles. Services du proxy `dpe` (base ADEME des DPE à 30 m) et `risques` (rapport Géorisques), affichés et appliqués par l'onglet Estimation (voir `architecture/marche-complet.md`). Tests Vitest en Node via `app.request()` et doubles ; couverture 100 % sur `src/**`. Build = `wrangler deploy --dry-run`.

Feature `estimation-confiance` (PR 1) : voir `architecture/estimation-confiance.md`. Moteur : `estimation/confiance.ts` (`confianceEstimation`, `interpolerPaliers`, `precisionDe`, `dispersionDe`), règles `estimation.confiance` et `estimation.marges` à cinq niveaux, `DvfSchema` + `precision`, `ancienneteMedianeMois`, `periode`, `lieu`. Data : `dateMediane` dans `StatistiquesTypeSchema`. Worker 0.7.0 : `donnees/anciennete.ts` (`moisEntre`, `milieuDePeriode`), `/marche` contrat v2, `/marche/adresse` contrat v4. Web : `textes/confiance.ts`, `ecrans/adresse/{Confiance,Repere}.tsx`, `enrichissement/{marche,adresse}.ts` (`precisionDuGroupe`), contrats tolérants à l'ancien Worker.

## `apps/comptes` (livré, feature comptes)

Voir `architecture/comptes.md` et `adr/006-comptes-better-auth.md`. Better Auth 1.7 sur Hono, servi sur l'origine du site par le worker Cloudflare Pages (le build de `apps/web` dépose `dist/_worker.js` si `DEKLIC_COMPTES=1` avec `dist/_routes.json`, qui n'y envoie que `/api/*`). `src/index.ts` (gestionnaire Pages : `/api/*` vers l'application, le reste vers `ASSETS`, configuration incomplète : 503), `app.ts` (santé, fournisseurs, garde puis Better Auth), `garde.ts` (hôte connu, liste blanche des routes, code de connexion seulement), `auth.ts` (options, instance par origine, envoi du code, journal sans adresse e-mail), `sociaux.ts` et `fournisseurs.ts` (Google, Apple, secret JWT ES256), `courriel.ts` (Resend, journal en dev), `dependances.ts` (Zod, production par défaut). Base D1 `deklic-comptes` : `migrations/0001_comptes.sql` générée par `scripts/generer-migration.ts` et vérifiée par un test (schéma identique, parcours complet à travers une D1 simulée sur `node:sqlite`). Tests Vitest (Node) via `app.request()` avec base mémoire, envoyeur mémoire et jarre à cookies ; couverture 100 % sur `src/**`. Build = `wrangler deploy --dry-run`. Web : `src/compte/` (client fetch + Zod, client mémoire, `CompteProvider`), écrans `Connexion.tsx`, `Compte.tsx`, `coque/Profil.tsx`.

## `packages/capture` et `apps/extension` (livrés, feature extension)

Voir `architecture/extension.md`. `@loupe/capture` : `CaptureSchema` (version 1, portail, url, champs optionnels bornés, description ≤ 4 000 caractères, captureLe, mode, regles), `encoderCapture` / `decoderCapture` (base64url d'un JSON UTF-8, jamais d'exception), `urlDeCapture` / `captureDepuisHash` (`#capture=…`), `resoudreAnnonce` (une seule source de vérité pour les cinq portails, ré-exportée par le web), moteur de règles (`ReglesPortailSchema`, extracteurs `jsonld` / `json` / `meta` / `css` avec regex, `valeur`, `diviser`, conversions, `appliquerRegles`, `capturer`, `creerRegistre`). Import d'espace de noms de Zod pour des bundles légers. `@loupe/extension` : Manifest V3 (`activeTab` + `scripting`, rien d'autre), `regles/<portail>.json` versionnés `<portail>-AAAA-MM-JJ` et exportés, popup et script de contenu bâtis par esbuild (`node --experimental-strip-types scripts/build.ts [--dev] [--watch]`) vers `dist/chrome` et `dist/firefox`, icônes PNG dessinées au build. Web : `src/annonces/capture.ts`, `src/bookmarklet/` (bouton-favori construit par `vite.bookmarklet.config.ts` dans `public/capture.js`, ignoré par git), page `/extension`. Couverture 100 % exigée sur `packages/capture/src/**`, `apps/extension/src/**` et `apps/web/src/bookmarklet/**`. Fixtures HTML dans `apps/extension/tests/fixtures/` (hors Prettier).

### Lecture automatique d'un lien collé (feature lecture-auto)

Voir `architecture/lecture-auto.md`. `@loupe/capture` : `pont.ts` (messages page ↔ extension validés par Zod : `ping`/`pong`, `lire`/`resultat`, raisons `hors-annonce`, `portail-sans-regles`, `permission`, `chargement`, `vide`, `occupe`), source d'extracteur `donnees` et `donnees.url` relative au portail, `capturerAvecDonnees` avec chargeur injecté, `analyserJson` qui lit aussi `window["X"]=JSON.parse("…")`, champs `typeBien`, `lotsCopro`, `coproEnProcedure`. `@loupe/extension` 0.2.0 : `pont.ts` (script de contenu des pages Deklic, `document_start`), `arriere-plan.ts` (service worker Chrome, script Firefox) branché sur `logique/lecteur.ts` (orchestration testée sans `chrome.*`), permissions d'hôte des cinq portails, bouton d'autorisation dans le popup. Web : `annonces/extension.ts` (détection 500 ms, lecture 90 s), `ecrans/nouveau-projet/LectureAuto.tsx` (hook + état), `enrichissement/lecture.ts` `completerAvecIa`, formulaire enrichi (type, GES, copropriété). Tests de l'écran avec l'extension simulée par `vi.mock('@/annonces/extension')`.

## `data/` (livré, feature referentiels)

Voir `architecture/referentiels.md` et `data/SOURCES.md`. Workspace `@loupe/data` exécuté directement par Node (`node --experimental-strip-types src/cli.ts`, imports en `.ts`, aucun build) : `commun/` (CSV en flux RFC 4180, décodage UTF-8 / Windows-1252, téléchargement avec trois tentatives et gzip, journal JSON + annotations GitHub, quartiles, dates, 101 départements), `schemas/` (Zod : un schéma par fichier publié, en-tête `genereLe` / `millesime` / `source`), `sources/<source>/` (constantes, transformation pure, orchestration), `cli/arguments.ts`, `sources/executer.ts`. Tout accès externe passe par un `Contexte` injecté (`fetch`, pause, horloge, journal, dossier de sortie) : les tests utilisent un faux `fetch` nourri par des extraits réels (`tests/fixtures/`), sans réseau. Couverture 100 % exigée sur `data/src/**` (hors `cli.ts`). Sortie `data/dist/` (ignorée par git), publiée sur R2 `deklic-data` par `.github/workflows/referentiels.yml` (`aws s3 sync`, secrets `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_ACCOUNT_ID`). Seuils de l'usure saisis à la main dans `data/sources/usure/`.

## Conventions transverses

- Zod à chaque frontière (entrée utilisateur, sortie LLM, réponse d'API, env). Types inférés (`z.infer`, `z.input`).
- Pas de `console.log` en code applicatif. Le moteur ne logue jamais ; le Worker utilisera un logger structuré.
- Erreurs : classes nommées héritant de `ErreurMoteur` ; les « pas de solution » légitimes (TRI, prix cible) rendent `null`.
- Verdict et vigilance rendent des **codes**, jamais des phrases : les textes sont dans l'interface.
- Textes utilisateur en français, sans tiret cadratin.
- Commits : `feat(moteur): US-3 — …`.

## Quality gates

1. `npm run lint` → 0 erreur, 0 warning
2. `npm run format:check` → conforme
3. `npm run typecheck` → 0 erreur
4. `npm run test:coverage` → 0 échec ; moteur 100 %
5. `npm run build` → OK
6. Aucun `TODO` / `FIXME` (règle ESLint `no-warning-comments`)
7. Aucun secret, aucun `.env` suivi, `.gitignore` à jour
8. Aucun `eval`, `dangerouslySetInnerHTML`, clé API côté client
9. `npm run test:e2e` → 8 parcours Playwright verts (en local avant la PR ; job CI `e2e`, pas encore bloquant pour le merge)

## Tests

| Type             | Outil                                                                                                                                           | Où                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Unitaires moteur | Vitest                                                                                                                                          | `packages/moteur/tests/<module>`       |
| Intégration      | Vitest                                                                                                                                          | `packages/moteur/tests/integration`    |
| Worker           | Vitest (Node) + `app.request()` et doubles                                                                                                      | `apps/worker/tests/`                   |
| Comptes          | Vitest (Node) + `app.request()`, base mémoire, D1 simulée sur `node:sqlite`                                                                     | `apps/comptes/tests/`                  |
| Référentiels     | Vitest (Node) + faux `fetch` et fixtures réelles                                                                                                | `data/tests/`                          |
| Capture          | Vitest (jsdom) : pages synthétiques via `DOMParser`                                                                                             | `packages/capture/tests/`              |
| Extension        | Vitest (jsdom) : pages enregistrées, faux `chrome`                                                                                              | `apps/extension/tests/`                |
| E2E web          | Playwright (Chromium : ordinateur, téléphone, tablette ; spec des formats 16 écrans × 9 formats ; build de production servi par `vite preview`) | `apps/web/e2e/`                        |
| Propriétés web   | Vitest, tirages pseudo-aléatoires à graine fixe (`tests/tirage.ts`)                                                                             | `apps/web/tests/*.proprietes.test.ts`  |
| Annonce témoin   | GitHub Action quotidienne (à venir)                                                                                                             | `.github/workflows/annonce-temoin.yml` |
