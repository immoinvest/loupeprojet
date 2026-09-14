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
| `.product/backlog/`                       | Idées de Pierre à spécifier avant implémentation (fiches numérotées, questions ouvertes)   |

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
- **Livré** : `POST /extract` (`apps/worker/src/extraction/` : contrat de 22 champs validés un par un, prompt versionné, connecteur « chat completions » OpenRouter ou Mistral réglé par `LLM_URL`/`LLM_MODELE`, secret `OPENROUTER_API_KEY`, cache 30 jours par empreinte du texte, 10 lectures/min/IP ; sans clé → `503 EXTRACTION_INDISPONIBLE`). Modèle par défaut `nvidia/nemotron-3-super-120b-a12b:free` (ADR-003 amendé).
- **Livré** : enrichissement marché. Worker `GET /marche` (`apps/worker/src/marche/`, binding R2 `DONNEES` = bucket `deklic-data` en juridiction UE) : médiane et quartiles DVF, loyer ANIL, zone ABC d'une commune, arrondissement retrouvé par le code postal, cache 24 h. Web `apps/web/src/enrichissement/` : `ClientWorker` (réponses revalidées par Zod, échecs en codes, `clientHorsLigne` par défaut dans les tests et le contexte `coque/ClientWorker.tsx`), `lireAnnonce` (IA puis règles), `enrichirSaisie` (géocodage → marché) branchés dans `NouveauProjet.tsx` ; `construireProjet(saisie, id, enrichi)` ajoute `marche` et la provenance `dvf`/`anil`. Adresse du Worker : `VITE_WORKER_URL` au build, production sinon.
- **Livré** : tests de bout en bout Playwright (`apps/web/e2e/`, 8 parcours Chromium sur le build de production servi par `vite preview` sur 127.0.0.1:5199 ; `npm run test:e2e` construit puis teste ; sélecteurs par rôle et libellé, contexte neuf par test ; job CI `e2e` séparé de `verify`, pas encore requis pour le merge). Détails : `.product/architecture/e2e-playwright.md`.
- **Livré** : `data/` (`@loupe/data`, feature `referentiels`) : `npm run referentiels -w data -- --source <dvf|loyers|taxe-fonciere|zonage|usure|communes|tout> [--departement 13]` génère dans `data/dist/` les référentiels par département ou commune (DVF : CSV par commune sur les cinq dossiers annuels + index prix/m² sur 24 mois, loyers ANIL, taux TFPB REI, zonage ABC, seuils de l'usure saisis dans `data/sources/usure/`, communes API Géo), formats Zod dans `data/src/schemas/`, `<prefixe>/courant.json` = millésime à lire, sources et licences dans `data/SOURCES.md`. GitHub Action `referentiels.yml` (cron mensuel + manuel) publie sur R2 `deklic-data` par `aws s3 sync` ; secrets `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_ACCOUNT_ID` à créer par Pierre (README). Le chargement par l'application = feature `enrichissement-marche`.
- **Livré** : feature `extension` : `packages/capture` (`@loupe/capture` : `CaptureSchema` version 1, `encoderCapture` / `decoderCapture` base64url pour `#capture=…`, `resoudreAnnonce` partagé, moteur de règles JSON-LD / état applicatif / meta / CSS : `capturer`, `creerRegistre`), `apps/extension` (WebExtension MV3 Chrome/Edge/Firefox, `activeTab` + `scripting` seulement, règles versionnées `regles/<portail>.json`, popup « Analyser dans Deklic », script de contenu, build `npm run build -w apps/extension` → `dist/chrome`, `dist/firefox`, à charger non empaquetée : `apps/extension/README.md`), web : `src/annonces/capture.ts` lit le fragment dans `NouveauProjet.tsx`, bouton-favori `public/capture.js` (construit par `vite.bookmarklet.config.ts`, ignoré par git) et page `/extension`. Le fragment n'est jamais envoyé au serveur ; la description sert à `extraireChamps` puis disparaît. Fixtures : PAP relevée sur une vraie annonce, les quatre autres à vérifier. Détails : `.product/architecture/extension.md`.
- **Livré** : feature `lecture-auto` : coller le lien d'une annonce dans Nouveau projet suffit quand l'extension est installée. La page détecte l'extension (`apps/web/src/annonces/extension.ts`, `window.postMessage`, protocole `@loupe/capture/pont.ts`) ; le script `pont.js` de l'extension (pages `*.loupeprojet.pages.dev` et localhost) relaie vers `arriere-plan.js`, qui ouvre l'annonce dans un onglet caché à côté de Deklic, la lit (`src/logique/lecteur.ts`), l'affiche en second essai si prix ou surface manquent, la referme et revient sur Deklic ; `completerAvecIa` (`enrichissement/lecture.ts`) comble par `/extract` les champs que seul le texte donne. Règles des cinq portails réécrites d'après les pages réelles du 13/09/2026 : LeBonCoin `__NEXT_DATA__`, SeLoger et Logic-Immo `__UFRN_LIFECYCLE_SERVERREQUEST__` (nouvelles adresses à identifiant alphanumérique), Bien'ici `/realEstateAd.json` (source `donnees`), PAP JSON-LD. Extension 0.2.0 : permissions d'hôte des cinq portails (Firefox : bouton « Autoriser la lecture automatique » du popup). Formulaire : type de bien, GES, lots et procédure de copropriété. Détails : `.product/architecture/lecture-auto.md`.
- **Livré** : feature `comptes` (`apps/comptes`, `@loupe/comptes`, ADR-006) : comptes optionnels par Google, Apple ou code à 6 chiffres reçu par e-mail (Better Auth 1.7). Hono servi par le worker Pages (`dist/_worker.js` déposé par le build de `apps/web` seulement si `DEKLIC_COMPTES=1` , avec `dist/_routes.json` = `/api/*`), base D1 `deklic-comptes` (migration `apps/comptes/migrations/0001_comptes.sql` générée par `npm run migration:generer -w apps/comptes`, testée à travers une D1 simulée sur `node:sqlite`), garde avant Better Auth (hôte connu, routes utilisées seulement, code de connexion seulement), e-mails par Resend (journal en dev), 3 envois et 10 saisies de code par minute par IP, cookies `HttpOnly` / `SameSite=Lax` / `Secure`, `ENVIRONNEMENT` = production par défaut (sans secret ni base : 503, le site reste servi). Web : `src/compte/` (client fetch + Zod, client mémoire, `CompteProvider` / `useCompte`, aides de saisie), écrans `/connexion` (hors coque) et `/compte`, profil dans la barre latérale, carte « Créer mon compte » active. Mise en service par Pierre : README, « Mettre en service les comptes ». Les projets ne sont pas encore synchronisés (feature suivante `sync-projets`). Détails : `.product/architecture/comptes.md`.
- **Livré** : feature `garder` (`.product/architecture/garder.md`) : impression `/projets/:id/imprimer` hors coque (`ModeDocument` réutilise les écrans en lecture seule, `@media print` dans `index.css`), partage sans compte `/partage#p=…` (`apps/web/src/stockage/partage.ts` : `ProjetEnregistre` en base64url dans le fragment, validé par Zod, rien d'enregistré avant « Ajouter »), Comparer (`apps/web/src/analyses/comparaison.ts` : 14 indicateurs, tri, meilleure valeur), Méthode (`apps/web/src/textes/methode*.ts` générés depuis `obtenirRegles()`, défauts lus par `analyses/defauts.ts`).
- **Production** : https://loupeprojet.pages.dev (Cloudflare Pages, branche `master`, build `npm ci && npm run build -w apps/web`). Worker : https://loupe-worker.erreip-gorguel.workers.dev (déployé à la main par `npm run deploy -w apps/worker`, machine connectée par `wrangler login` ; KV `KV_CACHE` = `a64f32a40a0846e1be258a7ea34a8090`).
- **Sessions parallèles** : fiches dans `.product/sessions/` (extension, referentiels, garder, e2e-playwright) ; chaque session parallèle tient son état dans `.product/pipeline/<slug>.json` et ne touche aux docs communes qu'en fin de feature. `.product/pipeline-state.json` reste à la session principale.
- **Livré** : analyse DVF à l'adresse (sans modèle de langage). Données : CSV `dvf/<millésime>/<codeInsee>.csv` avec `idParcelle, numero, suffixe, codeVoie, voie, carrez`. Worker `GET /marche/adresse` (`apps/worker/src/adresse/` : `analyserAdresse` pur — même immeuble, parcelles voisines, même côté, en face, cercles 100/200/300 m, repère à ≥ 5 comparables ; `voisinageDe` sur l'API Carto cadastre de l'IGN ; lecture R2 partagée dans `donnees/passe.ts`). Web : onglet « Adresse » du projet (`ecrans/Adresse.tsx`), adresse mémorisée dans `ProjetEnregistre.adresse`, repère appliqué à `marche.dvf` sur clic. Voir `.product/architecture/dvf-adresse.md`.
- **Livré** : estimation du prix du bien (feature `estimation-prix`, sans modèle de langage). Données : `dvf/<millésime>/tendance/<dep>.json` (médiane €/m² par semestre sur cinq ans, département et communes, seuil 20 ventes). Worker : `/marche/adresse` ramène chaque vente au dernier semestre publié (`adresse/tendance.ts` : série de la commune ou du département, moyenne mobile pondérée sur trois semestres) et renvoie `tendance`. Moteur : `estimerPrix` (`packages/moteur/src/estimation/`) — position selon `bien.etat` entre premier et troisième quartile, corrections sourcées additionnées (DPE, étage/ascenseur, balcon ou terrasse) et charges capitalisées au rendement local, désactivables par `projet.estimation.correctionsIgnorees`, fourchette selon la confiance ; règles `estimation` datées et « à confirmer » ; `Resultats.estimation` ; le feu prix compare au prix estimé. Web : onglet « Estimation » (`ecrans/adresse/Estimation.tsx`, `Tendance.tsx`), résumé dans le Rapport, section Méthode, champs État et Balcon ou terrasse (Hypothèses, Vérifier, lecture de l'annonce par règles et par l'IA, prompt v2). Voir `.product/architecture/estimation-prix.md`.
- **Livré** : marché complet (feature `marche-complet`, sans modèle de langage). Worker : services du proxy `/proxy/dpe` (`services/dpe.ts`, base ADEME `dpe03existant` à 30 m, cache 7 jours) et `/proxy/risques` (`services/risques.ts`, rapport Géorisques, `niveauDepuisStatut` : important = fort, modéré / existant / concerné = moyen, faible ; cache 30 jours) ; `/marche/adresse` ajoute les ventes des communes voisines (`adresse/voisines.ts` : huit points à 300 m situés par API Géo, arrondissements à Paris/Lyon/Marseille, quatre communes au plus, chaque vente actualisée par la tendance de sa commune), contrat v3. Web : `enrichissement/{dpe,risques,loyer}.ts` (classement des DPE par clé BAN, surface à 15 %, étage ; risques de l'adresse → `marche.risques` ; loyer ANIL − 8 % × surface, meublé + prime), cartes `ecrans/adresse/{Dpe,Loyer,Risques}.tsx` dans l'onglet Estimation (risques et loyer de référence appliqués d'eux-mêmes, DPE et loyer visé sur clic ; relancer l'analyse actualise le projet), `AdresseBien.codePostal`, bouton « Estimer le loyer » du formulaire Vérifier (`ecrans/formulaire/EstimerLoyer.tsx`, provenance `anil`). Voir `.product/architecture/marche-complet.md`.
- **Livré** : feature `responsive` (ADR-007, `.product/architecture/responsive.md`) : Deklic de 320 à 1 920 px et installable. Coque : tiroir sous 1 024 px (`coque/menu.ts`, `BarreApp.tsx`, `main` inert tiroir ouvert), en-tête de projet et onglets qui défilent, marges et titres par `composants/mise-en-page.tsx` avec leurs équivalents `print:`. Application : manifeste (icônes `maskable`, raccourcis, `share_target` GET vers `/projets/nouveau`), bouton « Installer l'application » (`application/installation.ts`), service worker écrit à la main (`sw/service-worker.ts` autour de `hors-ligne/strategie.ts`, build `vite.hors-ligne.config.ts` → `dist/sw.js` ; `/api/*` jamais intercepté, annonce partagée servie par la coque en cache, seule une page HTML devient la coque), partage reçu (`annonces/partage-recu.ts`), partage natif d'un projet (`application/partage-natif.ts`), carte « Sur téléphone et tablette » de la page Extension. Preuve : projets Playwright `ordinateur`, `telephone` (Pixel 7), `tablette` (768 × 1 024 tactile) et `formats` (18 écrans × 9 formats, Worker et comptes simulés). **Règle pour tout nouvel écran** : mobile d'abord (`sm`/`md`/`lg`/`xl` élargissent), équivalent `print:` de chaque changement de mise en page d'un volet imprimable, `pointer-coarse:` pour les cibles de 44 px et les champs de 16 px, et ajout à `ecransDeReference` (`apps/web/e2e/formats.ts`). Applications de boutique : décision de Pierre.
- **Livré** : feature `hypotheses-financement` (fiches 01 et 03 du backlog, `.product/architecture/hypotheses-financement.md`). Moteur : `revenusMensuels` facultatif, effort HCSF calculé seulement s'il y a des revenus, feu `couverture` (mensualité ÷ loyer, seuils `verdict.couverture` 70 % / 100 %) à la place du feu `effort`, projet d'exemple sans revenus. Web : onglet **Financement** (`ecrans/Financement.tsx`, `ecrans/financement/`, grille des hypothèses du prêt partagée `ecrans/hypotheses/GrilleHypotheses.tsx`, lignes lisibles en mode document par `hypotheses/lisible.ts`), bouton « Simuler un prêt » → `/simulateur-pret#s=…` (`analyses/simulation-pret.ts` : schéma local du contrat de la fiche 08, base64url partagé `stockage/base64url.ts` ; route « Bientôt » en attendant le simulateur), plus de revenus dans Vérifier ni ailleurs, Hypothèses sans les cartes Le marché et Le financement (`GROUPES` = cartes affichées, `TOUS_LES_GROUPES` pour `descripteurParChemin`), plafond d'encadrement dans La location, volet Financement dans le document imprimé, Comparer et Méthode sur la couverture.
- **Livré** : feature `hypotheses-optionnelles` (fiche de backlog 02, `.product/architecture/hypotheses-optionnelles.md`) : quatre chiffres suffisent pour créer un projet (prix, surface, code postal, ville). Moteur : le champ de loyer de chaque type est optionnel (`loyerHc`, `loyerChambre`, `nuitee` ; `CHAMP_LOYER_PAR_MODE`, `loyerConnu`, `champLoyer`, `LocationComplete`), `tmi` par défaut à 30 % (`TMI_PAR_DEFAUT`) ; `calculerProjet` rend `ResultatsComplets | ResultatsPartiels` (discriminant `complet`) : sans loyer, `cashflow`, `fiscalite`, `revente`, `rendement` et `scenarios` valent `null`, financement, estimation et verdict restent calculés ; `manques` (`LOYER_ABSENT`, avec le chemin du champ) et `FeuVerdict.raison` disent ce qui manque ; sans loyer, les feux rendement, cash-flow et couverture sont inconnus avec cette raison. `ProjetComplet`, `estComplet`, `parserComplet`, `calculerComplet`, `calculerPartiel`. Web : Vérifier n'exige que les quatre chiffres (apport 0 €, durée 25 ans, tranche 30 % pré-remplis badge « estimé ») ; loyer vide = loyer de marché ANIL de la commune à la création (`enrichissement/loyer.ts`), sinon absent ; bandeau `ecrans/projet/AnalyseIncomplete.tsx` (« Il manque le loyer visé pour cette analyse », champ + « Appliquer », « Utiliser le loyer de marché ») en tête du Rapport, de Fiscalité et de Revente, l'onglet Financement garde le crédit ; cartes « À compléter » ; textes `textes/manques.ts` ; tranche supposée dite dans Fiscalité (choix en ligne) et le Rapport. **Règle** : tout écran qui lit `cashflow`, `fiscalite`, `revente`, `rendement` ou `scenarios` teste d'abord `r.complet`.
- **Livré** : feature `rapport-cashflow` (fiche de backlog 10, `.product/architecture/rapport-cashflow.md`) : le Rapport s'explique chiffre par chiffre. Composant `Info` (`apps/web/src/composants/info.tsx` : bouton ⓘ de 44 px, bulle `role="tooltip"` positionnée par `decalageBulle` pour tenir dans l'écran, ouverture au clic et au focus, fermeture Échap / clic dehors / perte du focus, paragraphe en mode document ; pas de `popover` natif, absent de jsdom) et `LienOnglet` (lien relatif vers un volet du projet, nul en mode document) ; `TitreCarte` reçoit `info` à côté du `h2` (jamais dedans : le nom accessible des titres ne change pas) et `action` à droite ; `Pourquoi` supprimé. `analyses/rapport.ts` : `cascadeAutofinancement` (loyer → après le crédit → après les charges = `r.cashflow.mensuel`, avant impôt → après l'impôt, impôt mensuel moyen du régime retenu sur la période) et `multipleSurApport` (gain total ÷ mise de départ, `null` sans mise). `textes/explications.ts` : `EXPLICATIONS` fixes (page Méthode) + fonctions `explication…(r)` qui citent les chiffres du projet. Rapport : `CarteAutofinancement` (pleine largeur, cascade + repères « Part du loyer prise par le crédit » = mensualité ÷ loyer, « Effort d'épargne » ou « Excédent », « Loyer d'équilibre »), puis `CartePrix` | `CarteRendements` (brut · net · net-net), Leviers, Impôts | Revente (« Multiple sur apport »). **Règle** : une icône ⓘ = toujours une bulle ; un lien « Voir … → » = toujours un changement d'onglet ; jamais l'un pour l'autre. Maquettes A/B : `.product/design/rapport-cashflow-maquettes.html`.
- **Livré** : feature `coque-fixe` (fiche de backlog 11, `.product/architecture/coque-fixe.md`) : coque « application », la fenêtre ne défile jamais, seul `main` défile (`AppLayout` en `h-dvh overflow-hidden`, grille `[var(--largeur-menu)_1fr]`, `--largeur-menu: 14rem` dans `index.css` ; `coque/contenu.ts` remet `scrollTop` à 0 à chaque changement de `pathname`). Barre latérale en trois zones (haut : logo, « Nouveau projet » ; milieu `data-zone="defilante"` : liste des projets et Comparer, seule à défiler ; bas : aide, « Installer l'application », profil), liens en 14 px, profil anonyme sur trois lignes. En-tête de projet compact et `sticky` (`ProjetLayout` : rangée nom · prix · mode et actions de 48 px + bande des volets de 44 px ; une rangée de 56 px à partir de `2xl`) ; `coque/entete.ts` publie par `ResizeObserver` `--decalage-entete` (début de la bande : `top` négatif sous `md`, seule la bande reste sur téléphone) et `--hauteur-entete-projet` (partie en vue) sur le cadre `[data-cadre-projet]` ; la synthèse d'Hypothèses se colle à `top-[var(--hauteur-entete-projet,0px)]`. **Règle** : tout élément collant d'un volet se place sous `--hauteur-entete-projet`, jamais sous `--hauteur-barre-app` (la barre d'app est hors du contenu qui défile) ; `print:overflow-visible print:h-auto` sur tout conteneur `overflow`. Preuve : `tests/coque-fixe.test.tsx`, `e2e/coque.spec.ts` (trois appareils), `e2e/formats.ts` mesure le débordement de `main`.
- **Livré** : feature `revente-curseur` (fiche de backlog 06, `.product/architecture/revente-curseur.md`) : l'onglet Revente s'ouvre sur un curseur « Revente dans N ans » de 1 à 30 ans (zéro impossible dans le moteur), repères 5 à 30, seuils 22 ans (plus d'impôt sur le revenu) et 30 ans (plus de prélèvements sociaux) déduits des règles, taux global d'imposition de la plus-value de l'année choisie calculé par `analyses/plus-value.ts` (jamais recopié) ; chiffres en direct pendant le glissement (état local, recalcul sans scénarios), écriture par `appliquerSaisie` au relâchement ou 150 ms après le dernier mouvement ; les quatre cartes 5/10/15/20 restent en bandeau compact (`ecrans/revente/Horizon.tsx`) ; texte seul en mode document. **Composant réutilisable** `composants/Curseur.tsx` (min, max, pas, libellé, formatage, repères, seuils, `aria-valuetext`, clavier, `onChangement` / `onValidation`, styles `.curseur` dans `index.css`) : à reprendre pour tout curseur, notamment la négociation du prix (fiche 04).
- **Livré** : feature `estimation-confiance`, PR 1 (fiche de backlog 09, `.product/architecture/estimation-confiance.md`) : note de confiance de l'estimation sur 100 calculée par le moteur (`packages/moteur/src/estimation/confiance.ts` : `confianceEstimation(dvf, regles)` → note, niveau parmi cinq — très faible, faible, moyenne, bonne, élevée —, précision, quatre composantes chiffrées : localisation 35, dispersion 30, comparables 20, ancienneté 15 ; barèmes en paliers interpolés et marges de la fourchette par niveau dans `regles/2026-09.ts`, « choix Deklic » du 14/09/2026) ; `marche.dvf` porte `precision` (immeuble, rue, quartier, commune), `ancienneteMedianeMois`, `periode`, `lieu` (optionnels : précision déduite du rayon, ancienneté supposée à 12 mois pour les projets anciens) ; data : `dateMediane` dans l'index DVF ; Worker 0.7.0 : `/marche` v2 (date médiane, ancienneté à la date de la réponse), `/marche/adresse` v4 (date médiane, période et ancienneté du repère et des groupes ; `donnees/anciennete.ts`) ; web : carte « Peut-on se fier à cette estimation ? » en tête de l'onglet Estimation (`ecrans/adresse/Confiance.tsx`, `textes/confiance.ts`), carte « Le repère utilisé » sans adresse (`ecrans/adresse/Repere.tsx` : lieu, période, quartiles, provenance, « moins précis »), Rapport « confiance moyenne (62/100) », Méthode, écran de référence « Estimation sans adresse ». **PR 2 à faire** : carte géographique des ventes (Leaflet, tuiles IGN à confirmer par Pierre, contrat `/marche/adresse` v5 avec les coordonnées des ventes, déjà dans les CSV).
- **Livré** : feature `visite-questions` (fiche de backlog 07, `.product/architecture/visite-questions.md`). Moteur : base de 74 questions de visite sourcées (`packages/moteur/src/visite/base/*.ts`, sept catégories : documents, diagnostics et travaux, logement, immeuble, quartier, vendeur, exploitation), conditions pures sur le projet et les feux (`visite/contexte.ts` : copropriété, année de construction avec amiante avant 1997 et plomb avant 1949, DPE, étage et ascenseur, `typeExploitation` prêt pour la fiche 05, risques, travaux, prix), `questionsPourProjet(projet, resultats)`, seuils datés `regles.visite` ; le texte d'une question porte des jetons `{dpe}`, `{ecart}`, `{risques}`… que `textes/visite.ts` formate. `verdict.vigilance` ne garde que les cinq points financiers, affichés dans le Rapport (carte « Avant de faire une offre », `ecrans/rapport/Vigilance.tsx`). Web : `ProjetEnregistre.visite = { faite, date?, reponses }` (Zod, note ≤ 300 caractères, absent = visite non faite), logique pure `apps/web/src/visite/` (répondre, noter, marquer faite, rouvrir, progression, groupes, descripteur d'une question à valeur), écran Visite (`ecrans/Visite.tsx`, `ecrans/visite/` : quatre réponses en boutons radio, note, champ à valeur qui écrit l'hypothèse par `appliquerSaisie` et passe la question à OK, progression, « Marquer la visite comme faite » qui retire l'onglet, compte rendu et « Rouvrir »), case « J'ai déjà visité ce bien » dans Vérifier, volet « Compte rendu de visite » du dossier imprimé (aucun volet Visite pour une visite faite sans réponse), réponses dans le lien de partage (« Ajouter » reprend visite et adresse). **Règle** : une question nouvelle va dans le fichier de sa catégorie avec sa source ; une phrase formatée reste côté web.
- **Livré** : feature `achat-negociation` (fiche de backlog 04, `.product/architecture/achat-negociation.md`) : `achat.negociationTaux` (0 à 0,3, défaut 0) et `packages/moteur/src/achat/` (`prixRetenu` = prix affiché × (1 − taux) arrondi à l'euro, prix affiché tel quel à taux nul ; `resumerAchat`, `tauxPourPrixRetenu`, `NEGOCIATION_MAX`). **Toute lecture du prix dans le moteur passe par `prixRetenu`** (frais d'acquisition, emprunt, effort, entretien, rendements, revente, amortissements, estimation, feu prix, scénarios ; `avecPrix` remet la négociation à zéro, l'écart des prix cibles reste relatif au prix affiché) ; `Resultats.achat` = { prixAffiche, prixRetenu, negociationTaux, negociationMontant }. Web : réutilise le curseur générique `composants/Curseur.tsx` de la fiche 06 (repères 0 à −15 %, pouce en butée au-delà mais valeur affichée exacte), carte `ecrans/hypotheses/CarteAchat.tsx` (champ % et curseur 0 à −15 % par 0,5 %, tous deux par `appliquerSaisie` ; prix retenu ; « Viser le prix estimé » via `analyses/negociation.ts` ; dépliant « + Ajouter des travaux » avec résumé chiffré), `textes/achat.ts` (libellés du prix retenu et de l'en-tête), `Descripteur.aide`, indicateur « Négociation » dans Comparer, « + Ajouter des travaux » dans Vérifier. **Règle** : un écran n'affiche jamais `achat.prix` comme montant à payer ; il lit `r.achat.prixRetenu` ou `prixRetenu(projet.hypotheses.achat)`. La case « rénovation énergétique » (déficit foncier doublé) reste dans le moteur et n'apparaît qu'en location nue avec des travaux (`visibleSi`).
- **Prochaine étape (session principale)** : à choisir avec Pierre (synchronisation des projets des comptes, publication DVF France entière par l'Action « Référentiels », vérification des règles de l'extension sur de vraies annonces).
- `node_modules/` et `dist/` ne sont plus versionnés.

## Stack (décision ADR-001)

| Couche        | Techno                                                                                                                                                          | Pourquoi                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Monorepo      | **npm workspaces**, Node 22, TypeScript 5 **strict** (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)                                       | Natif, zéro outil en plus                                                                    |
| Moteur        | `packages/moteur` — TypeScript **pur**, zéro I/O, dépendance unique : Zod                                                                                       | Tourne dans le navigateur ; testable à 100 %                                                 |
| Front         | `apps/web` — **React 19 + Vite**, React Router, **Tailwind CSS v4 + shadcn/ui**, Recharts, SPA statique sur **Cloudflare Pages**                                | Tout le calcul est côté client ; React est le framework le mieux maîtrisé par les IA de code |
| API           | `apps/worker` — **Cloudflare Workers + Hono** : `/extract` (LLM + cache), `/proxy/*` (APIs publiques + cache), rate-limit par IP                                | 100 000 req/jour gratuits, commercial autorisé                                               |
| Capture       | `apps/extension` — WebExtension MV3 (Chrome/Firefox/Edge, Safari v1.5) + bookmarklet ; règles par portail en JSON versionné sur R2                              | Lecture côté client uniquement (ADR-002)                                                     |
| Données       | **KV** (cache API 24 h / extraction 30 j), **R2** (référentiels pré-agrégés, CSV DVF), **D1** (comptes : utilisateurs, sessions ; projets synchronisés ensuite) | Quotas gratuits largement suffisants                                                         |
| LLM           | **Mistral Small** (sortie JSON par schéma) derrière une interface `Extracteur` ; repli regex ; Claude Haiku 4.5 comme fournisseur alternatif                    | 0 ou 1 appel par annonce, ~0,0004 $ (ADR-003)                                                |
| Auth          | `apps/comptes` : **Better Auth** sur Hono (worker Pages, même origine), D1 ; code e-mail (Resend), Google, Apple (ADR-006)                                      | Pas de mot de passe à protéger                                                               |
| Paiement (v3) | Stripe via webhooks Worker                                                                                                                                      | Rien en v1                                                                                   |
| Référentiels  | GitHub Action mensuelle : loyers ANIL, taux REI, zonage ABC, taux d'usure → JSON sur R2                                                                         | Pas d'API en direct pour ces données                                                         |
| Validation    | **Zod** partout : entrées utilisateur, sorties LLM, réponses d'API, variables d'env                                                                             |                                                                                              |
| Tests         | **Vitest** (unit + intégration), **Playwright** (E2E web), test quotidien d'annonce témoin par portail                                                          |                                                                                              |
| Lint / format | **ESLint** (flat config, `--max-warnings=0`) + **Prettier**                                                                                                     |                                                                                              |
| CI            | GitHub Actions : lint → typecheck → test → build sur chaque PR                                                                                                  |                                                                                              |
| Observabilité | **Sentry** (erreurs, front + worker), Cloudflare Web Analytics (sans cookie). **Aucun tracking tiers**                                                          | Vie privée : engagement de la spec                                                           |
| PDF           | CSS `@media print` + impression navigateur                                                                                                                      | Pas de service de rendu                                                                      |

**Écarté** : Next.js/Vercel (SSR inutile, Vercel Hobby interdit l'usage commercial), Supabase en v1 (pause après 7 jours d'inactivité, aucune BDD nécessaire), scraping serveur Firecrawl/Apify (jurisprudence Jinka 2025-2026), Inngest (aucune tâche longue : tout se calcule dans le navigateur).

## Architecture Overview

```
Extension / bookmarklet ──capture (structuré + texte)──▶ apps/web (React SPA)
                                                          │  moteur (packages/moteur) · stockage local
                                                          ├─▶ apps/worker /extract ──▶ Mistral (JSON strict, cache KV par hash)
                                                          ├─▶ apps/worker /proxy ───▶ Géoplateforme · ADEME · Géorisques · BDNB (cache KV)
                                                          ├─▶ R2 : CSV DVF par commune · référentiels ANIL/REI/ABC/usure
                                                          └─▶ /api/auth, /api/comptes (worker Pages, apps/comptes) ──▶ D1 comptes · Resend · Google · Apple
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
│   ├── comptes/               ← Better Auth sur Hono, servi par le worker Pages (/api/auth, /api/comptes), D1 deklic-comptes
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
- **Prix retenu** : prix affiché × (1 − négociation), arrondi à l'euro (prix affiché tel quel sans négociation) ; les honoraires d'agence restent en euros. Tout le moteur se calcule sur le prix retenu (`prixRetenu(achat)`) ; le prix affiché ne sert qu'à l'écart des prix cibles.
- **Frais d'acquisition** : DMTO (4,5 % ou 5 % selon département, jusqu'au 31/03/2028) + taxe communale 1,2 % + frais d'assiette 2,37 % + émoluments par tranches + CSI 0,10 % + débours ; calculés hors honoraires d'agence.
- **TAEG** : résolu numériquement, frais de dossier et garantie inclus.
- **Taux d'effort HCSF** : mensualité assurance comprise ÷ (revenus + 70 % des loyers) ; seuil 35 %, 25 ans (27 si travaux ≥ 10 %). Deklic ne demande plus les revenus (`revenusMensuels` facultatif) : l'effort n'est calculé que pour les projets enregistrés qui en portent ; la durée maximale reste vérifiée.
- **Couverture** (cinquième feu) : mensualité assurance comprise ÷ loyer hors charges du régime retenu ; bon ≤ 70 % (la part des loyers que le HCSF retient comme revenu), à surveiller ≤ 100 %, problème au-delà, inconnu sans loyer.
- **IRA** : min(6 mois d'intérêts, 3 % du CRD).
- **Régimes** : meublé micro-BIC (50 %, PS 18,6 % _à confirmer_), meublé réel LMNP (amortissements par composants, art. 39 C), nu micro-foncier (30 %, PS 17,2 %), nu réel (déficit foncier 10 700 €). Pas de SCI IS en v1.
- **Plus-value** : abattements IR 6 %/an dès la 6ᵉ année, PS 1,65 %… ; réintégration des amortissements de l'immeuble en LMNP réel depuis le 15/02/2025 (mobilier exclu) ; surtaxe > 50 000 €.
- **TRI** : sur flux annuels (apport + mobilier en année 0, cash-flows après impôt, cash net de revente en N), résolu numériquement.
- **Verdict** : cinq feux — prix vs DVF, rendement net, cash-flow, couverture (crédit ÷ loyer), risques.
- **DVF** : ventes réelles ; rayon 300 m (adresse) / 800 m (quartier) / commune selon précision du géocodage.

## Variables d'environnement

Validées par Zod (`apps/worker/src/dependances.ts`), documentées dans `apps/worker/.dev.vars.example`. Aucune n'est nécessaire pour `packages/moteur` ni `apps/web`. Déjà en place : `ENVIRONNEMENT` (`dev` / `preview` / `production`), `ORIGINES_AUTORISEES` (origines CORS supplémentaires, séparées par des virgules), `LLM_URL` et `LLM_MODELE` (fournisseur « chat completions » et modèle de lecture des annonces, dans `wrangler.toml`) et le secret `OPENROUTER_API_KEY` (posé par Pierre dans le dashboard Cloudflare ; jamais dans le dépôt ni dans une conversation). Comptes (`apps/comptes/src/dependances.ts`, `apps/comptes/.dev.vars.example`, posées dans le projet Pages) : `ENVIRONNEMENT` (production par défaut), `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `COURRIEL_EXPEDITEUR`, `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, `APPLE_CLIENT_ID` / `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY`, `ORIGINES_AUTORISEES` ; variable de build `DEKLIC_COMPTES=1`.

| Variable                                                                        | Usage                                                                                   |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `OPENROUTER_API_KEY` (secret)                                                   | Clé du fournisseur de lecture des annonces (Worker uniquement)                          |
| `LLM_URL`, `LLM_MODELE`                                                         | Fournisseur « chat completions » et modèle ; Mistral direct = autre URL et autre modèle |
| `SENTRY_DSN`                                                                    | Erreurs front + worker                                                                  |
| `RESEND_API_KEY` (secret), `COURRIEL_EXPEDITEUR`                                | Envoi des codes de connexion (apps/comptes)                                             |
| `BETTER_AUTH_SECRET` (secret)                                                   | Signature des cookies et jetons des comptes (32 caractères ou plus)                     |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APPLE_*`                           | Boutons « Continuer avec Google / Apple » (absents : boutons masqués)                   |
| `DEKLIC_COMPTES` (variable de build Pages)                                      | `1` : le build de apps/web dépose le worker des comptes (`dist/_worker.js`)             |
| Bindings : `KV_CACHE`, `R2_DATA` (worker) ; `DB` (D1 des comptes, projet Pages) | Déclarés dans `wrangler.toml` ou dans le projet Pages, pas dans l'env                   |

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
npm run dev -w apps/comptes  # API des comptes sur 8787 (D1 locale) ; le web relaie /api
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
