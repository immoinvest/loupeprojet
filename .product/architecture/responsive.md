# Architecture : Responsive et application mobile

Discovery : `../features/responsive-discovery.md`. Specs : `../specs/responsive-specs.md`. Décision de fond : `../adr/006-application-mobile.md`. État de la session : `../pipeline/responsive.json`.

## 1. Existant réutilisé

| Existant                                                                 | Réutilisation                                                                                          |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Coque `AppLayout` + `Sidebar` + `ProjetLayout`                           | La barre latérale devient le tiroir (même DOM) ; l'en-tête de projet se réorganise par classes          |
| Contexte + hook (`useProjets`, `ClientWorkerProvider` avec défaut hors ligne) | Même modèle pour l'installation : `InstallationProvider` avec un suivi « indisponible » par défaut en test |
| Modules de logique purs couverts à 100 % (`annonces/`, `enrichissement/`…) | Nouveaux : `application/`, `hors-ligne/`, `annonces/partage-recu.ts`                                   |
| Build d'un fichier à part par une config Vite dédiée (`vite.bookmarklet.config.ts` → `public/capture.js`) | `vite.hors-ligne.config.ts` → `dist/sw.js`, après le build de l'application                          |
| Lecture unique d'un fragment puis nettoyage de l'adresse (`lireFragmentCapture` dans `NouveauProjet`) | Même geste pour les paramètres de partage (`lirePartageRecu`)                                        |
| `ModeDocument` et `@media print`                                         | Conservés ; toute classe `md:`, `lg:`, `xl:` d'un volet imprimable reçoit son équivalent `print:`       |
| Aides Playwright (`e2e/aides.ts`), tests de rendu via `AppEnMemoire`     | Aides rendues indépendantes du format (ouverture du menu), mêmes parcours sur trois appareils           |

Aucun conflit : aucune PR ouverte ; `NouveauProjet` et `Extension` (livrés par d'autres sessions) sont touchés aux seuls points nécessaires.

## 2. Fichiers

### À créer

```
apps/web/src/
├── composants/mise-en-page.tsx       Page (marges et espacements responsives, équivalents print), TitrePage (h1 à l'échelle), Chapo
├── coque/
│   ├── BarreApp.tsx                  barre d'app sous 1 024 px : bouton « Ouvrir le menu » (aria-expanded, aria-controls), logo
│   ├── menu.ts                       useMenu() : ouvert, ouvrir, fermer, boutonRef ; Échap, page figée, fermeture à la navigation et au passage en grand écran
│   ├── BoutonPartager.tsx            extrait de ProjetLayout : partage natif sur écran tactile, copie sinon, avertissement écrit
│   └── Installation.tsx              InstallationProvider + useInstallation() (useSyncExternalStore sur le suivi)
├── application/
│   ├── installation.ts               creerSuiviInstallation(fenetre) : beforeinstallprompt, appinstalled, display-mode standalone ; suiviIndisponible
│   ├── partage-natif.ts              capacitesDuNavigateur, modePartage, donneesPartage, estAnnulation
│   └── index.ts
├── annonces/partage-recu.ts          lirePartageRecu(search) : lien d'annonce cherché dans lien, texte, titre ; texte tronqué à 10 000 caractères
├── hors-ligne/
│   ├── strategie.ts                  strategiePour, fichiersDeLaCoque, nomDuCache, cachesPerimes, FICHIERS_FIXES
│   ├── enregistrer.ts                enregistrerServiceWorker(environnement) : production seulement, après le chargement
│   └── index.ts
├── sw/service-worker.ts              colle du service worker (install, activate, fetch) autour de hors-ligne/strategie ; hors couverture unitaire, prouvé par Playwright
├── textes/application.ts             menu, installation, partage, carte « Sur téléphone et tablette »
└── ecrans/extension/CarteTelephone.tsx  carte « Sur téléphone et tablette » de la page Extension
apps/web/vite.hors-ligne.config.ts    build IIFE de src/sw/service-worker.ts vers dist/sw.js ; version = empreinte SHA-256 de dist/index.html
apps/web/public/icon-maskable-192.png, icon-maskable-512.png
marque/logo/deklic-icone-maskable.svg  source de l'icône adaptative (fond plein, maison et éclats dans la zone sûre de 80 %)
marque/favicon/icon-maskable-192.png, icon-maskable-512.png
apps/web/e2e/
├── formats.ts                        FORMATS (9), écrans de référence, mesurer(page) avec la règle de cible effective
├── responsive.spec.ts                13 écrans × 9 formats : débordement, cibles, champs, menu
├── hors-ligne.spec.ts                ouverture sans réseau après une visite
└── telephone.spec.ts                 partage reçu, partage d'un projet (repli copie), menu au doigt
apps/web/tests/
├── menu.test.tsx                     tiroir : ouvrir, Échap, voile, navigation, focus, inert
├── application.test.ts               suivi d'installation, décision de partage
├── partage-recu.test.ts              lecture des paramètres de partage
├── hors-ligne.test.ts                stratégie de cache, fichiers de la coque, caches périmés, enregistrement
└── telephone.test.tsx                partage natif (navigator.share simulé), partage reçu dans Nouveau projet, carte Extension
.product/adr/006-application-mobile.md
```

### À modifier

```
apps/web/src/coque/AppLayout.tsx      grille lg seulement ; BarreApp + voile + main inert quand le tiroir est ouvert
apps/web/src/coque/Sidebar.tsx        tiroir fixe sous lg (translate, invisible fermé), bouton « Fermer le menu », marges de sécurité, « Installer l'application »
apps/web/src/coque/ProjetLayout.tsx   en-tête : rangée nom + actions qui passe à la ligne, onglets en bande défilante (onglet actif ramené en vue), une rangée à xl
apps/web/src/composants/ui.tsx        TitreCarte qui passe à la ligne, GrosChiffre à l'échelle, Ligne dont la valeur ne se coupe pas, « Pourquoi ? » à 44 px au doigt
apps/web/src/ecrans/*.tsx             MesProjets, NouveauProjet, FormulaireProjet, formulaire/Champ, Rapport, Hypotheses, hypotheses/ChampHypothese, Fiscalite, Revente, Visite, Comparer, Methode, Extension, Partage, Imprimer, document/DocumentProjet, Bientot
apps/web/src/index.css                utilitaire defilement-discret, marges de sécurité latérales, min-h-dvh
apps/web/index.html                   viewport-fit=cover, apple-mobile-web-app-title
apps/web/public/manifest.webmanifest  id, scope, start_url, icônes maskable, raccourcis, share_target, catégories
apps/web/src/App.tsx                  InstallationProvider (suivi réel dans App, indisponible dans AppEnMemoire)
apps/web/src/main.tsx                 enregistrerServiceWorker
apps/web/src/annonces/index.ts        export de lirePartageRecu
apps/web/package.json                 build : + build:hors-ligne ; test:e2e : npm run build puis playwright test
apps/web/tsconfig.json                include vite.hors-ligne.config.ts
apps/web/vitest.config.ts, vitest.config.ts   couverture 100 % sur application/ et hors-ligne/ ; sw/ exclu
apps/web/playwright.config.ts         projets ordinateur, telephone (Pixel 7), tablette (768 × 1 024 tactile), formats
apps/web/e2e/aides.ts, mes-projets.spec.ts   ouverture du menu quand la barre latérale est cachée
.github/workflows/ci.yml              durée du job e2e si nécessaire
docs : README, CLAUDE.md, registre, technical-spec, architecture-overview, functional-spec, marque/README
```

Taille : aucun fichier prévu au-delà de 300 lignes ; `ProjetLayout` perd le partage (extrait) avant de gagner l'en-tête responsive.

## 3. Patterns

- **Mobile-first par classes** (Tailwind v4 : `sm` 640, `md` 768, `lg` 1 024, `xl` 1 280) : la base vaut pour le téléphone, les préfixes élargissent. Aucune largeur lue en JavaScript pour la mise en page ; le seul `matchMedia` ferme le tiroir quand l'écran devient large (état, pas mise en page).
- **Composants de mise en page** (`Page`, `TitrePage`, `Chapo`) : les marges et échelles de titres vivent à un seul endroit, avec leurs équivalents `print:`. Classes complètes dans des tables de correspondance (Tailwind ne détecte que des chaînes entières).
- **Tactile par le pointeur** : `pointer-coarse:` pour les cibles de 44 px et les champs en 16 px (vérifié : l'émulation tactile de Playwright active `(pointer: coarse)`) ; l'ordinateur à la souris garde ses tailles.
- **Contexte + hook + défaut sûr** pour l'installation (comme `ClientWorker`) : `App` branche le vrai suivi, `AppEnMemoire` un suivi indisponible.
- **Store externe** (`useSyncExternalStore`) pour l'état d'installation, alimenté par des événements du navigateur.
- **Strategy** pour le cache : `strategiePour(requete) → 'navigation' | 'cache-d-abord' | 'reseau-d-abord' | 'ignorer'`, un gestionnaire par stratégie dans le service worker.
- **Fonctions pures aux frontières** (`lirePartageRecu`, `modePartage`, `fichiersDeLaCoque`, `cachesPerimes`) : toute décision testable sans navigateur ; les fichiers de colle (service worker, effets React) restent courts.
- **Injection des capacités du navigateur** (`fenetre`, `conteneur`, `navigator`) plutôt que des accès globaux, pour tester sans jsdom spécial.

## 4. Flux

### Navigation sous 1 024 px

```
BarreApp « Ouvrir le menu » → useMenu.ouvrir
  → Sidebar data-ouvert, translate-x-0, visible ; voile ; main et BarreApp inert ; html overflow hidden ; focus sur « Fermer le menu »
  → Échap | voile | « Fermer le menu » → fermer + focus rendu au bouton de menu
  → clic sur un lien → nouvelle location.key → fermer (sans voler le focus)
  → écran ≥ 64rem (matchMedia) → fermer
```

### Installation

```
App (module) → creerSuiviInstallation(window) : écoute beforeinstallprompt (preventDefault, événement gardé), appinstalled ; standalone au départ ?
  → InstallationProvider → useInstallation() { etat, installer }
  → Sidebar (profil) : etat « disponible » → bouton « Installer l'application » → installer() → prompt() → userChoice
  → CarteTelephone : bouton, ou marche à suivre Android / iPhone, ou « déjà installée »
```

### Hors ligne

```
main.tsx → enregistrerServiceWorker({ production, conteneur, quandCharge }) → register('/sw.js') au load
sw.js install  → cache deklic-<empreinte> ← '/', fichiersDeLaCoque(html de '/'), FICHIERS_FIXES ; skipWaiting
sw.js activate → supprime cachesPerimes(noms) ; clients.claim
sw.js fetch    → strategiePour(requete, origine)
                  navigation     : réseau (et mise à jour de '/' en cache) → sinon '/' en cache
                  cache-d-abord  : cache → sinon réseau (et mise en cache)
                  reseau-d-abord : réseau (et mise en cache) → sinon cache
                  ignorer        : pas de respondWith
```

### Partage reçu

```
Android « Partager → Deklic » → GET /projets/nouveau?titre=…&texte=…&lien=… (share_target)
  → NouveauProjet : lireFragmentCapture(hash) prioritaire ; sinon lirePartageRecu(search)
  → url : premier lien reconnu par resoudreAnnonce (lien, texte, titre), sinon premier lien ; texte partagé sans lien → zone de texte
  → pastille « reçue par partage » ; adresse nettoyée (replace) ; rien n'est stocké
```

### Partage d'un projet

```
BoutonPartager → capacitesDuNavigateur(window) → modePartage
  natif → navigator.share(donneesPartage(nom, lien)) → « Lien partagé » + avertissement
        ↳ AbortError → rien ; autre erreur → copie
  copie → clipboard.writeText → « Lien copié » + avertissement ; refus → champ à copier à la main
```

## 5. Décisions locales

- **ADR-R1 : la barre latérale est le tiroir.** Un seul `aside` dans le DOM, positionné en panneau fixe sous `lg` et en colonne au-delà. Écarté : une navigation mobile séparée (liens en double pour les lecteurs d'écran et les tests existants, deux listes à tenir à jour).
- **ADR-R2 : mise en page par CSS, avec équivalents `print:`.** Le papier A4 mesure environ 700 px de large : sans équivalent, `md:grid-cols-2` imprimerait une colonne. Les volets imprimables (Rapport, Fiscalité, Revente, Visite, document) portent `print:` sur chaque changement à `md`, `lg` ou `xl`. Contrôle : export PDF avant et après, comparé à l'œil ; tests d'impression.
- **ADR-R3 : tailles tactiles par `pointer-coarse:`.** Cibles de 44 px et champs en 16 px sur écran tactile, y compris la tablette en paysage ; l'ordinateur garde ses tailles actuelles. Écarté : `max-lg:` (tablette paysage oubliée, ordinateur étroit modifié pour rien).
- **ADR-R4 : service worker écrit à la main, construit après l'application.** Build IIFE sans import (script classique, compatible partout) ; version = empreinte de `dist/index.html`, donc changée seulement quand les fichiers de l'application changent. Écarté : `vite-plugin-pwa` (dépendance lourde), version horodatée (réinstallation à chaque déploiement même sans changement).
- **ADR-R5 : partage reçu en GET vers Nouveau projet.** Aucune donnée n'atteint un serveur ; la route existe déjà et nettoie l'adresse après lecture. Écarté : POST (demande un service worker qui intercepte le formulaire, pour des fichiers dont on n'a pas l'usage).
- **ADR-R6 : partage natif sur écran tactile seulement.** Sur ordinateur, la feuille de partage de Windows est moins utile qu'un lien copié, et les tests existants restent valables. L'avertissement devient un texte visible après le partage ou la copie.
- **ADR-R7 : preuve en deux étages.** Les 8 parcours tournent sur trois appareils ; une spec « formats » mesure les 13 écrans sur 9 formats dans une seule exécution par format. Écarté : les parcours sur 9 formats (72 tests, trop long pour le job CI).
- **ADR-R8 : l'état d'installation n'est jamais stocké.** Il est relu à chaque ouverture depuis le navigateur (événements, `display-mode`).

## 6. Cas limites

| Module                   | Cas                                                                                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useMenu`                | ouverture puis passage en grand écran ; lien vers la page déjà affichée (même chemin, nouvelle `key`) ; démontage tiroir ouvert (page débloquée) ; `matchMedia` absent (jsdom) |
| `lirePartageRecu`        | aucun paramètre ; paramètres vides ; lien seul, texte seul, titre seul ; lien suivi de ponctuation ; plusieurs liens dont un seul d'annonce ; URL invalide ; 20 000 caractères ; `%` mal encodé |
| `creerSuiviInstallation` | fenêtre absente ; `matchMedia` absent ; déjà standalone ; `navigator.standalone` (iPhone) ; invite refusée ; invite déjà consommée ; `appinstalled` sans invite |
| `modePartage`, `estAnnulation` | tactile sans `navigator.share` ; souris avec `navigator.share` ; erreur non `DOMException` ; `AbortError` sous forme d'objet nommé                    |
| `strategiePour`          | autre origine ; POST ; `/capture.js` ; `/sw.js` ; navigation vers une route profonde ; `/assets/…` ; icône ; chemin inconnu ; URL relative invalide        |
| `fichiersDeLaCoque`      | HTML sans assets ; doublons ; attributs `src` et `href` ; chemins absolus hors `/assets/` ignorés                                                     |
| `cachesPerimes`          | aucun cache ; caches d'autres applications (préfixe différent) conservés ; cache courant conservé                                                    |
| `enregistrerServiceWorker` | développement ; conteneur absent ; enregistrement rejeté (l'application continue)                                                                  |
| Mise en page             | nom de projet très long ; 5 projets dans Comparer à 320 px ; montants à 7 chiffres ; volet Visite ouvert directement (onglet hors de la bande) ; mode document sur téléphone |

## 7. Retirer le service worker en urgence

Remplacer le contenu de `src/sw/service-worker.ts` par un gestionnaire `activate` qui supprime les caches `deklic-*`, se désenregistre (`registration.unregister()`) et recharge les onglets ouverts (`clients.matchAll()` puis `navigate`) ; déployer. Les navigateurs vérifient `sw.js` à chaque visite (Cloudflare Pages sert `max-age=0`).

## 8. Ordre d'implémentation (un commit par étape)

1. Docs : discovery, specs, architecture, ADR-006
2. US-1 : `mise-en-page.tsx`, `menu.ts`, `BarreApp`, `AppLayout`, `Sidebar`, `menu.test.tsx`
3. US-2 : `ProjetLayout` (en-tête), `BoutonPartager` extrait sans changement de comportement
4. US-3a : MesProjets, NouveauProjet, FormulaireProjet, Champ, Rapport, Partage, `ui.tsx`
5. US-3b : Hypotheses, ChampHypothese, Fiscalite, Revente, Visite, Comparer, Methode, Extension, Imprimer, DocumentProjet, Bientot
6. US-4 : `pointer-coarse:` (cibles, champs), `index.html` viewport, `index.css`
7. US-10 : `playwright.config.ts` (projets), `formats.ts`, `responsive.spec.ts`, aides et parcours adaptés
8. US-5 : icônes adaptatives, manifeste, `application/installation.ts`, `Installation.tsx`, bouton du profil
9. US-6 : `hors-ligne/`, `sw/service-worker.ts`, `vite.hors-ligne.config.ts`, scripts, `hors-ligne.spec.ts`
10. US-7 : `partage-recu.ts`, `NouveauProjet`, `share_target`, tests
11. US-8 : `partage-natif.ts`, `BoutonPartager`, tests
12. US-9 : `CarteTelephone`, textes, tests
13. Refactor, QA, audit de sécurité, docs, PR

## 9. Checklist pré-implémentation

- [x] Pas de conflit avec l'existant (aucune PR ouverte, DOM de navigation inchangé)
- [x] Patterns cohérents avec le code (contexte + défaut sûr, modules purs, config Vite dédiée)
- [x] Aucune migration, aucune donnée stockée
- [x] Entrées externes validées : paramètres de partage bornés et relus par `resoudreAnnonce` ; événements du navigateur typés par interfaces locales
- [x] Chaque module ≤ 7 fonctions publiques ; aucun nom en « et »
- [x] Aucun fichier prévu > 300 lignes
- [x] Cas limites listés par module

## 10. Auto-revue critique

- **Point faible : équivalents `print:` oubliés.** Un volet imprimable qui gagne `md:grid-cols-2` sans `print:grid-cols-2` imprime une colonne. Parade : règle écrite ici, export PDF comparé avant/après, et grilles regroupées dans les composants de mise en page quand c'est possible.
- **Point faible : `inert` sur `main` avec un tiroir resté ouvert en passant en grand écran.** Parade : fermeture par `matchMedia` et test dédié.
- **Point faible : service worker et tests Playwright.** Chaque test a un contexte neuf, donc un service worker neuf ; le test hors ligne attend `navigator.serviceWorker.ready` avant de couper le réseau.
- **Changement suite à la revue** : `BoutonPartager` est extrait dès US-2 (sans changement de comportement) pour que US-8 ne touche qu'un petit fichier, et `ProjetLayout` reste sous 300 lignes.
