# Loupe — Spécification technique

Stack : voir `adr/001-stack.md`. Ce document décrit la structure et les conventions ; il est mis à jour à chaque feature (Rule 8).

## Monorepo

```
loupeprojet/
├── package.json            workspaces: ["packages/*", "apps/*"] ; scripts racine lint/typecheck/test/build
├── tsconfig.base.json      strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, target ES2022, module ESNext
├── eslint.config.js        flat config, typescript-eslint strict, --max-warnings=0
├── .prettierrc
├── vitest.workspace.ts
├── packages/
│   └── moteur/             ← feature moteur-calcul (en cours)
├── apps/                   ← web, worker, extension (features suivantes)
├── data/                   ← scripts de pré-agrégation (feature référentiels)
└── .github/workflows/      ← ci.yml (lint, typecheck, test, build)
```

## `packages/moteur` (cible)

- TypeScript pur, aucune dépendance runtime hors Zod. Aucun accès réseau, DOM, date système ou aléatoire : les fonctions reçoivent tout en paramètre (y compris `version_regles`).
- Un module par onglet de l'Excel : `financement/`, `cashflow/`, `fiscalite/`, `revente/`, `rendement/`, `verdict/`, `scenarios/`, plus `regles/2026-09.ts` (barèmes et taux datés) et `schema/` (Zod : `Projet`, `Hypotheses`, `Resultats`).
- Fichiers ≤ 300 lignes, fonctions ≤ 20 lignes de logique, nommage français métier (`calculerMensualite`, `fraisAcquisition`).
- Conventions numériques : montants en euros (`number`), arrondi explicite via `arrondirCentimes` / `arrondirEuros` aux frontières ; taux en décimal ; durées : `dureeMois` / `dureeAnnees` nommées explicitement.
- Couverture 100 % lignes et branches (Vitest + `@vitest/coverage-v8`). Cas de référence dans `tests/reference/excel-92k.test.ts`.

## Conventions transverses

- Zod à chaque frontière (entrée utilisateur, sortie LLM, réponse d'API, env). Les types TS sont inférés des schémas (`z.infer`).
- Pas de `console.log` en code applicatif. Le moteur ne logue jamais ; le Worker utilise un logger structuré.
- Erreurs : classes d'erreur nommées (`ErreurHypotheseInvalide`), jamais de `throw "string"`.
- Textes utilisateur en français, sans tiret cadratin.
- Commits : `feat(moteur): US-3 — TAEG par résolution numérique`.

## Qualité (quality gates adaptées)

1. `npm run lint` → 0 erreur, 0 warning
2. `npm run typecheck` → 0 erreur
3. `npm run test` → 0 échec ; couverture moteur 100 %
4. Fichiers ≤ 300 lignes, fonctions ≤ 20 lignes de logique
5. Aucun `TODO` / `FIXME`
6. Aucun secret, aucun `.env` suivi, `.gitignore` à jour
7. Aucun `eval`, `dangerouslySetInnerHTML`, clé API côté client

## Tests

| Type             | Outil                                      | Où                                     |
| ---------------- | ------------------------------------------ | -------------------------------------- |
| Unitaires moteur | Vitest                                     | `packages/moteur/tests/`               |
| Référence Excel  | Vitest                                     | `packages/moteur/tests/reference/`     |
| Worker           | Vitest + `@cloudflare/vitest-pool-workers` | `apps/worker/tests/`                   |
| E2E web          | Playwright                                 | `apps/web/e2e/`                        |
| Annonce témoin   | GitHub Action quotidienne                  | `.github/workflows/annonce-temoin.yml` |
