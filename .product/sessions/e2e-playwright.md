# Fiche de session — `e2e-playwright` : parcours complets en vrai navigateur

Tronc commun : `.product/sessions/_commun.md` (contexte, autorisations, règles de travail en parallèle, gates).

## Objectif

Vérifier dans un vrai navigateur (Chromium) les parcours de bout en bout de l'application web, en local et en CI, sans modifier l'application. Les tests unitaires et de rendu existent déjà (Vitest + Testing Library, `apps/web/tests/`) ; ici, on teste ce que l'utilisateur voit réellement.

## Périmètre

1. **Installation** : `@playwright/test` dans `apps/web` (dev), `apps/web/playwright.config.ts` (projet Chromium ; `webServer` = `npm run build -w apps/web` puis `npm run preview -w apps/web`, ou `vite dev` ; `baseURL` locale ; traces et captures à l'échec), script racine `npm run test:e2e` (`package.json` racine, section scripts — seule modification autorisée hors `apps/web`), `apps/web/e2e/` pour les tests. `playwright-report/` et `test-results/` sont déjà ignorés par git.
2. **Parcours** (`apps/web/e2e/*.spec.ts`), avec des sélecteurs accessibles (rôles, libellés) et jamais de classes CSS :
   - premier lancement : la liste « Mes projets » contient le projet d'exemple « T3 · 65 m² · Marseille 5e » ;
   - rapport : titre « Le prix est bon. Le loyer ne couvre pas tout. », cinq feux, chiffres clés (cash-flow −210 €/mois, revente 58 217 €) ;
   - hypothèses : changer le loyer recalcule le cash-flow ; une valeur invalide affiche le message et n'est pas enregistrée ;
   - fiscalité : « Retenir ce régime » (micro-BIC) change le régime retenu et le rapport ;
   - revente : cliquer « Dans 20 ans » change l'horizon ;
   - visite : cocher un point met le compteur à jour ;
   - nouveau projet : saisie manuelle → rapport → présent dans Mes projets → suppression ;
   - persistance : recharger la page conserve les projets (localStorage) ;
   - impression : `window.print` n'est pas testé (pas de dialogue en headless).
3. **CI** : nouveau job `e2e` dans `.github/workflows/ci.yml` (à côté de `verify`, sans le modifier), avec `npx playwright install --with-deps chromium`, artefact du rapport à l'échec. Ne rends pas ce job obligatoire dans la protection de branche : signale-le à Pierre dans le rapport final, il décidera.
4. Documentation : section « Tests de bout en bout » dans `README.md` (fin de feature, après merge de `origin/master`).

## Hors périmètre (ne pas toucher)

Le code applicatif (`apps/web/src/**`), le moteur, le worker. Si un test révèle un vrai bug, ne le corrige pas : décris-le précisément dans la PR (étapes, attendu, obtenu) et écris le test en `test.fixme` avec la référence.

## Points d'attention

- Les tests doivent passer en local sur Windows (Pierre) et sous Linux (CI) : chemins, ports (`5173` peut être occupé par le serveur de prévisualisation : utiliser un port dédié dans la config), encodage.
- Chaque test repart d'un stockage vide (`page.addInitScript` ou contexte neuf) ; pas de dépendance entre tests ; pas de `waitForTimeout`.
- Temps total visé : moins de deux minutes en CI.
