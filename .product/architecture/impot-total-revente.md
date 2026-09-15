# Architecture : impôt total par régime (fiche 16)

Specs : `../specs/impot-total-revente-specs.md`.

## Moteur

```
fiscalite/index.ts  calculerFiscalite
  ├─ PROJECTEURS[regime](ctx)            → ProjectionRegime (inchangé, ex-ResultatRegime)
  ├─ reventeDuRegime(projet, financement, projection, regles)   (revente/index.ts)
  │     plusValueImposable(..., amortissementsReintegres = amortissementsAReintegrer(projection))
  ├─ bilan : impotRevente, impotGlobal, enrichissementFinal     → ResultatRegime
  └─ meilleur, meilleurImpot, meilleurAuTotal (meilleurSelon)

revente/index.ts
  amortissementsAReintegrer(regime: { regime, amortissementsImmeubleDeduits })  → lmnp_reel seulement
  reventeDuRegime(projet, financement, regime, regles)  → ResultatRevente
  reventeParRegime(projet, financement, fiscalite, regles) → Record<Regime, ResultatRevente>
  calculerRevente(projet, financement, fiscalite, regles) = fiscalite.regimes[retenu].revente
```

- `fiscalite/types.ts` : `ProjectionRegime` (champs actuels) ; `ResultatRegime extends ProjectionRegime` avec `revente`, `impotRevente`, `impotGlobal`, `enrichissementFinal`. Les projecteurs et `finaliserRegime` rendent `ProjectionRegime`.
- `revente/index.ts` n'importe que des **types** de `fiscalite` : pas de cycle à l'exécution.
- `schema/resultats.ts` : `ReventeResultatSchema` déclaré avant `RegimeResultatSchema`, qui le reprend ; `meilleurAuTotal` dans `FiscaliteResultatSchema`.
- `calculer-base.ts` inchangé (appelle toujours `calculerRevente`).

## Web

```
ecrans/Fiscalite.tsx              orchestre (titre, tranche, horizon, cartes, graphique, frise, tableaux)
ecrans/fiscalite/CarteRegime.tsx  trois lignes, reste au total, pastilles, explication, avertissement
ecrans/fiscalite/Frise.tsx        années + case « revente »
ecrans/fiscalite/ImpotsEmpiles.tsx barres en deux segments (HTML/CSS), liste lisible (sr-only / print)
ecrans/fiscalite/TableauRevente.tsx « La revente selon le régime »
ecrans/fiscalite/TableauAnnees.tsx « Année par année » (déplacé)
textes/regimes.ts                 explicationRegime (+ revente), impotDuAuxAmortissements, repriseDeficitPossible, LIGNES_REVENTE
textes/methode-fiscalite.ts       phrase sur l'impôt total
analyses/comparaison.ts           indicateur impotGlobal
```

- `impotDuAuxAmortissements(f)` = `regimes.lmnp_reel.impotRevente − regimes.micro_bic.impotRevente` (mêmes valeur, frais, durée : seule la réintégration diffère ; borné à 0).
- `repriseDeficitPossible(r, annees)` : `r.regime === 'nu_reel'` et une année A avec `deficitImputeRevenuGlobal > 0` et `annees < A + 3`.
- Lien « Changer l'horizon » : `Link to="../revente"` (relatif à la route du volet), `survol-texte`, absent en mode document.

## Tests

- Moteur : `tests/revente/revente-par-regime.test.ts` (cas de référence), `tests/fiscalite/calculer-fiscalite.test.ts` (`meilleurAuTotal`), tests existants ajustés au nouveau type.
- Web : `tests/regimes.test.ts` (textes purs), `tests/onglets.test.tsx` (écran), `tests/comparaison.test.ts` ; e2e `onglets.spec.ts` (le montant à la revente suit l'horizon).
