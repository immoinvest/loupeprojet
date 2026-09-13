# Registre des fonctionnalités

Format : `- [ ] slug — titre — date — scope`

## En cours

- [ ] onglets-detail — Fiscalité (4 régimes côte à côte, frise, année par année), Revente (5/10/15/20 ans, plus-value détaillée), Visite (points de vigilance cochables) — 2026-09-13 — `apps/web/src/ecrans`, `analyses`, `textes` — PR #6

## À venir (ordre proposé, une par session)

- [ ] worker-socle — apps/worker : Hono, proxy + cache KV, rate-limit
- [ ] enrichissement-marche — géocodage, DVF, ADEME, ANIL, REI, Géorisques, ABC
- [ ] extraction-llm — /extract Mistral JSON strict, repli regex, cache
- [ ] capture-bookmarklet — lecture LBC, SeLoger, Bien'ici depuis le navigateur
- [ ] extension — WebExtension MV3, règles par portail sur R2, test d'annonce témoin
- [ ] garder — PDF soigné, lien de partage, export
- [ ] e2e-playwright — parcours complets en navigateur réel, en CI
- [ ] referentiels — GitHub Action mensuelle ANIL/REI/ABC/usure

## Livrées (mergées sur `master`)

- [x] moteur-calcul — Moteur de calcul Loupe en TypeScript pur, 204 tests, couverture 100 %, monorepo — 2026-09-13 — PR #1
- [x] direction-visuelle — Direction C « Le guide » retenue, ADR-004, maquettes coque SaaS — 2026-09-13 — PR #2
- [x] web-socle — `apps/web` : React + Vite + Tailwind v4, coque SaaS, Mes projets, Rapport, stockage local, Cloudflare Pages — 2026-09-13 — PR #3
- [x] nouveau-projet — écran `/projets/nouveau` : lien d'annonce reconnu, texte collé lu par règles, saisie manuelle, formulaire Vérifier — 2026-09-13 — PR #4 (production : https://loupeprojet.pages.dev)
- [x] hypotheses-editables — onglet Hypothèses : toutes les hypothèses modifiables avec recalcul instantané, validation Zod, provenance, bloc Marché saisissable — 2026-09-13 — PR #5
