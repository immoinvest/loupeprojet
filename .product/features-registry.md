# Registre des fonctionnalités

Format : `- [ ] slug — titre — date — scope`

## En cours

- [ ] enrichissement-marche — le web appelle le Worker : lecture de l'annonce par l'IA (règles en repli), puis à la création géocodage et `GET /marche` (médiane et quartiles DVF de l'arrondissement ou de la commune, loyer ANIL, zone ABC lus sur R2) → bloc `marche` du projet, provenance « donnée publique » — 2026-09-13 — `apps/worker/src/marche`, `apps/web/src/enrichissement`, `NouveauProjet.tsx` — PR à ouvrir

## À venir

Chaîne serveur (session principale, en série) :

- [ ] marche-complet — ventes DVF dans un rayon autour de l'adresse (CSV publiés), loyer visé estimé depuis l'ANIL, DPE ADEME, risques Géorisques, type de bien dans le formulaire, actualisation du marché d'un projet existant

Parallélisables dès maintenant (fiches de session dans `.product/sessions/`, une session par feature, chacune dans son worktree) :

- [ ] extension — WebExtension MV3 + `packages/capture` + bookmarklet ; règles par portail (fiche `sessions/extension.md`)
- [ ] garder — impression soignée, partage sans compte, pages Comparer et Méthode (fiche `sessions/garder-comparer-methode.md`)

## Livrées (mergées sur `master`)

- [x] moteur-calcul — Moteur de calcul Loupe en TypeScript pur, 204 tests, couverture 100 %, monorepo — 2026-09-13 — PR #1
- [x] direction-visuelle — Direction C « Le guide » retenue, ADR-004, maquettes coque SaaS — 2026-09-13 — PR #2
- [x] web-socle — `apps/web` : React + Vite + Tailwind v4, coque SaaS, Mes projets, Rapport, stockage local, Cloudflare Pages — 2026-09-13 — PR #3
- [x] nouveau-projet — écran `/projets/nouveau` : lien d'annonce reconnu, texte collé lu par règles, saisie manuelle, formulaire Vérifier — 2026-09-13 — PR #4 (production : https://loupeprojet.pages.dev)
- [x] hypotheses-editables — onglet Hypothèses : toutes les hypothèses modifiables avec recalcul instantané, validation Zod, provenance, bloc Marché saisissable — 2026-09-13 — PR #5
- [x] onglets-detail — Fiscalité (4 régimes côte à côte, frise, année par année), Revente (5/10/15/20 ans, plus-value détaillée), Visite (points de vigilance cochables) — 2026-09-13 — PR #6 ; merge automatique des PR (protection de `master`) — PR #7
- [x] referentiels — `data/` (`@loupe/data`) : DVF 24 mois par commune + index des prix au m², loyers ANIL, taux de taxe foncière REI, zonage ABC, seuils de l'usure (saisies trimestrielles), communes API Géo ; formats Zod, `SOURCES.md`, GitHub Action mensuelle → R2 `deklic-data` par `aws s3 sync` (bucket et secrets à créer par Pierre) — 2026-09-13 — `data/`, `.github/workflows/referentiels.yml` — PR `feat/referentiels`
- [x] identite-visuelle — Identité de marque Deklic : dossier `marque/` (logos SVG, favicon, icônes 192/512/180, image de partage, palette, guide), ADR-005, app renommée (titre, favicon, manifeste, couleurs, logotype dans la barre latérale, textes) — 2026-09-13 — `marque/`, `apps/web`, docs — PR #8
- [x] e2e-playwright — tests de bout en bout Playwright : 8 parcours Chromium sur le build de production (Mes projets, Rapport, Hypothèses, Fiscalité, Revente, Visite, nouveau projet et suppression, persistance), `npm run test:e2e`, job CI `e2e` non bloquant — 2026-09-13 — `apps/web/e2e`, `apps/web/playwright.config.ts`, `.github/workflows/ci.yml`, ignores ESLint — PR #11
- [x] worker-socle — `apps/worker` : Hono sur Workers, proxy des données publiques (cache KV 24 h, 60 req/min/IP), premier service géocodage Géoplateforme — 2026-09-13 — PR #9 ; espace KV créé et Worker déployé sur https://loupe-worker.erreip-gorguel.workers.dev — PR #10
- [x] extraction-llm — `POST /extract` : lecture du texte d'une annonce par un modèle de langage (OpenRouter, modèle gratuit), 20 champs validés un par un, cache 30 jours, 10 lectures/min/IP — 2026-09-13 — `apps/worker/src/extraction`, ADR-003 amendé — PR #15 (déployé et vérifié en production)
