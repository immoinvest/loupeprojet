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
├── vitest.config.ts        projets = packages/*, apps/*, data ; seuils 100 % moteur, worker, data, modules de logique du web
├── .github/workflows/ci.yml  Node 22 : npm ci → lint → format:check → typecheck → test:coverage → build ; job e2e : Playwright Chromium (npm run test:e2e)
├── .github/workflows/referentiels.yml  cron mensuel + manuel : génère data/dist puis aws s3 sync vers R2 deklic-data
├── packages/moteur/        ← livré (feature moteur-calcul)
├── apps/web/               ← livré (socle, nouveau projet, hypothèses, onglets, garder) ; tests de bout en bout Playwright dans e2e/
├── apps/worker/            ← socle livré (feature worker-socle)
├── apps/extension/         ← à venir (fiche .product/sessions/extension.md)
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

Voir `architecture/web-socle.md`. React 19 + Vite 7 + Tailwind v4 (`@theme` = tokens ADR-004), React Router 7 déclaratif (`useRoutes`), stockage local Zod (`loupe.projets.v1`), textes des codes du moteur dans `src/textes/`, Vitest + Testing Library (jsdom). Cloudflare Pages : `wrangler.toml`, `public/_redirects`. Couverture 100 % exigée sur `stockage/`, `formatage/`, `textes/` ; les écrans sont couverts par des tests de rendu et de navigation (`AppEnMemoire`). Tests de bout en bout : `apps/web/e2e/` avec Playwright (Chromium, build de production servi par `vite preview` sur 127.0.0.1:5199, sélecteurs par rôle et libellé, contexte neuf par test), `npm run test:e2e` ; voir `architecture/e2e-playwright.md`.

Feature `garder` : voir `architecture/garder.md`. Route `/projets/:id/imprimer` hors coque, rendue sous `ModeDocument` (contexte `composants/document.tsx` : boutons masqués, explications dépliées, grilles à deux colonnes) avec `@media print` dans `index.css` ; partage par fragment d'URL (`stockage/partage.ts`, base64url + Zod, jamais d'exception) ; Comparer (`analyses/comparaison.ts`) ; Méthode générée depuis `obtenirRegles()` (`textes/methode*.ts`, défauts lus par `analyses/defauts.ts`). Couverture 100 % sur ces modules (globs `stockage`, `analyses`, `textes`).

## `apps/worker` (socle livré)

Voir `architecture/worker-socle.md`. Hono 4 sur Cloudflare Workers (`wrangler.toml` : KV `KV_CACHE`, binding Rate Limiting `LIMITEUR` 60/min/IP, `[observability]`), dépendances injectées (`creerApp(deps)`), `GET /health`, `GET /proxy/:service` avec liste blanche de services (`services/`), cache KV par empreinte des paramètres validés, réponses amont validées et normalisées au contrat Loupe, erreurs en codes. Premier service : géocodage Géoplateforme. `POST /extract` : lecture du texte d'une annonce par un modèle de langage (connecteur « chat completions », OpenRouter par défaut), 20 champs validés un par un, cache 30 jours (voir `architecture/extraction-llm.md`). Tests Vitest en Node via `app.request()` et doubles ; couverture 100 % sur `src/**`. Build = `wrangler deploy --dry-run`.

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

| Type             | Outil                                                               | Où                                     |
| ---------------- | ------------------------------------------------------------------- | -------------------------------------- |
| Unitaires moteur | Vitest                                                              | `packages/moteur/tests/<module>`       |
| Intégration      | Vitest                                                              | `packages/moteur/tests/integration`    |
| Worker           | Vitest (Node) + `app.request()` et doubles                          | `apps/worker/tests/`                   |
| Référentiels     | Vitest (Node) + faux `fetch` et fixtures réelles                    | `data/tests/`                          |
| E2E web          | Playwright (Chromium, build de production servi par `vite preview`) | `apps/web/e2e/`                        |
| Annonce témoin   | GitHub Action quotidienne (à venir)                                 | `.github/workflows/annonce-temoin.yml` |
