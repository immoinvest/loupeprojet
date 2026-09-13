# Registre des fonctionnalités

Format : `- [ ] slug — titre — date — scope`

## En cours

- [ ] worker-socle — `apps/worker` : Hono sur Workers, proxy des données publiques (cache KV 24 h, 60 req/min/IP), premier service géocodage Géoplateforme — 2026-09-13 — PR #9

## À venir

Chaîne serveur (session principale, en série) :

- [ ] extraction-llm — /extract Mistral JSON strict, repli regex, cache (après worker-socle ; clé Mistral = décision de Pierre)
- [ ] enrichissement-marche — le web appelle le proxy : géocodage, DVF, ADEME, ANIL, REI, Géorisques, ABC (après worker-socle et referentiels)

Parallélisables dès maintenant (fiches de session dans `.product/sessions/`, une session par feature, chacune dans son worktree) :

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
- [x] extension — `packages/capture` (contrat de capture : schéma, encodage base64url pour fragment d'URL, résolution d'URL, moteur de règles JSON-LD / état applicatif / meta / CSS ; 68 tests), `apps/extension` (WebExtension MV3 Chrome/Edge/Firefox : règles versionnées des cinq portails, popup « Analyser dans Deklic », script de contenu, build esbuild, icône Deklic ; 33 tests), web : `/projets/nouveau#capture=…` pré-remplit Vérifier, bouton-favori `public/capture.js` et page `/extension` (18 tests) ; fixtures : PAP relevée sur une vraie annonce, les quatre autres à vérifier ; publication sur les stores = décision de Pierre — 2026-09-13 — `packages/capture`, `apps/extension`, `apps/web/src/{annonces/capture.ts,bookmarklet,ecrans/Extension.tsx,ecrans/NouveauProjet.tsx}` — PR #16
