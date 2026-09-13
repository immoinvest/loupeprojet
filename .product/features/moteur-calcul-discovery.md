# Feature Discovery : Moteur de calcul Loupe (`packages/moteur`)

## Demande d'origine

« Porter le moteur en TypeScript pur avec des tests qui reproduisent ton Excel (mêmes entrées, écarts documentés). C'est le cœur ; il ne dépend de rien. » (spec, Prochaines étapes, point 1). Première feature du projet ; inclut la mise en place du monorepo nécessaire pour compiler et tester.

## Analyse

### Quoi

Une bibliothèque TypeScript pure qui, à partir d'un `Projet` (bien, marché, hypothèses), calcule tout ce que le rapport affiche : financement, cash-flow, quatre régimes fiscaux projetés année par année, revente et plus-value, rendements et TRI, verdict à cinq feux, scénarios « et si » et prix cibles.

### Pourquoi

- C'est la seule brique dont dépendent tous les écrans, et la seule qui peut se tromper « en silence » devant un débutant.
- La spec démontre que le modèle Excel actuel donne un TRI de 50,9 % là où le vrai est 18,9 %, des frais d'acquisition surestimés de 2 900 €, une IRA doublée. Le moteur corrige ces écarts avec les règles de septembre 2026.
- L'auteur ne relit pas le code : la valeur est dans les tests de référence, pas dans l'UI.

### Pour qui

- Directement : les futures features `apps/web` (rapport) et `apps/worker` (aucune, le moteur reste côté client).
- Indirectement : Camille, qui verra des chiffres justes, expliqués, à charges pleines.

### Où

`packages/moteur` + fichiers racine du monorepo (`package.json` workspaces, `tsconfig.base.json`, ESLint, Prettier, Vitest, CI GitHub Actions). Aucun front, aucun worker.

## Existant réutilisable ([src/calculPret.ts](../../src/calculPret.ts))

| Élément                                                                  | Décision                                                                                                                             |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| PMT (`calculerMensualites`)                                              | Reprendre la formule ; sortir l'assurance en fonction séparée                                                                        |
| TAEG par itération à pas fixe (1 000 itérations, précision 1e-7)         | **Remplacer** par une résolution numérique propre (Newton ou bissection) incluant frais de dossier + garantie, comme l'exige la spec |
| Tableaux d'amortissement (sans différé, différé total, partiel, combiné) | Reprendre la logique ; **supprimer les dates** (`new Date()` = impur) ; unifier les 4 fonctions en une seule paramétrée              |
| `genererEcheancierSimple`                                                | Reprendre sous forme de regroupement par période                                                                                     |
| `ComparaisonPrets`                                                       | Hors périmètre (comparaison de deux banques : pas dans la spec v1)                                                                   |
| Types `BienData`, `PretData`                                             | Remplacés par les schémas Zod `Projet` / `Hypotheses` de la spec                                                                     |

## Outcomes (résultats attendus)

1. Les 11 indicateurs du tableau « Ton Excel → Loupe » sont reproduits par les tests, à ±1 € / ±0,05 pt (une fois les entrées complètes de l'Excel fournies).
2. Couverture 100 % lignes et branches sur `packages/moteur`.
3. Le moteur tourne dans le navigateur sans aucune dépendance runtime hors Zod, et calcule un projet complet en < 50 ms (10 ans de projection, 4 régimes, scénarios).
4. Toute règle datée est dans `regles/2026-09.ts` ; changer une valeur (ex. PS BIC 18,6 %) ne touche qu'un fichier.

## Outputs (livrables)

1. **Racine du monorepo** : `package.json` (workspaces), `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`, `vitest.workspace.ts`, `.github/workflows/ci.yml`, `README.md`. Retrait de `node_modules/` et `dist/` du suivi Git.
2. **`packages/moteur/src/schema/`** : schémas Zod `Projet`, `Bien`, `Marche`, `Hypotheses`, `Provenance`, `Resultats` (modèle de données de la spec).
3. **`regles/2026-09.ts`** : DMTO par département, tranches d'émoluments, CSI, débours, taux moyens du mois, taux d'usure, seuils HCSF, barèmes fiscaux (abattements, PS, plafonds micro, durées d'amortissement, part terrain), abattements plus-value, surtaxe.
4. **`financement/`** : frais d'acquisition détaillés, PMT, assurance, tableau d'amortissement (avec différés), TAEG résolu, taux d'effort HCSF (deux lectures), IRA.
5. **`cashflow/`** : trois modes (meublé LLD, nu, courte durée), sorties détaillées avec vacance et entretien, cash-flow mensuel/annuel, effort d'épargne, point mort, taux de couverture.
6. **`fiscalite/`** : quatre régimes projetés année par année avec stocks de déficits et d'amortissements (art. 39 C), année du premier impôt, plafonds micro et bascule.
7. **`revente/`** : cash net vendeur, plus-value imposable avec réintégration des amortissements de l'immeuble (LMNP réel), abattements IR/PS, surtaxe.
8. **`rendement/`** : brut, net, net-net, enrichissement, TRI sur flux annuels.
9. **`verdict/`** : cinq feux avec seuils nommés ; liste de points de vigilance (préparer la visite) par règles.
10. **`scenarios/`** : négociation (prix cible pour cash-flow 0 / net 6 % / brut 8 %), colocation, durée, taux +0,5 pt, nu, vacance.
11. **Tests** : unitaires par module, cas de référence Excel 92K, cas limites (apport = 100 %, durée 0, loyer 0, TMI 0, dépassement des plafonds micro, revente avant 5 ans, PV négative).

## Périmètre

### IN

- Tout ce qui est listé dans Outputs.
- Différé total / partiel (repris de l'existant, hypothèse optionnelle à 0 par défaut).
- Trois modes d'exploitation dont courte durée (nuitée × occupation − frais).
- Encadrement des loyers : simple plafond passé en hypothèse (le moteur ne connaît pas les villes).

### OUT (features suivantes)

- Toute interface, tout rendu de texte d'explication (les explications sont des textes UI).
- Estimations à partir des données publiques (DVF, ANIL, TF) : elles produisent des **hypothèses**, le moteur les consomme.
- Extraction LLM, capture, géocodage, enrichissement.
- Sauvegarde, partage, PDF.
- SCI à l'IS, comparaison de deux prêts, suivi de gestion.
- Suppression de l'ancien simulateur (`src/`, `webpack.config.js`) : proposée en fin de feature, à confirmer par Pierre (l'app actuelle est peut-être encore déployée sur Vercel).

## Contraintes

- TypeScript strict, zéro I/O, zéro `Date`, zéro `Math.random`, zéro `console`.
- Fichiers ≤ 300 lignes, fonctions ≤ 20 lignes de logique, nommage français métier.
- Résultats jamais persistés ; `version_regles` obligatoire dans tout `Projet`.
- Valeurs « à confirmer » (PS BIC 18,6 %) : paramètre modifiable + drapeau `aConfirmer: true` dans les règles.
- `gh` CLI absent de la machine : à installer avant l'étape push/PR.

## Risques

| Risque                                                                                                       | Mitigation                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Les entrées complètes de l'Excel 92K ne sont pas dans la spec (seulement prix 155 000 € et quelques sorties) | Demander le fichier Excel ou ses entrées à Pierre. En attendant : cas de référence construits à la main et vérifiés avec un simulateur public (ANIL, notaires.fr) |
| Règles fiscales incertaines (PS 18,6 %, BOFiP travaux amortis)                                               | Paramètres dans `regles/`, drapeau `aConfirmer`, tests écrits sur la valeur paramétrée                                                                            |
| Arithmétique flottante sur des euros                                                                         | Arrondi explicite aux frontières, tests avec tolérance nommée (`TOLERANCE_EURO = 1`)                                                                              |
| Résolution numérique (TAEG, TRI) qui ne converge pas                                                         | Bissection bornée avec garde-fou d'itérations, erreur nommée si pas de solution, tests des bornes                                                                 |
| Explosion du nombre de fichiers (10 modules)                                                                 | Un `index.ts` par module, API publique volontairement réduite (`calculerProjet(projet) → Resultats` + fonctions unitaires exportées)                              |

## Questions ouvertes (à trancher au checkpoint)

1. **Excel 92K** : Pierre peut-il fournir le fichier ou ses entrées (apport, durée, taux, assurance, loyer, charges, TMI, travaux, mobilier, département, durée de détention) ?
2. **Ancien simulateur** : peut-on supprimer `src/`, `webpack.config.js`, `dist/` à la fin de cette feature, ou l'app est-elle encore utilisée en ligne ?
3. **Différé** : confirmer qu'on le garde (repris de l'existant, coût faible) même s'il n'est pas dans la spec.

## Definition of Done

- [ ] `npm install && npm run lint && npm run typecheck && npm run test` passent à la racine, 0 warning
- [ ] Couverture `packages/moteur` : 100 % lignes et branches
- [ ] `calculerProjet(projet)` retourne l'intégralité des `Resultats` du modèle de données pour le projet d'exemple de la spec (T3 65 m² Marseille, 155 000 €)
- [ ] Cas de référence Excel 92K : 11 indicateurs testés (ou marqués `todo` avec les entrées manquantes documentées)
- [ ] Aucune dépendance runtime hors Zod ; aucun `Date`, `console`, `fetch`
- [ ] Règles datées isolées dans `regles/2026-09.ts` avec drapeaux `aConfirmer`
- [ ] `node_modules/` et `dist/` retirés du suivi Git
- [ ] CI GitHub Actions verte
- [ ] README, CLAUDE.md, `.product/` mis à jour ; PR ouverte (pas mergée)
