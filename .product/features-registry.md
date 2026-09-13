# Registre des fonctionnalités

Format : `- [ ] slug — titre — date — scope`

## En cours

- [ ] worker-socle — `apps/worker` : Hono sur Workers, proxy des données publiques (cache KV 24 h, 60 req/min/IP), premier service géocodage Géoplateforme — 2026-09-13 — PR #9

## À venir

Chaîne serveur (session principale, en série) :

- [ ] extraction-llm — /extract Mistral JSON strict, repli regex, cache (après worker-socle ; clé Mistral = décision de Pierre)
- [ ] enrichissement-marche — le web appelle le proxy : géocodage, DVF, ADEME, ANIL, REI, Géorisques, ABC (après worker-socle et referentiels)

Parallélisables dès maintenant (fiches de session dans `.product/sessions/`, une session par feature, chacune dans son worktree) :

- [ ] extension — WebExtension MV3 + `packages/capture` + bookmarklet ; règles par portail (fiche `sessions/extension.md`)
- [ ] referentiels — `data/` + GitHub Action mensuelle : DVF, ANIL, REI, zonage ABC, usure, communes → R2 (fiche `sessions/referentiels.md`)
- [ ] garder — impression soignée, partage sans compte, pages Comparer et Méthode (fiche `sessions/garder-comparer-methode.md`)
- [ ] e2e-playwright — parcours complets en navigateur réel, en CI (fiche `sessions/e2e-playwright.md`)

## Livrées (mergées sur `master`)

- [x] moteur-calcul — Moteur de calcul Loupe en TypeScript pur, 204 tests, couverture 100 %, monorepo — 2026-09-13 — PR #1
- [x] direction-visuelle — Direction C « Le guide » retenue, ADR-004, maquettes coque SaaS — 2026-09-13 — PR #2
- [x] web-socle — `apps/web` : React + Vite + Tailwind v4, coque SaaS, Mes projets, Rapport, stockage local, Cloudflare Pages — 2026-09-13 — PR #3
- [x] nouveau-projet — écran `/projets/nouveau` : lien d'annonce reconnu, texte collé lu par règles, saisie manuelle, formulaire Vérifier — 2026-09-13 — PR #4 (production : https://loupeprojet.pages.dev)
- [x] hypotheses-editables — onglet Hypothèses : toutes les hypothèses modifiables avec recalcul instantané, validation Zod, provenance, bloc Marché saisissable — 2026-09-13 — PR #5
- [x] onglets-detail — Fiscalité (4 régimes côte à côte, frise, année par année), Revente (5/10/15/20 ans, plus-value détaillée), Visite (points de vigilance cochables) — 2026-09-13 — PR #6 ; merge automatique des PR (protection de `master`) — PR #7
