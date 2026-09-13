# Instructions projet — Deklic (ex-Loupe)

## Git & Commits

- Ne jamais ajouter de ligne `Co-Authored-By` dans les messages de commit.
- Ne jamais signer les commits (pas de `--gpg-sign`, pas de `-S`).
- La branche principale est **`master`**. **Feature branches obligatoires** : ne jamais commiter directement sur `master`. Toujours créer une branche `feat/[slug]`, `fix/[slug]`, `refactor/[slug]`, `chore/[slug]`.
- Format des messages : Conventional Commits, `feat(scope): US-N — description courte`. Scopes : `moteur`, `web`, `worker`, `extension`, `data`, `infra`, `docs`.
- **Pull Requests** : quand le travail est prêt, créer une PR via `gh pr create`, puis activer le merge automatique : `gh pr merge <n> --auto --merge`. GitHub fusionne dès que le check CI `verify` est vert (décision de Pierre, 13/09/2026 : « merge automatique une fois tous les checks passés »). `master` est protégée : check `verify` obligatoire, branche à jour exigée, règle appliquée aussi aux administrateurs ; la branche de la PR est supprimée après le merge. Cloudflare Pages déploie une preview à chaque push de branche ; le merge sur `master` déploie en production. Après le merge : `git checkout master && git pull` avant la branche suivante.
- `gh` n'est pas dans le PATH de l'outil PowerShell de Claude Code : l'appeler par `& "C:\Program Files\GitHub CLI\gh.exe"`.
- Ne jamais commiter `.env*` (sauf `.env.example`), `.dev.vars`, `node_modules/`, `dist/`, `.wrangler/`.

---

# Deklic — analyse d'investissement locatif à partir du lien d'une annonce

## What This Is

**Deklic** (ex-Loupe, renommé le 13/09/2026, ADR-005) : l'utilisateur colle le **lien d'une annonce** (LeBonCoin, SeLoger, Bien'ici, PAP, Logic-Immo), l'app lit la page **dans son navigateur**, complète avec les **données publiques** (DVF, ADEME, ANIL, REI, Géorisques), lui fait vérifier cinq chiffres, et produit un **rapport complet** : financement, cash-flow, fiscalité (4 régimes côte à côte), revente, rendement et TRI, verdict à cinq feux, scénarios « et si ».

- **Cible** : Camille, 31 ans, premier investissement locatif, remplace son tableur bricolé.
- **Modèle** : gratuit et sans compte en v1. Compte optionnel (lien magique) en v1.5. Monétisation en v3 (affiliation, export premium), sans jamais dégrader le gratuit.
- **Budget d'exploitation** : < 10 €/mois sous les quotas gratuits Cloudflare.

L'utilisateur principal du repo pratique le **vibe coding** et ne relit pas le code : les tests, le typage strict et les quality gates sont le seul filet de sécurité. Ils ne sont jamais optionnels.

## Documents de référence (à lire avant toute phase)

| Fichier                                   | Contenu                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| `.product/reference/spec-produit-v1.html` | Spec produit & architecture v1 complète (source de vérité, 13/09/2026)                     |
| `.product/functional-spec.md`             | Résumé fonctionnel : parcours, pipeline, moteur, règles fiscales, roadmap                  |
| `.product/technical-spec.md`              | Stack, structure, conventions techniques                                                   |
| `.product/architecture-overview.md`       | Vue d'ensemble des modules                                                                 |
| `.product/adr/`                           | Décisions d'architecture (stack, capture navigateur, LLM)                                  |
| `.product/design/maquette-v1.md`          | Les 5 écrans de la maquette et leurs composants. Direction visuelle à redéfinir avant l'UI |
| `marque/README.md`                        | Identité de marque Deklic : fichiers, couleurs, typographies, règles d'usage (ADR-005)     |
| `.product/features-registry.md`           | Fonctionnalités livrées / en cours                                                         |
| `.product/pipeline-state.json`            | État du pipeline de la feature en cours                                                    |

## Statut du repo

- L'ancien simulateur de comparaison de prêts (webpack, `src/`) a été **supprimé** le 13/09/2026 ; sa logique d'amortissement avec différés vit dans `packages/moteur/src/financement/amortissement.ts`, testée.
- **Livré** : `packages/moteur` complet (feature `moteur-calcul`, 204 tests, couverture 100 %). API : `calculerProjet(projet) → Resultats`, `ProjetSchema`, `ResultatsSchema`, `projetExemple`, `obtenirRegles`.
- **Direction visuelle** : C « Le guide » retenue (ADR-004) ; tokens dans `apps/web/src/index.css`.
- **Identité de marque** : **Deklic** (ADR-005, 13/09/2026). Source de vérité dans `marque/` (logos SVG, favicon, icônes, image de partage, palette, guide) ; l'app reprend favicon, manifeste, tokens `--color-accent*` / `--color-flash*`, composant `LogotypeDeklic` (`apps/web/src/marque/Logo.tsx`). Noms internes inchangés (`@loupe/moteur`, dépôt, clé de stockage).
- **Livré** : `apps/web` socle (React 19 + Vite + Tailwind v4, React Router déclaratif, coque SaaS, écrans Mes projets et Rapport, stockage local Zod, config Cloudflare Pages). Textes des codes du moteur dans `apps/web/src/textes/`.
- **Livré** : écran Nouveau projet (`apps/web/src/annonces/` : `resoudreAnnonce`, `extraireChamps` par règles, `construireProjet` avec défauts sourcés ; formulaire Vérifier). Le schéma `Projet` du moteur porte une `source` optionnelle (portail, id, URL).
- **Livré** : onglet Hypothèses (`apps/web/src/hypotheses/` : chemins pointés, conversion texte ↔ valeur, descripteurs des champs par groupe, `appliquerSaisie` ; `ProjetsContext.mettreAJour` valide par Zod avant d'enregistrer).
- **Livré** : onglets Fiscalité (4 régimes côte à côte, « Retenir ce régime », frise, année par année), Revente (horizons 5/10/15/20 ans cliquables via `apps/web/src/analyses/`, plus-value détaillée) et Visite (points de vigilance cochables par catégorie, `categorieVigilance`). Toute interaction passe par `appliquerSaisie`.
- **Livré** : `apps/worker` socle (Hono sur Workers : `GET /health`, `GET /proxy/:service` avec liste blanche, cache KV 24 h par empreinte des paramètres, 60 req/min/IP, erreurs en codes, journal structuré ; premier service : géocodage Géoplateforme). Dépendances injectées (`creerApp(deps)`), tests Node via `app.request()`. Déploiement : voir README (compte Cloudflare de Pierre).
- **Livré** : `POST /extract` (`apps/worker/src/extraction/` : contrat de 20 champs validés un par un, prompt versionné, connecteur « chat completions » OpenRouter ou Mistral réglé par `LLM_URL`/`LLM_MODELE`, secret `OPENROUTER_API_KEY`, cache 30 jours par empreinte du texte, 10 lectures/min/IP ; sans clé → `503 EXTRACTION_INDISPONIBLE`). Modèle par défaut `nvidia/nemotron-3-super-120b-a12b:free` (ADR-003 amendé).
- **Livré** : enrichissement marché. Worker `GET /marche` (`apps/worker/src/marche/`, binding R2 `DONNEES` = bucket `deklic-data` en juridiction UE) : médiane et quartiles DVF, loyer ANIL, zone ABC d'une commune, arrondissement retrouvé par le code postal, cache 24 h. Web `apps/web/src/enrichissement/` : `ClientWorker` (réponses revalidées par Zod, échecs en codes, `clientHorsLigne` par défaut dans les tests et le contexte `coque/ClientWorker.tsx`), `lireAnnonce` (IA puis règles), `enrichirSaisie` (géocodage → marché) branchés dans `NouveauProjet.tsx` ; `construireProjet(saisie, id, enrichi)` ajoute `marche` et la provenance `dvf`/`anil`. Adresse du Worker : `VITE_WORKER_URL` au build, production sinon.
- **Livré** : tests de bout en bout Playwright (`apps/web/e2e/`, 8 parcours Chromium sur le build de production servi par `vite preview` sur 127.0.0.1:5199 ; `npm run test:e2e` construit puis teste ; sélecteurs par rôle et libellé, contexte neuf par test ; job CI `e2e` séparé de `verify`, pas encore requis pour le merge). Détails : `.product/architecture/e2e-playwright.md`.
- **Livré** : `data/` (`@loupe/data`, feature `referentiels`) : `npm run referentiels -w data -- --source <dvf|loyers|taxe-fonciere|zonage|usure|communes|tout> [--departement 13]` génère dans `data/dist/` les référentiels par département ou commune (DVF 24 mois + index prix/m², loyers ANIL, taux TFPB REI, zonage ABC, seuils de l'usure saisis dans `data/sources/usure/`, communes API Géo), formats Zod dans `data/src/schemas/`, `<prefixe>/courant.json` = millésime à lire, sources et licences dans `data/SOURCES.md`. GitHub Action `referentiels.yml` (cron mensuel + manuel) publie sur R2 `deklic-data` par `aws s3 sync` ; secrets `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_ACCOUNT_ID` à créer par Pierre (README). Le chargement par l'application = feature `enrichissement-marche`.
- **Livré** : feature `extension` : `packages/capture` (`@loupe/capture` : `CaptureSchema` version 1, `encoderCapture` / `decoderCapture` base64url pour `#capture=…`, `resoudreAnnonce` partagé, moteur de règles JSON-LD / état applicatif / meta / CSS : `capturer`, `creerRegistre`), `apps/extension` (WebExtension MV3 Chrome/Edge/Firefox, `activeTab` + `scripting` seulement, règles versionnées `regles/<portail>.json`, popup « Analyser dans Deklic », script de contenu, build `npm run build -w apps/extension` → `dist/chrome`, `dist/firefox`, à charger non empaquetée : `apps/extension/README.md`), web : `src/annonces/capture.ts` lit le fragment dans `NouveauProjet.tsx`, bouton-favori `public/capture.js` (construit par `vite.bookmarklet.config.ts`, ignoré par git) et page `/extension`. Le fragment n'est jamais envoyé au serveur ; la description sert à `extraireChamps` puis disparaît. Fixtures : PAP relevée sur une vraie annonce, les quatre autres à vérifier. Détails : `.product/architecture/extension.md`.
- **Livré** : feature `lecture-auto` : coller le lien d'une annonce dans Nouveau projet suffit quand l'extension est installée. La page détecte l'extension (`apps/web/src/annonces/extension.ts`, `window.postMessage`, protocole `@loupe/capture/pont.ts`) ; le script `pont.js` de l'extension (pages `*.loupeprojet.pages.dev` et localhost) relaie vers `arriere-plan.js`, qui ouvre l'annonce dans un onglet caché à côté de Deklic, la lit (`src/logique/lecteur.ts`), l'affiche en second essai si prix ou surface manquent, la referme et revient sur Deklic ; `completerAvecIa` (`enrichissement/lecture.ts`) comble par `/extract` les champs que seul le texte donne. Règles des cinq portails réécrites d'après les pages réelles du 13/09/2026 : LeBonCoin `__NEXT_DATA__`, SeLoger et Logic-Immo `__UFRN_LIFECYCLE_SERVERREQUEST__` (nouvelles adresses à identifiant alphanumérique), Bien'ici `/realEstateAd.json` (source `donnees`), PAP JSON-LD. Extension 0.2.0 : permissions d'hôte des cinq portails (Firefox : bouton « Autoriser la lecture automatique » du popup). Formulaire : type de bien, GES, lots et procédure de copropriété. Détails : `.product/architecture/lecture-auto.md`.
- **Livré** : feature `garder` (`.product/architecture/garder.md`) : impression `/projets/:id/imprimer` hors coque (`ModeDocument` réutilise les écrans en lecture seule, `@media print` dans `index.css`), partage sans compte `/partage#p=…` (`apps/web/src/stockage/partage.ts` : `ProjetEnregistre` en base64url dans le fragment, validé par Zod, rien d'enregistré avant « Ajouter »), Comparer (`apps/web/src/analyses/comparaison.ts` : 14 indicateurs, tri, meilleure valeur), Méthode (`apps/web/src/textes/methode*.ts` générés depuis `obtenirRegles()`, défauts lus par `analyses/defauts.ts`).
- **Production** : https://loupeprojet.pages.dev (Cloudflare Pages, branche `master`, build `npm ci && npm run build -w apps/web`). Worker : https://loupe-worker.erreip-gorguel.workers.dev (déployé à la main par `npm run deploy -w apps/worker`, machine connectée par `wrangler login` ; KV `KV_CACHE` = `a64f32a40a0846e1be258a7ea34a8090`).
- **Sessions parallèles** : fiches dans `.product/sessions/` (extension, referentiels, garder, e2e-playwright) ; chaque session parallèle tient son état dans `.product/pipeline/<slug>.json` et ne touche aux docs communes qu'en fin de feature. `.product/pipeline-state.json` reste à la session principale.
- **Prochaine étape (session principale)** : `marche-complet` (ventes DVF dans un rayon autour de l'adresse, loyer visé estimé depuis l'ANIL, DPE ADEME, risques Géorisques, type de bien dans le formulaire). La publication DVF France entière dépend de l'Action « Référentiels ».
- `node_modules/` et `dist/` ne sont plus versionnés.

## Stack (décision ADR-001)

| Couche        | Techno                                                                                                                                       | Pourquoi                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Monorepo      | **npm workspaces**, Node 22, TypeScript 5 **strict** (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)                    | Natif, zéro outil en plus                                                                    |
| Moteur        | `packages/moteur` — TypeScript **pur**, zéro I/O, dépendance unique : Zod                                                                    | Tourne dans le navigateur ; testable à 100 %                                                 |
| Front         | `apps/web` — **React 19 + Vite**, React Router, **Tailwind CSS v4 + shadcn/ui**, Recharts, SPA statique sur **Cloudflare Pages**             | Tout le calcul est côté client ; React est le framework le mieux maîtrisé par les IA de code |
| API           | `apps/worker` — **Cloudflare Workers + Hono** : `/extract` (LLM + cache), `/proxy/*` (APIs publiques + cache), rate-limit par IP             | 100 000 req/jour gratuits, commercial autorisé                                               |
| Capture       | `apps/extension` — WebExtension MV3 (Chrome/Firefox/Edge, Safari v1.5) + bookmarklet ; règles par portail en JSON versionné sur R2           | Lecture côté client uniquement (ADR-002)                                                     |
| Données       | **KV** (cache API 24 h / extraction 30 j), **R2** (référentiels pré-agrégés, CSV DVF), **D1** (projets des comptes, v1.5)                    | Quotas gratuits largement suffisants                                                         |
| LLM           | **Mistral Small** (sortie JSON par schéma) derrière une interface `Extracteur` ; repli regex ; Claude Haiku 4.5 comme fournisseur alternatif | 0 ou 1 appel par annonce, ~0,0004 $ (ADR-003)                                                |
| Auth (v1.5)   | Lien magique par e-mail (Resend), sessions D1 — Better Auth + Drizzle ; Supabase Auth en alternative si D1 s'avère pénible                   | Pas de mot de passe à protéger                                                               |
| Paiement (v3) | Stripe via webhooks Worker                                                                                                                   | Rien en v1                                                                                   |
| Référentiels  | GitHub Action mensuelle : loyers ANIL, taux REI, zonage ABC, taux d'usure → JSON sur R2                                                      | Pas d'API en direct pour ces données                                                         |
| Validation    | **Zod** partout : entrées utilisateur, sorties LLM, réponses d'API, variables d'env                                                          |                                                                                              |
| Tests         | **Vitest** (unit + intégration), **Playwright** (E2E web), test quotidien d'annonce témoin par portail                                       |                                                                                              |
| Lint / format | **ESLint** (flat config, `--max-warnings=0`) + **Prettier**                                                                                  |                                                                                              |
| CI            | GitHub Actions : lint → typecheck → test → build sur chaque PR                                                                               |                                                                                              |
| Observabilité | **Sentry** (erreurs, front + worker), Cloudflare Web Analytics (sans cookie). **Aucun tracking tiers**                                       | Vie privée : engagement de la spec                                                           |
| PDF           | CSS `@media print` + impression navigateur                                                                                                   | Pas de service de rendu                                                                      |

**Écarté** : Next.js/Vercel (SSR inutile, Vercel Hobby interdit l'usage commercial), Supabase en v1 (pause après 7 jours d'inactivité, aucune BDD nécessaire), scraping serveur Firecrawl/Apify (jurisprudence Jinka 2025-2026), Inngest (aucune tâche longue : tout se calcule dans le navigateur).

## Architecture Overview

```
Extension / bookmarklet ──capture (structuré + texte)──▶ apps/web (React SPA)
                                                          │  moteur (packages/moteur) · stockage local
                                                          ├─▶ apps/worker /extract ──▶ Mistral (JSON strict, cache KV par hash)
                                                          ├─▶ apps/worker /proxy ───▶ Géoplateforme · ADEME · Géorisques · BDNB (cache KV)
                                                          ├─▶ R2 : CSV DVF par commune · référentiels ANIL/REI/ABC/usure
                                                          └─▶ (v1.5) D1 : projets des comptes
```

Pipeline d'une analyse (9 étapes) : Résoudre → Capturer → Extraire → Normaliser → Géocoder → Enrichir → Estimer → Vérifier → Calculer. Détail dans `.product/functional-spec.md`.

## Structure cible

```
loupeprojet/
├── CLAUDE.md
├── .claude/commands/          ← skills du pipeline de dev
├── .product/                  ← specs, ADR, design, pipeline-state.json
├── marque/                    ← identité Deklic : logos SVG, favicon, icônes, image de partage, guide (source de vérité)
├── package.json               ← workspaces: packages/*, apps/*
├── tsconfig.base.json
├── packages/
│   ├── moteur/                ← moteur de calcul pur (financement, cashflow, fiscalite, revente, rendement, verdict, regles/)
│   └── capture/               ← contrat de capture (schéma, encodage, résolution d'URL, moteur de règles), partagé extension / favori / web
├── apps/
│   ├── web/                   ← React + Vite (Cloudflare Pages) ; bouton-favori construit dans public/capture.js
│   ├── worker/                ← Hono sur Cloudflare Workers (/extract, /proxy)
│   └── extension/             ← WebExtension MV3 (popup, script de contenu, build esbuild) + règles par portail (regles/*.json)
├── data/                      ← scripts de pré-agrégation des référentiels (GitHub Action)
└── .github/workflows/         ← CI, test d'annonce témoin, rebuild mensuel des référentiels
```

## Principes métier (non négociables)

1. **Le LLM lit, il ne calcule jamais.** Un seul point d'usage : extraire du texte de l'annonce les champs que la page ne donne pas en structuré. Verdict, explications, estimations = code et textes écrits une fois.
2. **Moteur de calcul pur** : fonctions sans effet de bord, montants en **euros avec arrondi explicite au centime** aux frontières d'affichage, taux en décimal (`0.0335`), durées en mois ou années nommées explicitement. Chaque module = un onglet de l'Excel d'origine.
3. **Tests d'abord pour tout calcul financier.** Les cas de référence reproduisent l'Excel « Projet 92K » (tableau « Ton Excel → Loupe » de la spec) et des cas vérifiés à la main, documentés dans le test.
4. **Règles fiscales versionnées** : `packages/moteur/src/regles/2026-09.ts`. Un projet stocke sa `version_regles`. Les valeurs « à confirmer » (PS BIC 18,6 %) portent un drapeau visible et sont modifiables.
5. **Jamais de case vide** : chaque hypothèse a une valeur par défaut sourcée et un badge de provenance (`annonce`, `donnée publique`, `estimé`, `à toi`). Les résultats ne sont jamais persistés : ils se recalculent à l'ouverture.
6. **Capture côté client uniquement** : la page de l'annonce est lue dans le navigateur de l'utilisateur, jamais par nos serveurs. Aucune base d'annonces, aucun texte d'annonce stocké (seulement son hash SHA-256 comme clé de cache, 30 jours). Repli texte collé et saisie manuelle toujours disponibles.
7. **Positionnement légal** : « outil d'aide à la décision, pas un conseil ». Pas de score unique magique : cinq feux lisibles.
8. **Vie privée** : pas de tracking tiers, données hébergées en UE, sources (ANIL, DVF, ADEME) affichées.
9. **Sans compte et gratuit** : la première analyse ne demande rien. Zéro fenêtre, zéro bandeau.

## Key Concepts (glossaire)

- **Rendement brut** : loyers annuels HC / (prix + travaux + frais d'acquisition).
- **Rendement net** : (loyers − TF − copro − PNO − comptable − CFE − gestion − vacance − entretien) / coût total. Toujours **charges pleines**.
- **Rendement net-net** : après intérêts et impôt.
- **Cash-flow** : loyer − (crédit + assurance) − charges − impôt ; **effort d'épargne** si négatif ; **point mort** = loyer d'équilibre ; **taux de couverture** = mensualité ÷ loyer.
- **Frais d'acquisition** : DMTO (4,5 % ou 5 % selon département, jusqu'au 31/03/2028) + taxe communale 1,2 % + frais d'assiette 2,37 % + émoluments par tranches + CSI 0,10 % + débours ; calculés hors honoraires d'agence.
- **TAEG** : résolu numériquement, frais de dossier et garantie inclus.
- **Taux d'effort HCSF** : mensualité assurance comprise ÷ (revenus + 70 % des loyers) ; seuil 35 %, 25 ans (27 si travaux ≥ 10 %).
- **IRA** : min(6 mois d'intérêts, 3 % du CRD).
- **Régimes** : meublé micro-BIC (50 %, PS 18,6 % _à confirmer_), meublé réel LMNP (amortissements par composants, art. 39 C), nu micro-foncier (30 %, PS 17,2 %), nu réel (déficit foncier 10 700 €). Pas de SCI IS en v1.
- **Plus-value** : abattements IR 6 %/an dès la 6ᵉ année, PS 1,65 %… ; réintégration des amortissements de l'immeuble en LMNP réel depuis le 15/02/2025 (mobilier exclu) ; surtaxe > 50 000 €.
- **TRI** : sur flux annuels (apport + mobilier en année 0, cash-flows après impôt, cash net de revente en N), résolu numériquement.
- **Verdict** : cinq feux — prix vs DVF, rendement net, cash-flow, effort HCSF, risques.
- **DVF** : ventes réelles ; rayon 300 m (adresse) / 800 m (quartier) / commune selon précision du géocodage.

## Variables d'environnement

Validées par Zod (`apps/worker/src/dependances.ts`), documentées dans `apps/worker/.dev.vars.example`. Aucune n'est nécessaire pour `packages/moteur` ni `apps/web`. Déjà en place : `ENVIRONNEMENT` (`dev` / `preview` / `production`), `ORIGINES_AUTORISEES` (origines CORS supplémentaires, séparées par des virgules), `LLM_URL` et `LLM_MODELE` (fournisseur « chat completions » et modèle de lecture des annonces, dans `wrangler.toml`) et le secret `OPENROUTER_API_KEY` (posé par Pierre dans le dashboard Cloudflare ; jamais dans le dépôt ni dans une conversation).

| Variable                                        | Usage                                                                                   |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| `OPENROUTER_API_KEY` (secret)                   | Clé du fournisseur de lecture des annonces (Worker uniquement)                          |
| `LLM_URL`, `LLM_MODELE`                         | Fournisseur « chat completions » et modèle ; Mistral direct = autre URL et autre modèle |
| `SENTRY_DSN`                                    | Erreurs front + worker                                                                  |
| `RESEND_API_KEY`                                | Liens magiques (v1.5)                                                                   |
| Bindings Wrangler : `KV_CACHE`, `R2_DATA`, `DB` | Déclarés dans `wrangler.toml`, pas dans l'env                                           |

Secrets GitHub Actions du workflow `referentiels.yml` (publication des référentiels sur R2, jamais dans le code) : `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (jeton R2 « Object Read & Write » sur le bucket `deklic-data`), `CLOUDFLARE_ACCOUNT_ID`.

## Commandes

```bash
npm install                  # racine, installe tous les workspaces
npm run lint                 # eslint . --max-warnings=0
npm run typecheck            # tsc -b (tous les workspaces)
npm run test                 # vitest run (tous les workspaces)
npm run test:e2e             # vite build puis playwright test : 8 parcours Chromium (apps/web/e2e)
npm run build                # build de tous les workspaces
npm run dev -w apps/web      # front en local (construit d'abord le bouton-favori public/capture.js)
npm run dev -w apps/worker   # wrangler dev
npm run build -w apps/extension       # extension : dist/chrome et dist/firefox (build:dev vise localhost:5173)
npm run referentiels -w data -- --source tout --departement 13   # référentiels d'un département dans data/dist/
```

Ces scripts sont créés lors de la mise en place du monorepo (feature `moteur-calcul`).

---

## Adaptation des skills (`.claude/commands/`)

Les skills ont été écrits pour un autre projet (FastAPI/Python + React, deux repos). **Ici, les équivalences suivantes priment sur leur texte :**

| Dans les skills                                               | Ici                                                                                                                        |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `evaluation-api/`, `evaluation-frontend/`, `app/`             | Un seul monorepo : `packages/*`, `apps/*`                                                                                  |
| `uv run pytest tests/unit/`                                   | `npm run test`                                                                                                             |
| `uv run mypy app/` / `npx tsc --noEmit`                       | `npm run typecheck` (**0 erreur**, pas de baseline tolérée)                                                                |
| `uv run ruff check` / `ruff format`                           | `npm run lint` + `npx prettier --write .`                                                                                  |
| `docker compose build`                                        | `npm run build`                                                                                                            |
| Alembic migrations                                            | Migrations D1 dans `apps/worker/migrations/` (v1.5)                                                                        |
| Auth0 JWT, `verify_token`                                     | Aucune auth en v1 ; rate-limit par IP dans le Worker                                                                       |
| `print()` interdit                                            | `console.log` interdit en code applicatif → logger structuré (Worker) ; le moteur ne logue jamais                          |
| Gates Python (pickle, yaml, shell=True…)                      | Gates TS : pas de `eval`, pas de `dangerouslySetInnerHTML`, pas de clé API côté client, pas de texte d'annonce persisté    |
| `branch main`                                                 | `master`                                                                                                                   |
| `references/domain-examples.md` (ALPHA10X)                    | Non applicable : suivre les principes métier et le glossaire ci-dessus                                                     |
| Couverture « Composite score / scoring 100 % »                | **`packages/moteur` : 100 % lignes et branches**                                                                           |
| Couverture « Auth 100 % »                                     | Worker `/extract` (quota, cache, validation Zod) : 100 %                                                                   |
| Commit `feat(eval-api): US-N — …`                             | `feat(moteur): US-N — …`                                                                                                   |
| `gh pr merge --squash` automatique (Step 8 de `/new-feature`) | `gh pr merge <n> --auto --merge` dès la PR ouverte : GitHub fusionne quand le check `verify` est vert (voir Git & Commits) |

Les skills sont des commandes projet (`/new-feature`, `/specs`, `/implement`…). Si l'outil Skill ne les connaît pas dans une session, lire le fichier `.claude/commands/<nom>.md` et suivre son contenu.

---

## DEVELOPMENT RULES (Non-negotiable)

### Rule 1: ONE feature per session

Never implement multiple features in one session. Context overflow kills quality.

```
❌ FORBIDDEN: "Build moteur + écrans + worker in one go"
✅ CORRECT:  Feature A → commit → new session → Feature B
```

### Rule 2: Validation checkpoints MANDATORY

After each major phase, STOP and ask for user validation before continuing.

```
1. Discovery done    → "Voici ce que j'ai compris. On continue ?"
2. Specs done        → "Voici les X stories. On valide ?"
3. Architecture done → "Voici le design. On implémente ?"
4. Each story done   → commit → verify → next
```

DO NOT chain steps automatically.

### Rule 3: Commit per module (not in bulk)

```
❌ FORBIDDEN: Implement everything then 1 big commit
✅ CORRECT:  Schémas → commit → Financement → commit → Cash-flow → commit
```

### Rule 4: Verify tests BEFORE implementing

```bash
npm run test && npm run typecheck
```

If the baseline fails, fix it before starting.

### Rule 5: Lint + typecheck + tests MANDATORY before commit

```bash
npm run lint && npm run typecheck && npm run test
```

### Rule 6: Official docs and spec BEFORE writing code

Before implementing a pattern (Workers, Hono, Vite, Tailwind v4, Mistral structured output, WebExtension):

1. Check the current official docs and the existing code in the repo
2. For any fiscal or financial rule, check `.product/functional-spec.md` and its sources; never invent a rate
3. Any non-standard decision → ADR in `.product/adr/NNN-titre.md`

### Rule 7: Pipeline state tracking

Always maintain `.product/pipeline-state.json` (see `/new-feature` for the schema).

### Rule 8: README + CLAUDE.md + .product updates MANDATORY after each feature

1. **`README.md`** — structure, commandes, env vars, nombre de tests
2. **`CLAUDE.md`** — structure, stack, glossaire, conventions
3. **`.product/`** — `features-registry.md`, `functional-spec.md`, `technical-spec.md`, `architecture-overview.md`

### Rule 9: Plain-language reporting

The user does not read the code. After each step, explain in French and in plain language: what changed for the end user, how to test it by hand, and any risk or cost introduced (API calls, quotas).

### Rule 10: Design direction before UI

Before the first UI feature, propose 2-3 visual directions to the user (the v1 mockup is a structural reference, not the final look). No UI code before one direction is validated.
