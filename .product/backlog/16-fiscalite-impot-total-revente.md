# 16 — Fiscalité : impôt pendant l'exploitation + impôt à la revente = impôt total, par régime

Statut : `livrée` (15/09/2026, session de nuit S4, branche `feat/impot-total-revente`) · Notée le 14/09/2026 · Dépend de : 06 (horizon de revente, livrée) · Taille : une session (moteur, puis écrans)

Livraison : discovery `../features/impot-total-revente-discovery.md` · specs `../specs/impot-total-revente-specs.md` · architecture `../architecture/impot-total-revente.md` · état `../pipeline/impot-total-revente.json`.

Décisions appliquées (propositions de la fiche) : 1. « le plus avantageux au total » = le régime qui laisse le plus d'argent à la fin ; 2. « meilleur cash-flow » gardé ; 3. résidences services mentionnées, hors calcul ; 4. avertissement de reprise du déficit foncier (pas de calcul de la reprise) ; 5. indicateur « Impôt total (exploitation + revente) » dans Comparer, Rapport inchangé ; 6. LMP hors périmètre. Écart : graphique en barres HTML/CSS, Recharts n'étant pas installé dans `apps/web`.

## La demande de Pierre

> Sur l'onglet Fiscalité, quand on calcule l'imposition, je veux aussi comprendre l'imposition à la revente en fonction du régime. Il y a l'impôt que je paye pendant l'exploitation et l'impôt à la revente, ce qui fait un impôt total à la fin, surtout quand il y a de l'amortissement. Ça change la donne.

## Ce qui existe aujourd'hui

- **Moteur** : `packages/moteur/src/fiscalite/` calcule les quatre régimes côte à côte (`micro_bic`, `lmnp_reel`, `micro_foncier`, `nu_reel`) sur l'horizon de revente ; chaque `ResultatRegime` porte `impotTotal` (**exploitation seulement**), `cashflowApresImpotTotal`, `eligible`, les années.
- `packages/moteur/src/revente/index.ts` calcule la plus-value **une seule fois, pour le régime retenu** : `amortissementsAReintegrer(fiscalite)` renvoie les amortissements de l'immeuble du LMNP réel **seulement si `retenu === 'lmnp_reel'`**, sinon 0. `plusValueImposable` (`revente/plus-value.ts`) est pure et prend ces amortissements en paramètre : prix d'acquisition majoré − réintégration, abattements pour durée de détention, IR, prélèvements sociaux, surtaxe, taux lus dans les règles.
- `Resultats.revente` et le TRI (`rendement/index.ts`) utilisent le régime retenu.
- **Écran** `apps/web/src/ecrans/Fiscalite.tsx` : une carte par régime avec « X € d'impôt sur N ans », le cash-flow après impôt cumulé, l'explication, « Retenir ce régime », la pastille « meilleur cash-flow » ; frise des années imposées ; tableau année par année. **Rien sur la revente** : il faut aller dans l'onglet Revente, qui ne montre que le régime retenu.
- Conséquence : le LMNP réel paraît souvent imbattable (peu ou pas d'impôt grâce aux amortissements), alors que depuis le 15/02/2025 ces amortissements **augmentent la plus-value à la revente**. La comparaison actuelle est incomplète.

## Ce que ça changerait pour l'utilisateur

Chaque carte de régime dit trois chiffres :

```
LMNP réel                                    retenu
  Pendant 12 ans ............... 1 850 €
  À la revente (dans 12 ans) ... 9 400 €   dont 6 100 € dus aux amortissements réintégrés
  ─────────────────────────────────────
  Impôt total .................. 11 250 €
  Ce qu'il vous reste au total : cash-flow après impôt + vente nette = 58 300 €
```

- Une pastille **« le plus avantageux au total »** sur le régime qui laisse le plus d'argent à la fin (cash-flow après impôt cumulé + cash net de revente), à côté de « meilleur cash-flow » quand ce n'est pas le même régime.
- Un **graphique en barres empilées** : pour chaque régime, impôt d'exploitation et impôt de revente, pour voir d'un coup d'œil qui gagne pendant et qui paye à la fin.
- Un tableau **« La revente selon le régime »** : prix de cession, prix d'acquisition majoré, amortissements réintégrés, plus-value brute, abattements, impôt sur le revenu, prélèvements sociaux, surtaxe, total, cash net de revente, une colonne par régime.
- La frise des années imposées gagne une dernière case « revente ».
- L'horizon est celui de l'onglet Revente (curseur 1-30 ans), rappelé avec un lien « changer ».
- Le choix du régime ne change pas : « Retenir ce régime » garde le même rôle ; l'onglet Revente continue d'afficher le régime retenu.

## Proposition de réalisation

### Moteur (session A, tests d'abord, couverture 100 %)

- `revente/index.ts` : `amortissementsAReintegrer(fiscalite, regime)` prend le régime en paramètre (réintégration pour `lmnp_reel` seulement ; micro-BIC : pas d'amortissement déduit, rien à réintégrer ; nu : pas d'amortissement).
- Nouvelle fonction pure `reventeParRegime(projet, financement, fiscalite, regles): Readonly<Record<Regime, ResultatRevente>>` qui appelle `plusValueImposable` pour chaque régime ; `calculerRevente` devient `reventeParRegime(...)[fiscalite.retenu]` (même résultat qu'aujourd'hui pour le régime retenu : test de non-régression).
- Chaque `ResultatRegime` reçoit (ou `Resultats.fiscalite` porte à côté, pour ne pas mêler les modules) :
  - `impotRevente` = `plusValue.impotTotal`,
  - `impotGlobal` = `impotTotal` + `impotRevente`,
  - `enrichissementFinal` = `cashflowApresImpotTotal` + `cashNetVendeur`,
  - `meilleurAuTotal` désigné par une fonction pure (régimes éligibles seulement, égalité → ordre de `ORDRE_REGIMES`).
- `ResultatsSchema` (Zod) mis à jour ; les résultats ne sont jamais enregistrés, donc aucun projet à migrer.
- **Cas de référence** écrits et vérifiés à la main, documentés dans le test : un LMNP réel revendu à 10 ans avec amortissements, le même bien en micro-BIC et en nu réel ; un cas sans plus-value (revente à perte) ; un cas à plus de 22 ans (exonération IR) et plus de 30 ans (exonération totale).
- Règles : aucun nouveau taux inventé ; tout est lu dans `regles/2026-09.ts` (abattements, taux IR et PS de la plus-value, surtaxe, date de réintégration). Si une règle manque (voir questions 3 et 4), elle est ajoutée datée, sourcée et marquée « à confirmer ».

### Écrans (session B)

- `Fiscalite.tsx` / `CarteRegime` : les trois lignes (pendant, à la revente, total) et « ce qu'il vous reste » ; pastille « le plus avantageux au total » ; textes dans `apps/web/src/textes/regimes.ts` (`explicationRegime` complétée : « Les amortissements réduisent l'impôt pendant 12 ans, mais 6 100 € d'impôt s'ajoutent à la revente »).
- Graphique empilé (Recharts, déjà dans la pile ; version texte pour l'impression et les lecteurs d'écran).
- Tableau « La revente selon le régime » (même style que le tableau année par année, première colonne collante).
- `Frise` : case « revente » en fin de ligne.
- Rapport et Comparer : ajouter l'indicateur « impôt total (exploitation + revente) » du régime retenu (`analyses/comparaison.ts`, 14 → 15 indicateurs) — à confirmer (question 5).
- Onglet Méthode / textes générés : un paragraphe sur la réintégration des amortissements.

## Questions ouvertes

1. **Quel régime désigner « le plus avantageux »** : celui qui laisse le plus d'argent au total (cash-flow après impôt + cash net de revente, proposition), ou celui au plus petit impôt total ? Les deux diffèrent quand les loyers diffèrent (meublé vs nu).
2. **Garder « meilleur cash-flow »** en plus ? Proposition : oui, les deux pastilles quand ce ne sont pas les mêmes régimes, c'est justement ce qui « change la donne ».
3. **Exceptions à la réintégration** : la loi de finances 2025 exclut les résidences services (étudiants, seniors, EHPAD) ; le moteur ne connaît pas ce type de location. Proposition : hors v1, mentionné dans l'explication.
4. **Déficit foncier (nu réel)** : l'imputation sur le revenu global est reprise si la location cesse avant la fin de la 3ᵉ année qui suit ; revendre tôt la remet en cause. Vérifier si `fiscalite/nu-reel.ts` le gère ; sinon avertissement sur la carte quand l'horizon est de 3 ans ou moins, ou calcul de la reprise (proposition : avertissement d'abord).
5. **Rapport et Comparer** : ajouter l'impôt total dans cette feature (proposition : oui, un indicateur) ou plus tard ?
6. **LMP** (loueur professionnel : plus-value professionnelle, régime différent) : hors périmètre, comme aujourd'hui ; phrase d'avertissement quand les recettes dépassent le seuil ?

## Découpage proposé

1. **Session A — moteur** : `reventeParRegime`, champs par régime, schéma Zod, cas de référence, non-régression de `Resultats.revente` et du TRI. Aucune UI.
2. **Session B — écrans** : cartes des régimes, graphique, tableau de revente, frise, textes, Rapport/Comparer si validé.

## Tests à mettre à jour

- Moteur : `tests/revente*.test.ts`, `tests/fiscalite*.test.ts` et les tests de schéma de résultats ; nouveaux cas de référence (voir plus haut). Couverture 100 % lignes et branches.
- Web : tests de l'écran Fiscalité (trois lignes, pastilles, tableau de revente, frise), tests de `explicationRegime`, `analyses/comparaison.ts` si l'indicateur est ajouté ; Playwright : parcours Fiscalité (le montant « à la revente » change quand on bouge le curseur de l'onglet Revente).

## Coût et risques

- Aucun appel réseau ; calcul pur dans le navigateur (quatre appels à `plusValueImposable` au lieu d'un : négligeable).
- Risque métier : un chiffre fiscal faux est grave → cas vérifiés à la main, règles sourcées, mention « outil d'aide à la décision, pas un conseil » conservée.
- Risque d'interprétation : ne pas présenter le régime « le plus avantageux » comme une recommandation → libellé factuel (« laisse le plus d'argent au total avec ces hypothèses »).
