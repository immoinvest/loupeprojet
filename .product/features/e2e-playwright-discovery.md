# Feature Discovery + Specs : Tests de bout en bout (Playwright)

## Demande

Fiche `e2e-playwright` (Pierre, 13/09/2026) : vérifier dans un vrai navigateur (Chromium) les parcours complets de l'application web, en local et en CI, **sans modifier l'application**. Les tests unitaires et de rendu (Vitest + Testing Library, `apps/web/tests/`) existent déjà ; ici on teste ce que l'utilisateur voit réellement : la page servie par le build de production, les routes rechargées, le `localStorage` du navigateur.

## Analyse

- **Ce qui existe** : 277 tests Vitest, dont des tests de rendu sur l'arbre de routes réel (`AppEnMemoire`, jsdom). Ils ne couvrent ni le build Vite, ni le rechargement d'une route profonde, ni le vrai `localStorage`, ni les polices et le CSS (Tailwind compilé).
- **Ce qu'on ajoute** : `@playwright/test` dans `apps/web` (dépendance de développement), une configuration `apps/web/playwright.config.ts` (projet Chromium seul, `webServer` = build puis `vite preview` sur un port dédié, traces et captures conservées à l'échec), des parcours dans `apps/web/e2e/*.spec.ts`, un script racine `npm run test:e2e`, un job CI `e2e` séparé du job `verify`.
- **Sélecteurs** : rôles et libellés accessibles uniquement (`getByRole`, `getByLabel`, `getByText`), jamais de classe CSS. Les libellés sont ceux des écrans livrés (« Mes projets », « Le prix est bon. Le loyer ne couvre pas tout. », « Retenir ce régime », « Dans 20 ans », « Supprimer 40 m² · Lyon »…).
- **Isolation** : Playwright ouvre un contexte de navigateur neuf par test (stockage vide) ; aucun test ne dépend d'un autre ; aucune attente fixe (`waitForTimeout` interdit), uniquement des attentes sur l'état de la page.
- **Build de production plutôt que `vite dev`** : c'est l'artefact déployé sur Cloudflare Pages qu'on veut vérifier ; `vite preview` sert `dist/` avec le repli SPA (`appType: 'spa'`), donc recharger `/projets/<id>/fiscalite` fonctionne comme en production.
- **Port dédié** (`5199`, hôte `127.0.0.1`) : `5173` peut être occupé par le serveur de développement ou l'aperçu de Claude Code, `4173` par un `vite preview` lancé à la main.
- **Portabilité** : mêmes commandes sous Windows (Pierre) et Linux (CI) ; la commande `webServer` n'utilise que `npm run …` et `&&`, compris par `cmd.exe` et `sh`.
- **Pourquoi** : Pierre ne relit pas le code ; les tests sont le seul filet. Un test en vrai navigateur attrape ce que jsdom laisse passer (build cassé, route qui ne recharge pas, CSS qui masque un bouton, stockage qui ne persiste pas).

## Stories

| Story | Titre                         | Gherkin (résumé)                                                                                                                                                                                                                                                                                                                         |
| ----- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-1  | Socle Playwright              | `@playwright/test` installé dans `apps/web` ; `playwright.config.ts` (Chromium, `webServer` build + preview, `baseURL`, traces/captures à l'échec, rapport HTML jamais ouvert automatiquement) ; `npm run test:e2e` à la racine ; premier parcours : ouvrir `/` redirige vers « Mes projets » qui contient « T3 · 65 m² · Marseille 5e » |
| US-2  | Rapport et Hypothèses         | Rapport : titre « Le prix est bon. Le loyer ne couvre pas tout. », cinq feux, « Cash-flow −210 €/mois », « 58 217 € » ; Hypothèses : loyer 1 300 € → cash-flow positif dans la synthèse et enregistré ; « abc » → « Nombre attendu. », valeur précédente conservée                                                                       |
| US-3  | Fiscalité, Revente, Visite    | « Retenir ce régime » sur Meublé micro-BIC → badge « retenu », « Premier impôt l'année 1 », le Rapport dit « Meublé micro-BIC : imposé à partir de l'année 1. » ; « Dans 20 ans » → `aria-pressed`, « Revente dans 20 ans » ; cocher un point → compteur « 1 sur N vérifiés »                                                            |
| US-4  | Nouveau projet et persistance | Saisie manuelle (Lyon, 120 000 €, 40 m²…) → rapport « Prix sans repère de marché » → « Mes projets » liste « 40 m² · Lyon » → suppression → 1 projet ; recharger la page (liste et route profonde) conserve les projets et une hypothèse modifiée                                                                                        |
| US-5  | CI                            | Job `e2e` dans `.github/workflows/ci.yml`, à côté de `verify` (inchangé) : Node 22, `npm ci`, cache des navigateurs, `npx playwright install --with-deps chromium`, `npm run test:e2e`, artefact `playwright-report` à l'échec ; non obligatoire dans la protection de branche (décision de Pierre)                                      |

## Périmètre

- **IN** : ce qui précède ; `apps/web/tsconfig.json` inclut `e2e/` et `playwright.config.ts` pour que `npm run typecheck` et ESLint (règles typées) couvrent aussi les tests ; ESLint ignore `playwright-report/` et `test-results/` (sinon un rapport généré en local casserait `npm run lint`).
- **OUT** : le code applicatif (`apps/web/src/**`), le moteur, le worker ; l'impression (`window.print` n'ouvre pas de dialogue en headless) ; Firefox et WebKit (Chromium suffit pour la v1, le coût CI reste sous deux minutes) ; les tests visuels par capture de référence.
- **Si un test révèle un bug** : pas de correctif ici ; le test est écrit en `test.fixme` avec la description (étapes, attendu, obtenu) dans la PR.

## Auto-validation critique

- Le job `e2e` rebuild l'application (le job `verify` le fait déjà) : ~15 s de plus, acceptable pour garder les deux jobs indépendants et lisibles. Le temps total visé reste sous deux minutes.
- Les tests lisent le `localStorage` par `page.evaluate` pour vérifier ce qui est enregistré : c'est le contrat de persistance de l'app (clé `loupe.projets.v1`), pas un détail d'implémentation.
- Un seul navigateur : les régressions propres à Firefox ou Safari ne seraient pas vues. À élargir quand l'extension (Safari v1.5) arrivera.
- Le rapport HTML n'est jamais ouvert automatiquement (`open: 'never'`) : sinon la commande reste bloquée sur un serveur local, ce qui casse les exécutions non interactives.
