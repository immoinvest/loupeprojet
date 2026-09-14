# Deklic

Colle le lien d'une annonce immobilière, obtiens l'analyse complète de rentabilité locative : financement, cash-flow, fiscalité (quatre régimes côte à côte), revente, rendement et TRI, verdict à cinq feux, scénarios « et si ».

Gratuit, sans compte obligatoire (compte optionnel par Google, Apple ou code e-mail), tout se calcule dans le navigateur. Spécification produit : [`.product/reference/spec-produit-v1.html`](.product/reference/spec-produit-v1.html). Décisions d'architecture : [`.product/adr/`](.product/adr/).

## Stack

Monorepo npm workspaces, TypeScript strict, Vitest, ESLint, Prettier. Cible : React + Vite sur Cloudflare Pages, Hono sur Cloudflare Workers, extension navigateur pour la lecture des annonces (voir [ADR-001](.product/adr/001-stack.md)).

## Structure

```
packages/moteur/     Moteur de calcul pur (TypeScript + Zod), 100 % couvert par les tests
packages/capture/    Contrat de capture d'une annonce (schéma, encodage pour fragment d'URL, règles de lecture par portail), partagé par l'extension, le bouton-favori et le web
apps/web/            Application React + Vite + Tailwind v4 (coque SaaS, Mes projets, Nouveau projet, Rapport, Hypothèses, Fiscalité, Revente, Visite, Comparer, Méthode, impression, partage, Extension), Cloudflare Pages
apps/worker/         Serveur Hono sur Cloudflare Workers : proxy des données publiques (cache KV, limite de débit)
apps/comptes/        Comptes optionnels (Better Auth sur Hono) : Google, Apple ou code e-mail, servis par le worker Pages sur l'origine du site, base D1
apps/extension/      Extension navigateur (Manifest V3, Chrome/Edge/Firefox) : lit l'annonce ouverte et l'envoie à Deklic ; règles par portail
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
npm run test:coverage # vitest run --coverage (seuil 100 % sur packages/moteur, packages/capture, apps/worker, apps/comptes, apps/extension, data et les modules de logique d'apps/web)
npm run test:e2e      # vite build puis playwright test : parcours complets dans Chromium (apps/web/e2e)
npm run build         # build de chaque workspace
```

Node 22 ou plus. La CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) exécute ces six commandes sur chaque pull request (980 tests au 14/09/2026, dont 135 pour les référentiels, 119 pour la capture, l'extension et le bouton-favori, 30 pour l'impression, le partage, Comparer et Méthode, 91 pour les comptes, 65 pour le responsive et l'application mobile, et 19 pour le curseur d'horizon de revente). Une PR est fusionnée automatiquement dès que le check `verify` est vert (`gh pr merge <n> --auto --merge`) ; `master` refuse tout merge sans ce check. Un second job `e2e` joue les parcours Playwright dans Chromium sur ordinateur, téléphone et tablette, puis mesure 16 écrans sur 9 formats ; il n'est pas encore requis pour fusionner.

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
- Coque d'application : barre latérale (projets, nouveau projet, comparer, méthode, extension, profil), en-tête projet à onglets (Rapport, Estimation, Hypothèses, Fiscalité, Revente, Visite) ; sous 1 024 px, la barre latérale devient un tiroir ouvert depuis une barre d'app.
- Écrans livrés : **Nouveau projet** (lien d'annonce reconnu sur LeBonCoin, SeLoger, Bien'ici, PAP, Logic-Immo ; page lue par l'extension ou le bouton-favori ; texte de l'annonce collé et lu par règles ; ou saisie manuelle ; formulaire Vérifier avec provenance de chaque valeur), **Mes projets** (liste, filtres, statut, suppression), **Rapport** (verdict, cinq feux, prix vs ventes réelles, cash-flow, leviers, fiscalité, revente), calculés par le moteur, et **Extension navigateur** (bouton-favori à glisser, guide de l'extension).
- Lecture automatique de la page d'annonce (ADR-002) : l'extension ou le bouton-favori ouvre `/projets/nouveau#capture=…` ; le fragment est décodé, validé (Zod), affiché dans Vérifier avec les badges `annonce`, puis effacé de l'adresse. Il n'est jamais envoyé au serveur ; le texte de l'annonce sert à l'extraction puis disparaît, seuls les champs lus sont conservés.
- Bouton-favori : `npm run build -w apps/web` construit d'abord `public/capture.js` (règles incluses, adresse de production ou de l'aperçu Cloudflare Pages, ou `LOUPE_BASE_URL`). Le favori lui-même (`src/bookmarklet/favori.ts`) est minuscule : il charge `capture.js` depuis Deklic au clic, donc il reste à jour et se glisse ou se colle dans la barre de favoris depuis la page `/extension` (bouton « Copier le favori »). Si un site bloque les scripts externes, le favori le dit et l'extension prend le relais.
- Onglet **Hypothèses** : toutes les valeurs d'un projet sont modifiables (bien, marché, achat, financement, location, charges, fiscalité, revente), avec la provenance de chacune ; chaque modification est validée, enregistrée et recalculée instantanément.
- Onglet **Fiscalité** : les quatre régimes côte à côte (impôt cumulé, cash-flow après impôt, explication), bouton « Retenir ce régime », frise « quand commencez-vous à payer », tableau année par année du régime retenu.
- Onglet **Revente** : curseur « Revente dans N ans » de 1 à 30 ans (`src/composants/Curseur.tsx`, générique et accessible : clavier, `aria-valuetext`, 44 px au doigt ; repères 5 à 30, seuils 22 et 30 ans et taux global d'imposition de la plus-value de l'année choisie lus dans les règles par `src/analyses/plus-value.ts`), chiffres en direct pendant le glissement et projet enregistré au relâchement, quatre cartes repères 5 / 10 / 15 / 20 ans, revente et enrichissement détaillés, plus-value poste par poste (abattements, IR, prélèvements sociaux, surtaxe, réintégration des amortissements). À l'impression, le curseur devient un texte.
- Onglet **Visite** : les points de vigilance du projet, cochables, classés en documents à demander, à vérifier sur place, à régler avant l'offre.
- **Enrichissement** (`src/enrichissement/`) : « Lire le texte » fait lire l'annonce par l'IA du Worker (les règles comblent ses trous, ou prennent le relais s'il ne répond pas) ; à la création, le bien est situé (code postal + ville) et reçoit la médiane et les quartiles des ventes réelles (DVF) de son arrondissement ou de sa commune, et le loyer de référence ANIL, marqués « donnée publique ». Sans Worker, le projet est créé comme avant, sans repère de marché. Adresse du Worker : variable `VITE_WORKER_URL` au build (production par défaut).
- Onglet **Estimation** : le prix estimé du bien, comme un estimateur en ligne mais chiffre par chiffre. Une fois l'adresse exacte connue (agence, diagnostics), le Worker (`GET /marche/adresse`) classe les ventes réelles de la commune en même immeuble (parcelle cadastrale), parcelles voisines (API Carto de l'IGN), même côté de la rue et en face (code de voie et parité des numéros), cercles de 100, 200 et 300 m, et ramène chaque vente au prix d'aujourd'hui par l'évolution locale mesurée sur cinq ans (courbe par semestre). « Utiliser ce repère pour l'estimation » donne au moteur les ventes comparables ; l'estimation place le bien selon son état (à rénover = premier quartile, rénové = troisième), puis applique des corrections sourcées et désactivables : DPE (Notaires de France), étage et ascenseur, balcon ou terrasse (MeilleursAgents), charges de copropriété comparées au repère ARC. Fourchette et confiance selon le nombre et la proximité des ventes ; le feu prix compare le prix affiché à cette estimation. La même analyse retrouve **le DPE du logement** dans la base ADEME (le plus ressemblant est proposé, appliqué d'un clic), **les risques de l'adresse** d'après Géorisques (comptés dans le verdict, lien vers le rapport officiel) et **le loyer de marché** ANIL ramené au bien (loyer de référence, et loyer visé d'un clic) ; les ventes des communes ou arrondissements voisins comptent dans les cercles. Aucun modèle de langage. L'adresse est gardée avec le projet ; l'analyse, refaite à l'ouverture, actualise le projet.
- **PDF** : le bouton de l'en-tête projet ouvre `/projets/:id/imprimer`, le dossier complet (Rapport, Fiscalité, Revente, Visite, un volet par page, en-tête et avertissement), et lance l'impression du navigateur ; « Enregistrer au format PDF » donne le fichier. Styles `@media print` dans `src/index.css`.
- **Partager** : le bouton copie un lien `/partage#p=…` qui contient le projet entier (base64url dans le fragment de l'URL, jamais envoyé au serveur, validé par Zod à l'ouverture). La personne qui le reçoit lit le dossier et peut l'ajouter à ses projets ; un lien abîmé est refusé avec une phrase.
- **Comparer** (`/comparer`) : deux à cinq projets côte à côte (prix, prix au m², écart avec les ventes, loyer, cash-flow, rendements, effort, impôt, revente, TRI, enrichissement, risques) avec leurs feux ; tri par ligne, meilleure valeur en vert.
- **Comment c'est calculé** (`/methode`) : chaque module du moteur expliqué, chaque constante avec sa valeur lue dans les règles datées et sa source, les valeurs « à confirmer » signalées, les simplifications assumées.
- Projets stockés dans le navigateur (`localStorage`, clé `loupe.projets.v1`), validés par Zod ; le premier lancement crée le projet d'exemple.
- Textes centralisés dans `src/textes/` : les codes du moteur deviennent des phrases là et nulle part ailleurs.
- Compte optionnel : page **Connexion** (`/connexion`, hors de la coque : Google, Apple, code par e-mail), page **Mon compte** (`/compte` : nom, méthodes liées, déconnexion, suppression), profil dans la barre latérale ; client `src/compte/` (voir « Les comptes »).
- **Responsive** (feature `responsive`, [ADR-007](.product/adr/007-application-mobile.md)) : Deklic tient de 320 à 1 920 px. Sous 1 024 px, la navigation passe dans un tiroir (« Ouvrir le menu », Échap, voile) ; l'en-tête de projet passe à la ligne et ses onglets défilent ; chaque écran a sa mise en page téléphone (`src/composants/mise-en-page.tsx` : marges, titres) et garde sa mise en page d'ordinateur à l'impression. Au doigt (`pointer-coarse:`), cibles de 44 px et champs en 16 px.
- **Application installable** : manifeste complet (icônes adaptatives, raccourcis Nouveau projet et Mes projets), bouton « Installer l'application » dans le profil quand le navigateur le propose (`src/application/installation.ts`), marche à suivre Android et iPhone sur la page Extension.
- **Hors ligne** : service worker écrit à la main (`src/sw/service-worker.ts`, décisions pures dans `src/hors-ligne/`, construit par `vite.hors-ligne.config.ts` vers `dist/sw.js`). Une fois visitée, Deklic s'ouvre sans réseau jusqu'aux volets d'un projet ; le Worker et l'API des comptes ne passent jamais par son cache. Retrait d'urgence : `.product/architecture/responsive.md`, section 7.
- **Partage sur téléphone** : « Partager → Deklic » depuis l'app d'un portail (Android, application installée) ouvre Nouveau projet avec le lien de l'annonce (cible de partage du manifeste, `src/annonces/partage-recu.ts` ; le texte partagé reste sur l'appareil) ; « Partager » un projet ouvre la feuille de partage du téléphone (`src/application/partage-natif.ts`), et copie le lien à la souris.
- Tests : Vitest + Testing Library (jsdom), couverture 100 % sur `stockage/`, `formatage/`, `textes/`, `annonces/`, `hypotheses/`, `analyses/`, `bookmarklet/`, `enrichissement/`, `compte/`, `application/`, `hors-ligne/` ; tests de propriétés à graine fixe (`tests/tirage.ts`) sur le partage reçu et le cache du service worker. Les tests n'appellent jamais le réseau : `AppEnMemoire` utilise un client du Worker hors ligne et un client des comptes en mémoire, ou les faux clients qu'on lui passe.

## L'extension navigateur (`@loupe/extension`) et le contrat de capture (`@loupe/capture`)

```bash
npm run build -w apps/extension       # dist/chrome (Chrome, Edge, Brave) et dist/firefox, adresse de production
npm run build:dev -w apps/extension   # idem, en visant http://localhost:5173
npm run dev -w apps/extension         # reconstruction à chaque modification
```

- **Coller le lien suffit** : dans Nouveau projet, un lien LeBonCoin, SeLoger, Bien'ici, PAP ou Logic-Immo collé est lu par l'extension dans un onglet du navigateur (ouvert caché à côté de Deklic, affiché un instant si la page l'exige, puis refermé) ; l'IA complète à partir du texte ce que la page ne donne pas ; le formulaire Vérifier se remplit. Dialogue page ↔ extension par `window.postMessage` et un script « pont » sur les pages Deklic ; voir [`.product/architecture/lecture-auto.md`](.product/architecture/lecture-auto.md).
- Sur une annonce ouverte, l'icône Deklic puis **Analyser dans Deklic** fait la même lecture. Permissions : `activeTab`, `scripting` et accès aux cinq portails ; aucun stockage, aucune requête vers nos serveurs (seule la requête `/realEstateAd.json` que Bien'ici fait lui-même, sur Bien'ici).
- Règles de lecture par portail dans `apps/extension/regles/<portail>.json` (versionnées `<portail>-AAAA-MM-JJ`) : pour chaque champ, JSON-LD schema.org, puis état applicatif de la page, puis balises `og:`, puis sélecteurs CSS. Un portail qui change de maquette se corrige en éditant un JSON et sa fixture. La structure de PAP est relevée sur une vraie annonce ; LeBonCoin, SeLoger, Bien'ici et Logic-Immo sont construits d'après la structure connue des portails et restent à vérifier sur une vraie annonce.
- `@loupe/capture` : `CaptureSchema` (version 1), `encoderCapture` / `decoderCapture` (base64url, jamais d'exception), `resoudreAnnonce`, moteur de règles (`capturer`, `creerRegistre`). Tests : 68 pour le contrat et le moteur de règles, 33 pour l'extension (règles sur pages enregistrées, popup avec un faux `chrome`), couverture 100 %.
- Installation : voir [`apps/extension/README.md`](apps/extension/README.md) (charger l'extension non empaquetée dans Chrome, Edge ou Firefox). La publication sur les stores est une décision à part (compte et frais).

## Tests de bout en bout (`apps/web/e2e`)

```bash
npx playwright install chromium   # une fois : télécharge le navigateur (~150 Mo)
npm run test:e2e                  # construit apps/web, sert dist/ sur 127.0.0.1:5199, joue les parcours dans Chromium
npx playwright show-report apps/web/playwright-report   # rapport HTML du dernier lancement (traces et captures des échecs)
```

- Les parcours Playwright rejouent ce que l'utilisateur fait vraiment, sur le **build de production** servi par `vite preview`, sur trois appareils (ordinateur, téléphone Pixel 7, tablette 768 × 1 024 tactile) : premier lancement (projet d'exemple dans « Mes projets »), rapport (verdict, cinq feux, chiffres clés), hypothèses (le loyer change le cash-flow, une valeur invalide est refusée), fiscalité (« Retenir ce régime »), revente (« Dans 20 ans »), visite (cases et compteur), nouveau projet à la main puis suppression, persistance après rechargement, ouverture hors ligne, annonce partagée vers Deklic (servie par le cache, sans le serveur), lien de partage à copier à la main, ordre des cartes de la page Extension.
- Spec des formats (`e2e/responsive.spec.ts`, projet `formats`) : 16 écrans mesurés sur 9 formats de 320 à 1 920 px (aucun débordement horizontal, cibles de 44 px et champs de 16 px au doigt), puis le menu, l'onglet actif et l'impression A4. Le Worker et l'API des comptes y sont simulés (`e2e/reponses-worker.ts`, `e2e/formats.ts`).
- Sélecteurs par rôle, libellé ou texte (jamais de classe CSS) ; un contexte de navigateur neuf par test, donc un stockage vide ; aucune attente fixe. Configuration dans [`apps/web/playwright.config.ts`](apps/web/playwright.config.ts), détails dans [`.product/architecture/e2e-playwright.md`](.product/architecture/e2e-playwright.md).
- En CI, le job `e2e` (séparé de `verify`) installe Chromium, lance `npm run test:e2e` et conserve le rapport sept jours en cas d'échec. Il n'est pas requis pour fusionner une PR pour l'instant.

## Le serveur (`@loupe/worker`)

```bash
npm run dev -w apps/worker      # http://localhost:8787 (wrangler dev : KV et limite de débit simulés)
npm run build -w apps/worker    # wrangler deploy --dry-run
npm run deploy -w apps/worker   # déploiement (compte Cloudflare connecté par `npx wrangler login`)
```

- Hono sur Cloudflare Workers. Routes : `GET /health` ; `GET /proxy/geocodage?q=…&limit=…&codePostal=…` (Géoplateforme IGN), réponse au contrat Loupe : libellé, score, latitude/longitude, précision (adresse, rue, lieu-dit, commune), clé BAN, code INSEE ; `POST /extract { texte }` : un modèle de langage lit le texte d'une annonce et rend 22 champs (prix, surface, étage, ascenseur, DPE, charges, taxe foncière, année, lots, loyer actuel, état du bien, balcon ou terrasse…), chacun validé ou `null`, jamais inventé ; `GET /marche?codeInsee=…&codePostal=…&type=…&pieces=…` : médiane et quartiles des ventes DVF, loyer d'annonce ANIL et zone ABC de la commune (ou de l'arrondissement désigné par le code postal), lus dans le bucket R2 `deklic-data` et gardés en cache 24 h, avec la source de chaque valeur.
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
4. Comptes : voir « Mettre en service les comptes » (variable de build `DEKLIC_COMPTES=1`, binding D1 `DB`, flag `nodejs_compat`, secrets).

En local : `npx wrangler pages deploy dist` depuis `apps/web` (compte Cloudflare requis).

## Les comptes (`@loupe/comptes`)

Compte optionnel : connexion par Google, Apple ou un code à 6 chiffres reçu par e-mail ([ADR-006](.product/adr/006-comptes-better-auth.md), Better Auth). Rien n'est verrouillé sans compte ; les projets restent sur l'appareil (la synchronisation viendra ensuite).

```bash
npm run dev -w apps/comptes                 # API sur http://localhost:8787 (D1 locale, migrations appliquées)
npm run dev:node -w apps/comptes            # la même API sur Node (base SQLite locale), si wrangler dev ne démarre pas
npm run dev -w apps/web                     # le site relaie /api vers le port 8787
npm run migration:generer -w apps/comptes   # après une montée de version de Better Auth
```

- L'API répond **sur l'origine du site** : avec `DEKLIC_COMPTES=1`, le build de `apps/web` dépose le worker des comptes dans `dist/_worker.js` et `dist/_routes.json`, qui ne lui envoie que `/api/*` (cookie de session de première partie).
- Routes : `GET /api/comptes/sante`, `GET /api/comptes/fournisseurs` (boutons à afficher), `/api/auth/*` (Better Auth, derrière une garde : hôte connu, routes utilisées seulement, code de connexion seulement).
- Code valable 10 minutes, invalidé après 3 erreurs ; 3 envois et 10 saisies par minute par adresse IP ; session de 7 jours en cookie `HttpOnly`, `SameSite=Lax`, `Secure` ; suppression du compte réservée aux sessions de moins d'un jour ; aucune adresse e-mail dans les journaux.
- Base D1 `deklic-comptes` (tables de Better Auth), migration `apps/comptes/migrations/0001_comptes.sql`, testée à travers une D1 simulée sur `node:sqlite`.
- En développement, sans clé Resend, le code s'affiche dans le terminal du worker (événement `courriel.dev`).
- Web : `src/compte/` (client réseau fetch + Zod, client mémoire, `CompteProvider`), écrans `/connexion` et `/compte`, profil dans la barre latérale.

### Mettre en service les comptes (une fois, compte Cloudflare de Pierre)

État au 14/09/2026 : étapes 1 à 4 configurées en Production, Apple non configuré. Sans ces réglages, le site se déploie comme avant et la page de connexion indique que la connexion n'est pas disponible.

1. **Base D1** : fait le 14/09/2026. La base `deklic-comptes` est créée dans la juridiction UE (`npx wrangler d1 create deklic-comptes --jurisdiction eu`), son identifiant est dans `apps/comptes/wrangler.toml` et la migration 0001 est appliquée. Nouvelle migration : `npx wrangler d1 migrations apply deklic-comptes --remote` depuis `apps/comptes`.
2. **Projet Pages `deklic`** (adresse loupeprojet.pages.dev ; tableau de bord Cloudflare, Workers & Pages, deklic, Settings), en Production (Preview facultatif) :
   - Bindings : D1 database, nom de variable `DB`, base `deklic-comptes` ;
   - Runtime : Compatibility flags, `nodejs_compat` ;
   - Variables and Secrets : `DEKLIC_COMPTES` = `1` (type Text, lu au build), `BETTER_AUTH_SECRET` (type Secret, 32 caractères ou plus, par exemple `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`) ;
   - tout ce qui est secret en type **Secret** : une valeur en type Text reste lisible dans le tableau de bord et s'affiche avec `wrangler pages download config` ;
   - puis relancer un déploiement : les réglages de Pages ne s'appliquent qu'aux déploiements suivants (nouveau commit sur `master`, ou « Retry deployment » sur le dernier déploiement de production).
3. **E-mails (Resend)** : une clé API « Sending access » en type Secret `RESEND_API_KEY`, l'expéditeur en variable `COURRIEL_EXPEDITEUR` (par exemple `Deklic <bonjour@deklic.io>`). Tant que le domaine n'est pas vérifié chez Resend, seuls les e-mails vers l'adresse du compte Resend partent.
4. **Google** : console.cloud.google.com, Google Auth Platform (audience External, application publiée par « Publish app »), Clients, client « Web application », URI de redirection autorisée `https://loupeprojet.pages.dev/api/auth/callback/google`. `GOOGLE_CLIENT_ID` en type Text, `GOOGLE_CLIENT_SECRET` en type Secret : le secret commence par `GOCSPX-`, ne s'affiche qu'à la création et se régénère par « Add Secret » sur la fiche du client.
5. **Apple** (programme développeur, 99 $/an, facultatif) : un Services ID (`APPLE_CLIENT_ID`) avec « Sign in with Apple », domaine `loupeprojet.pages.dev`, retour `https://loupeprojet.pages.dev/api/auth/callback/apple` ; une clé « Sign in with Apple » : `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (contenu du fichier .p8) et `APPLE_TEAM_ID`. Apple ne fonctionne pas sur localhost.

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

L'Action tourne le 2 de chaque mois à 03:30 UTC, ou à la main (onglet Actions → « Référentiels » → source et département). Elle génère les fichiers puis les synchronise vers le bucket R2 `deklic-data` par l'API S3 (`aws s3 sync`, préinstallé sur les runners) ; sans les secrets ci-dessous elle génère seulement et prévient. À faire une fois dans le compte Cloudflare :

1. R2 → Créer un bucket nommé `deklic-data` dans la juridiction européenne (« Specify jurisdiction », EU) : les données restent dans l'Union européenne et l'Action publie vers l'adresse S3 européenne `https://<compte>.eu.r2.cloudflarestorage.com`.
2. R2 → Gérer les jetons d'API R2 → Créer un jeton « Object Read & Write » limité au bucket `deklic-data` ; noter l'Access Key ID et la Secret Access Key.
3. Dans GitHub, Settings → Secrets and variables → Actions : `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_ACCOUNT_ID` (l'identifiant de compte affiché dans le tableau de bord R2).
4. Lancer l'Action à la main une première fois sur un département (par exemple `13`) puis sur la France entière.

## Avertissement

Deklic est un outil d'aide à la décision, pas un conseil en investissement ni un conseil fiscal. Les règles fiscales sont celles connues au 13 septembre 2026.
