# Loupe — Spécification technique

Stack : voir `adr/001-stack.md`. Ce document décrit la structure et les conventions ; il est mis à jour à chaque feature (Rule 8).

## Monorepo

```
loupeprojet/
├── package.json            workspaces: ["packages/*", "apps/*"] ; scripts lint / format / typecheck / test / test:coverage / build
├── tsconfig.base.json      strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, ES2022, bundler resolution
├── tsconfig.json           couvre les fichiers de config racine (ESLint type-checked)
├── eslint.config.js        typescript-eslint strict-type-checked + stylistic, no-console, max-lines 300, prettier
├── .prettierrc             printWidth 100, singleQuote, trailingComma all, LF
├── vitest.config.ts        projets = packages/*, apps/*
├── .github/workflows/ci.yml  Node 22 : npm ci → lint → format:check → typecheck → test:coverage → build
├── packages/moteur/        ← livré (feature moteur-calcul)
├── apps/                   ← web, worker, extension (features suivantes)
└── data/                   ← scripts de pré-agrégation (feature référentiels)
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

Voir `architecture/web-socle.md`. React 19 + Vite 7 + Tailwind v4 (`@theme` = tokens ADR-004), React Router 7 déclaratif (`useRoutes`), stockage local Zod (`loupe.projets.v1`), textes des codes du moteur dans `src/textes/`, Vitest + Testing Library (jsdom). Cloudflare Pages : `wrangler.toml`, `public/_redirects`. Couverture 100 % exigée sur `stockage/`, `formatage/`, `textes/` ; les écrans sont couverts par des tests de rendu et de navigation (`AppEnMemoire`).

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

## Tests

| Type              | Outil                                      | Où                                     |
| ----------------- | ------------------------------------------ | -------------------------------------- |
| Unitaires moteur  | Vitest                                     | `packages/moteur/tests/<module>`       |
| Intégration       | Vitest                                     | `packages/moteur/tests/integration`    |
| Worker (à venir)  | Vitest + `@cloudflare/vitest-pool-workers` | `apps/worker/tests/`                   |
| E2E web (à venir) | Playwright                                 | `apps/web/e2e/`                        |
| Annonce témoin    | GitHub Action quotidienne (à venir)        | `.github/workflows/annonce-temoin.yml` |
