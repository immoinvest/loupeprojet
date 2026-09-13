# Deklic

Colle le lien d'une annonce immobilière, obtiens l'analyse complète de rentabilité locative : financement, cash-flow, fiscalité (quatre régimes côte à côte), revente, rendement et TRI, verdict à cinq feux, scénarios « et si ».

Gratuit, sans compte, tout se calcule dans le navigateur. Spécification produit : [`.product/reference/spec-produit-v1.html`](.product/reference/spec-produit-v1.html). Décisions d'architecture : [`.product/adr/`](.product/adr/).

## Stack

Monorepo npm workspaces, TypeScript strict, Vitest, ESLint, Prettier. Cible : React + Vite sur Cloudflare Pages, Hono sur Cloudflare Workers, extension navigateur pour la lecture des annonces (voir [ADR-001](.product/adr/001-stack.md)).

## Structure

```
packages/moteur/     Moteur de calcul pur (TypeScript + Zod), 100 % couvert par les tests
apps/web/            Application React + Vite + Tailwind v4 (coque SaaS, Mes projets, Nouveau projet, Rapport, Hypothèses, Fiscalité, Revente, Visite), Cloudflare Pages
apps/worker/         Serveur Hono sur Cloudflare Workers : proxy des données publiques (cache KV, limite de débit)
apps/                À venir : extension
data/                Référentiels publics pré-agrégés (DVF, loyers ANIL, taxe foncière, zonage ABC, usure, communes) publiés sur R2 par GitHub Action
marque/              Identité de marque Deklic : logos SVG, favicon, icônes, image de partage, guide (ADR-005)
.product/            Spécifications, ADR, design, état du pipeline de développement
.claude/commands/    Skills du pipeline de développement (Claude Code)
```

## Commandes

```bash
npm install
npm run lint          # eslint . --max-warnings=0
npm run format:check  # prettier --check .
npm run typecheck     # tsc --noEmit dans chaque workspace
npm run test          # vitest run
npm run test:coverage # vitest run --coverage (seuil 100 % sur packages/moteur, apps/worker, data et les modules de logique d'apps/web)
npm run test:e2e      # vite build puis playwright test : parcours complets dans Chromium (apps/web/e2e)
npm run build         # build de chaque workspace
```

Node 22 ou plus. La CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) exécute ces six commandes sur chaque pull request (441 tests au 13/09/2026, dont 135 pour les référentiels). Une PR est fusionnée automatiquement dès que le check `verify` est vert (`gh pr merge <n> --auto --merge`) ; `master` refuse tout merge sans ce check. Un second job `e2e` joue les huit parcours Playwright dans Chromium ; il n'est pas encore requis pour fusionner.

## Le moteur (`@loupe/moteur`)

```ts
import { calculerProjet, projetExemple } from '@loupe/moteur';

const resultats = calculerProjet(projetExemple);
resultats.verdict.feux; // cinq feux : prix, rendement, cash-flow, effort, risques
resultats.cashflow.mensuel; // cash-flow mensuel charges pleines, vacance déduite
resultats.fiscalite.regimes.lmnp_reel; // projection année par année, art. 39 C
resultats.revente.cashNetVendeur; // valeur − frais − CRD − IRA − impôt sur la plus-value
resultats.rendement.tri; // TRI réel sur les flux annuels
resultats.scenarios?.prixCibles; // prix pour cash-flow nul, net 6 %, brut 8 %
```

- **Entrée** : un `Projet` validé par Zod (`ProjetSchema`), avec des valeurs par défaut sourcées (vacance 3 semaines, entretien 0,5 %, PS BIC 18,6 %…).
- **Sortie** : des `Resultats` conformes à `ResultatsSchema` (aucun NaN, aucune clé non documentée), jamais persistés.
- **Règles datées** dans `src/regles/2026-09.ts` : chaque projet porte sa `versionRegles`. Les valeurs sans source consolidée sont listées dans `meta.aConfirmer`, les simplifications dans `meta.simplifications`.
- **Pur** : aucune I/O, aucune date système, aucun aléatoire, aucun `console`. Le LLM n'intervient jamais dans un calcul.
- **Tests** : 204 tests, couverture 100 % (lignes, branches, fonctions), cas de référence vérifiés à la main sur le projet d'exemple (T3 65 m², Marseille 5e, 155 000 € FAI).

Modules : `financement` (frais d'acquisition par formule, PMT, amortissement avec différés, TAEG, HCSF, IRA), `cashflow`, `fiscalite` (micro-BIC, LMNP réel, micro-foncier, nu réel), `revente` (plus-value, abattements, surtaxe, réintégration LMNP), `rendement` (brut/net/net-net, TRI, enrichissement), `verdict`, `scenarios`.

## L'application web (`@loupe/web`)

```bash
npm run dev -w apps/web      # http://localhost:5173
npm run build -w apps/web    # apps/web/dist
```

- Direction visuelle « Le guide » ([ADR-004](.product/adr/004-direction-visuelle.md)) : tokens dans `src/index.css`, polices Outfit et Nunito Sans.
- Coque d'application : barre latérale (projets, nouveau projet, comparer, méthode, extension, profil), en-tête projet à onglets (Rapport, Hypothèses, Fiscalité, Revente, Visite).
- Écrans livrés : **Nouveau projet** (lien d'annonce reconnu sur LeBonCoin, SeLoger, Bien'ici, PAP, Logic-Immo ; texte de l'annonce collé et lu par règles ; ou saisie manuelle ; formulaire Vérifier avec provenance de chaque valeur), **Mes projets** (liste, filtres, statut, suppression) et **Rapport** (verdict, cinq feux, prix vs ventes réelles, cash-flow, leviers, fiscalité, revente), calculés par le moteur. Les pages Comparer, Méthode et Extension affichent un état « bientôt ».
- La lecture automatique de la page d'annonce arrive avec l'extension navigateur (ADR-002) ; le texte collé n'est jamais conservé, seuls les champs lus le sont.
- Onglet **Hypothèses** : toutes les valeurs d'un projet sont modifiables (bien, marché, achat, financement, location, charges, fiscalité, revente), avec la provenance de chacune ; chaque modification est validée, enregistrée et recalculée instantanément.
- Onglet **Fiscalité** : les quatre régimes côte à côte (impôt cumulé, cash-flow après impôt, explication), bouton « Retenir ce régime », frise « quand commencez-vous à payer », tableau année par année du régime retenu.
- Onglet **Revente** : horizons 5 / 10 / 15 / 20 ans cliquables (`src/analyses/`), revente et enrichissement détaillés, plus-value poste par poste (abattements, IR, prélèvements sociaux, surtaxe, réintégration des amortissements).
- Onglet **Visite** : les points de vigilance du projet, cochables, classés en documents à demander, à vérifier sur place, à régler avant l'offre.
- Projets stockés dans le navigateur (`localStorage`, clé `loupe.projets.v1`), validés par Zod ; le premier lancement crée le projet d'exemple.
- Textes centralisés dans `src/textes/` : les codes du moteur deviennent des phrases là et nulle part ailleurs.
- Tests : Vitest + Testing Library (jsdom), couverture 100 % sur `stockage/`, `formatage/`, `textes/`, `annonces/`, `hypotheses/`, `analyses/`.

## Tests de bout en bout (`apps/web/e2e`)

```bash
npx playwright install chromium   # une fois : télécharge le navigateur (~150 Mo)
npm run test:e2e                  # construit apps/web, sert dist/ sur 127.0.0.1:5199, joue les parcours dans Chromium
npx playwright show-report apps/web/playwright-report   # rapport HTML du dernier lancement (traces et captures des échecs)
```

- Huit parcours Playwright rejouent ce que l'utilisateur fait vraiment, sur le **build de production** servi par `vite preview` : premier lancement (projet d'exemple dans « Mes projets »), rapport (verdict, cinq feux, chiffres clés), hypothèses (le loyer change le cash-flow, une valeur invalide est refusée), fiscalité (« Retenir ce régime »), revente (« Dans 20 ans »), visite (cases et compteur), nouveau projet à la main puis suppression, persistance après rechargement.
- Sélecteurs par rôle, libellé ou texte (jamais de classe CSS) ; un contexte de navigateur neuf par test, donc un stockage vide ; aucune attente fixe. Configuration dans [`apps/web/playwright.config.ts`](apps/web/playwright.config.ts), détails dans [`.product/architecture/e2e-playwright.md`](.product/architecture/e2e-playwright.md).
- En CI, le job `e2e` (séparé de `verify`) installe Chromium, lance `npm run test:e2e` et conserve le rapport sept jours en cas d'échec. Il n'est pas requis pour fusionner une PR pour l'instant.

## Le serveur (`@loupe/worker`)

```bash
npm run dev -w apps/worker      # http://localhost:8787 (wrangler dev : KV et limite de débit simulés)
npm run build -w apps/worker    # wrangler deploy --dry-run
npm run deploy -w apps/worker   # déploiement (compte Cloudflare connecté par `npx wrangler login`)
```

- Hono sur Cloudflare Workers. Routes : `GET /health` ; `GET /proxy/geocodage?q=…&limit=…&codePostal=…` (Géoplateforme IGN), réponse au contrat Loupe : libellé, score, latitude/longitude, précision (adresse, rue, lieu-dit, commune), clé BAN, code INSEE ; `POST /extract { texte }` : un modèle de langage lit le texte d'une annonce et rend 20 champs (prix, surface, étage, ascenseur, DPE, charges, taxe foncière, année, lots, loyer actuel…), chacun validé ou `null`, jamais inventé.
- Lecture des annonces : connecteur « chat completions » réglé par `LLM_URL` et `LLM_MODELE` (OpenRouter et le modèle gratuit `nvidia/nemotron-3-super-120b-a12b:free` par défaut ; Mistral direct en changeant l'URL), secret `OPENROUTER_API_KEY` posé dans Cloudflare. Le texte n'est ni stocké ni journalisé : son empreinte sert de clé de cache 30 jours. Sans clé, `/extract` répond `503 EXTRACTION_INDISPONIBLE` et l'application garde sa lecture par règles.
- Chaque réponse amont est validée (Zod) puis gardée en cache KV 24 h, partagé entre tous les utilisateurs ; en-tête `X-Loupe-Cache: HIT|MISS`. Limite : 60 requêtes par minute et par adresse IP. CORS : production, previews Pages, localhost.
- Erreurs en codes (`SERVICE_INCONNU`, `PARAMETRES_INVALIDES`, `TROP_DE_REQUETES`, `AMONT_INDISPONIBLE`, `AMONT_SATURE`, `AMONT_INVALIDE`) : l'interface les traduit. Journal structuré (une ligne JSON par événement), sans adresse IP ni adresse saisie.
- Tests : Vitest (Node), l'application est exercée par `app.request()` avec des doubles (cache, limiteur, amont, horloge) ; couverture 100 %.

### Déployer le Worker

Le Worker est déployé sur `https://loupe-worker.erreip-gorguel.workers.dev` (espace KV `KV_CACHE` créé le 13/09/2026, identifiant dans `apps/worker/wrangler.toml`). Pour redéployer après un changement :

1. `npx wrangler login` si la machine n'est pas encore connectée au compte Cloudflare (une fois, dans le navigateur ; sous PowerShell, `npx.cmd wrangler login` si l'exécution des scripts est bloquée).
2. `npm run deploy -w apps/worker`.

### Déployer sur Cloudflare Pages

1. Dans le tableau de bord Cloudflare, créer un projet Pages connecté au dépôt GitHub.
2. Commande de build : `npm ci && npm run build -w apps/web` · dossier de sortie : `apps/web/dist` · Node 22.
3. `apps/web/public/_redirects` gère le rechargement des routes de l'application.

En local : `npx wrangler pages deploy dist` depuis `apps/web` (compte Cloudflare requis).

## Les référentiels (`@loupe/data`)

```bash
npm run referentiels -w data -- --source tout --departement 13   # un département, dans data/dist/
npm run referentiels -w data -- --source dvf                     # France entière (index national DVF)
npm run referentiels -w data -- --aide
```

- Six sources publiques pré-agrégées en petits fichiers par département ou par commune, lisibles par le navigateur : ventes de logements DVF des 24 derniers mois (`dvf/<millesime>/<codeInsee>.csv` + index des prix au m² par département), loyers ANIL (`loyers/<millesime>/<dep>.json`), taux de taxe foncière REI (`taxe-fonciere/<annee>/<dep>.json`), zonage ABC (`zonage/<dep>.json`), seuils de l'usure (`usure/courant.json`), communes et arrondissements (`communes/<dep>.json`). Chaque source datée publie aussi `<prefixe>/courant.json` avec le millésime à lire.
- Tout fichier publié porte `genereLe`, `millesime` et `source` (nom, URL, licence, mention imposée) et est validé par un schéma Zod (`data/src/schemas/`). Sources, licences, formats d'origine et transformations : [`data/SOURCES.md`](data/SOURCES.md).
- TypeScript exécuté directement par Node (`--experimental-strip-types`), lecture en flux (les CSV DVF ne sont jamais chargés en mémoire), téléchargement avec trois tentatives, journal JSON sur la sortie d'erreur.
- Les seuils de l'usure n'ont pas de source ouverte automatisable : ils sont saisis chaque trimestre dans `data/sources/usure/<AAAA>-T<n>.json` depuis la publication de la Banque de France, et contrôlés (seuil = taux moyen + un tiers).
- Tests : 135 tests, couverture 100 % sur `data/src/` (hors `cli.ts`), sur des extraits réels sans aucune requête réseau.

### Publier sur R2 (GitHub Action `referentiels.yml`)

L'Action tourne le 2 de chaque mois à 03:30 UTC, ou à la main (onglet Actions → « Référentiels » → source et département). Elle génère les fichiers puis les synchronise vers le bucket R2 `loupe-data` par l'API S3 (`aws s3 sync`, préinstallé sur les runners) ; sans les secrets ci-dessous elle génère seulement et prévient. À faire une fois dans le compte Cloudflare :

1. R2 → Créer un bucket nommé `loupe-data` (région automatique).
2. R2 → Gérer les jetons d'API R2 → Créer un jeton « Object Read & Write » limité au bucket `loupe-data` ; noter l'Access Key ID et la Secret Access Key.
3. Dans GitHub, Settings → Secrets and variables → Actions : `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_ACCOUNT_ID` (l'identifiant de compte affiché dans le tableau de bord R2).
4. Lancer l'Action à la main une première fois sur un département (par exemple `13`) puis sur la France entière.

## Avertissement

Deklic est un outil d'aide à la décision, pas un conseil en investissement ni un conseil fiscal. Les règles fiscales sont celles connues au 13 septembre 2026.
