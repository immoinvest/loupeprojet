# Architecture : Tests de bout en bout (`apps/web/e2e`, Playwright)

```
apps/web/
├── playwright.config.ts       Chromium seul ; webServer = `npm run build && npm run preview` sur 127.0.0.1:5199 ;
│                              baseURL, locale fr-FR ; trace et capture conservées à l'échec ; rapport HTML jamais ouvert
├── e2e/
│   ├── aides.ts               ouvrirMesProjets, ouvrirExemple, ouvrirVolet, carte, creerProjetManuel ; NOM_EXEMPLE, NOM_LYON
│   ├── mes-projets.spec.ts    premier lancement ; nouveau projet à la main → rapport → liste → suppression ; persistance après rechargement
│   ├── rapport.spec.ts        verdict, cinq feux, cartes (prix, cash-flow, leviers, fiscalité, revente)
│   ├── hypotheses.spec.ts     loyer 1 300 € → « +91 €/mois » ; « abc » refusé ; rechargement ; rapport recalculé
│   └── onglets.spec.ts        Fiscalité (« Retenir ce régime »), Revente (« Dans 20 ans »), Visite (cases et compteur)
├── playwright-report/         rapport HTML (ignoré par git, ESLint et Prettier)
└── test-results/              traces et captures des échecs (idem)
package.json (racine)          `npm run test:e2e` → `npm run test:e2e -w apps/web` → `playwright test`
.github/workflows/ci.yml       job `e2e` (Node 22, cache des navigateurs, `playwright install --with-deps chromium`, artefact du rapport à l'échec)
```

## Principes

- **Ce que l'utilisateur voit** : sélecteurs par rôle, libellé ou texte (`getByRole`, `getByLabel`, `getByText`), jamais de classe CSS. Le seul sélecteur structurel est `section` (la `Carte`), filtré par son titre de niveau 2 (`carte(page, titre)`).
- **Isolation** : un contexte de navigateur neuf par test, donc un `localStorage` vide et le projet d'exemple recréé à chaque test. Aucun test ne dépend d'un autre ; `fullyParallel`.
- **Aucune attente fixe** : que des assertions auto-répétées (`expect(locator).toBeVisible()`, `toHaveText`, `toHaveValue`, `toHaveAttribute`) qui attendent l'état voulu.
- **Persistance vérifiée par le navigateur** : `page.reload()` puis relecture de l'écran (valeur du champ, statut, liste), pas de lecture directe du stockage.
- **Chiffres pinnés** : les valeurs attendues (−210 €/mois, 58 217 €, +91 €/mois, 26 928 €, 147 662 €…) sont celles du moteur pour le projet d'exemple ; elles changent si les règles ou l'exemple changent, et c'est voulu.
- **Espaces** : les montants contiennent des espaces insécables (`Intl.NumberFormat fr-FR`). Playwright normalise les blancs pour les chaînes ; les expressions régulières utilisent `\s`.

## Décisions

- **ADR-E1 — build de production plutôt que `vite dev`** : `webServer` construit `dist/` puis le sert avec `vite preview` (repli SPA inclus). On teste l'artefact déployé sur Cloudflare Pages ; coût : ~15 s de build par lancement.
- **ADR-E2 — port dédié 5199 sur 127.0.0.1** : évite 5173 (dev, aperçu Claude Code) et 4173 (preview manuel) ; hôte explicite pour que serveur, sonde de disponibilité et navigateur parlent de la même adresse sous Windows (`localhost` peut résoudre en IPv6) et Linux.
- **ADR-E3 — tests typés et lintés comme le code** : `apps/web/tsconfig.json` inclut `e2e/` et `playwright.config.ts` ; les règles ESLint typées (`no-floating-promises`…) s'appliquent, ce qui attrape les `await` oubliés. `playwright-report/` et `test-results/` sont ignorés par ESLint.
- **ADR-E4 — Chromium seul, job CI séparé** : moins de deux minutes, indépendant de `verify` ; Firefox/WebKit plus tard si un bug propre à un navigateur apparaît ; le job n'est pas obligatoire dans la protection de branche tant que Pierre n'a pas tranché.

## Lancer à la main

```bash
npx playwright install chromium        # une fois, télécharge le navigateur (~150 Mo)
npm run test:e2e                       # build + preview + 9 parcours (~1 min)
npx playwright show-report apps/web/playwright-report   # lire le rapport HTML
npx playwright test --ui               # depuis apps/web : mode interactif
```
