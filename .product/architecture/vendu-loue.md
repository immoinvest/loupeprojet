# Architecture — vendu-loue

Specs : `.product/specs/vendu-loue-specs.md`. Aucun nouveau module : la décote suit exactement le chemin des corrections existantes (`dpe`, `etage`, `exterieur`).

## Fichiers

| Story | Fichier                                                             | Changement                                                           |
| ----- | ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| US-1  | `packages/moteur/src/schema/bien.ts`                                | `venduLoue: z.boolean().optional()`                                  |
| US-1  | `packages/moteur/src/schema/estimation.ts`                          | `CodeCorrectionSchema` += `occupation`                               |
| US-1  | `packages/moteur/src/schema/resultats-estimation.ts`                | enum des codes += `occupation`                                       |
| US-1  | `packages/moteur/src/regles/types.ts`, `2026-09.ts`                 | `estimation.occupation = -0.1`, sources en commentaire, `aConfirmer` |
| US-1  | `packages/moteur/src/estimation/index.ts`                           | `tauxOccupation` ; quatrième candidate proportionnelle               |
| US-1  | `packages/moteur/tests/estimation/estimation.test.ts`               | cas unitaires et estimation complète                                 |
| US-2  | `apps/web/src/annonces/extraire.ts`                                 | `ChampsExtraits.venduLoue`, fonction `venduLoue(texte)`              |
| US-2  | `apps/web/src/enrichissement/contrat.ts`                            | `loyerActuel: z.number().nonnegative().nullable().optional()`        |
| US-2  | `apps/web/src/enrichissement/lecture.ts`                            | `fusionnerChamps` : `loyerActuel > 0` → `venduLoue: true`            |
| US-3  | `apps/web/src/annonces/construire.ts`                               | `SaisieProjet.venduLoue`, provenance, `bien.venduLoue`               |
| US-3  | `apps/web/src/ecrans/formulaire/valeurs.ts`, `FormulaireProjet.tsx` | clé `venduLoue` (oui/non)                                            |
| US-3  | `apps/web/src/hypotheses/groupes-bien.ts`                           | champ `bien.venduLoue`                                               |
| US-4  | `apps/web/src/textes/estimation.ts`                                 | libellé, source, raison, phrases                                     |
| US-4  | `apps/web/src/textes/methode-estimation.ts`                         | étape Corrections, constante `estimation.occupation`                 |
| US-4  | `apps/web/src/textes/explications.ts`                               | ajustements du prix                                                  |

## Flux

```
texte de l'annonce ─ extraireChamps (règles) ─┐
/extract (loyerActuel) ───────────────────────┴─ fusionnerChamps ─ valeursDepuisChamps ─ Vérifier ─ construireProjet ─ bien.venduLoue
                                                                                                                         │
Hypothèses (appliquerSaisie) ────────────────────────────────────────────────────────────────────────────────────────────┘
bien.venduLoue ─ estimerPrix : tauxOccupation → correction « occupation » → centre, fourchette, selonEtat, ecartPrix → feu prix
```

## Décisions

- **Taux proportionnel additionné** comme les autres corrections (même modèle, même case « Compter »), pas un abattement appliqué après les charges : l'effet des charges reste borné sur la valeur corrigée, cohérent avec l'existant.
- **Pas de nouveau champ Worker** : `loyerActuel` est déjà dans le contrat v3 de `/extract` ; le web l'accepte en optionnel (les réponses en cache le portent déjà). Aucun redéploiement.
- **La mention « libre » l'emporte** sur une mention « loué » dans le même texte (« actuellement loué, vendu libre au départ du locataire » reste ambigu : on ne décote pas sans certitude).
- **Aucune migration** : champ facultatif.
- Pas de nouvelle ADR : décision dans la lignée d'`estimation-prix`.
