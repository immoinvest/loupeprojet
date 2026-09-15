# Architecture — `travaux-etat` (fiche 19)

Auto-validée le 15/09/2026 (session de nuit S5). Discovery : `.product/features/travaux-etat-discovery.md` ; specs : `.product/specs/travaux-etat-specs.md`.

## Principe

`hypotheses.achat.travaux` reste **la seule valeur lue par les calculs** (financement, rendement, HCSF, amortissements, plus-value) : aucun module de calcul ne change. La feature ajoute un barème daté, une estimation pure, un **choix** qui dit si le montant suit l'estimation, et le recalcul du montant quand le bien change.

## Moteur (`packages/moteur`)

| Fichier                                            | Rôle                                                                                                                                                                                                                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `regles/types.ts`, `regles/2026-09.ts`             | `FourchetteM2 { bas, estime, haut }` ; `travaux.parEtat` (4 états), `travaux.renovationEnergetique` (classes F et G, `partSiARenover` 0,5), `travaux.arrondi` (100) ; chemins `travaux.parEtat` et `travaux.renovationEnergetique` dans `aConfirmer` ; sources en commentaire  |
| `schema/hypotheses.ts`                             | `TravauxChoixSchema` = `estime` · `bas` · `haut` · `saisi` ; `AchatSchema.travauxChoix` **facultatif** (absent = saisi : projets existants intacts, aucune migration)                                                                                                          |
| `estimation/travaux.ts`                            | `estimerTravaux(bien, regles)` (null sans état ; lignes arrondies à l'euro, totaux à la centaine) ; `montantSelonChoix` ; `recalerTravaux(projet)` (choix estimé : montant recalculé, provenance `estime` ; état inconnu : 0 €, choix gardé) ; `choisirTravaux(projet, choix)` |
| `calculer-base.ts`, `schema/resultats*.ts`         | `Resultats.travaux` = `EstimationTravaux \| null` (repère, retenu ou non), `TravauxResultatSchema` strict                                                                                                                                                                      |
| `visite/contexte.ts`, `visite/base/diagnostics.ts` | prédicat `travauxEstimes` ; question `TRAVAUX_ESTIMES_DEVIS` (montant, fourchette, devis ; question à valeur sur `hypotheses.achat.travaux`) ; `TRAVAUX_CHIFFRAGE` seulement si le montant ne vient pas de l'estimation                                                        |

Pourquoi un choix plutôt qu'une provenance : la provenance est une chaîne libre (annonce, llm…) ; le choix est typé, validé par Zod, et voyage avec le projet synchronisé (`@loupe/projets` réutilise `ProjetSchema`, rien à changer).

## Web (`apps/web`)

| Fichier                                                              | Rôle                                                                                                                                                                             |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hypotheses/appliquer.ts`                                            | `CHEMIN_TRAVAUX` : saisie → `travauxChoix: 'saisi'` ; `CHEMIN_CHOIX_TRAVAUX` (pseudo-champ) → `choisirTravaux` ; `bien.etat`, `bien.surface`, `bien.dpe` → `recalerTravaux`      |
| `annonces/construire.ts`                                             | sans travaux saisis : montant estimé (0 € sans état) et `travauxChoix: 'estime'` ; avec : `saisi` ; calculé **avant** l'apport de 10 %                                           |
| `ecrans/hypotheses/TravauxEstimes.tsx`                               | détail des lignes, fourchette, tuiles Bas · Estimé · Haut (`aria-pressed`), « Revenir à l'estimation », mention hors aides ; inséré dans le dépliant Travaux de `CarteAchat.tsx` |
| `ecrans/adresse/Estimation.tsx`                                      | une phrase sous le choix de l'état (`phraseTravauxEtat`) ; `choisirEtat` passe par `recalerTravaux`                                                                              |
| `ecrans/financement/Cartes.tsx`                                      | ligne « Travaux estimés » du coût total quand le montant suit l'estimation                                                                                                       |
| `ecrans/formulaire/*` (après S3)                                     | résumé « Estimé pour vous » : travaux estimés quand l'état est choisi                                                                                                            |
| `textes/travaux.ts`, `textes/methode-travaux.ts`, `textes/visite.ts` | phrases, section Méthode « Les travaux » (constantes lues dans les règles, drapeau à confirmer), montants `bas`/`haut` de la question de visite formatés en euros                |

## Flux

```
bien.etat / surface / dpe ──appliquerSaisie──▶ recalerTravaux ──▶ achat.travaux (si choix ≠ saisi)
tuile Bas/Estimé/Haut ──appliquerSaisie(CHEMIN_CHOIX_TRAVAUX)──▶ choisirTravaux
saisie Travaux ──appliquerSaisie──▶ travauxChoix = saisi
calculerProjet ──▶ Resultats.travaux (repère) + tous les calculs sur achat.travaux
```

## Tests

- Moteur : `tests/estimation/travaux.test.ts` (cas à la main : 65 m² à rafraîchir DPE F, 30 m² à rénover DPE G, 110 m² bon état, rénové, état inconnu, arrondi ; recalcul, choix, résultats partiels, visite), `tests/regles/regles.test.ts` (cohérence du barème). Couverture 100 %.
- Web : `tests/travaux-etat.test.tsx` (création, `appliquerSaisie`, textes, carte Achat, onglet Estimation), `tests/methode.test.ts` (section et drapeaux).

## Auto-revue

- Aucun module de calcul touché : risque de régression faible, les 400 tests du moteur passent sans changement de chiffre.
- Le pseudo-chemin `hypotheses.achat.travauxChoix` évite un canal parallèle à `appliquerSaisie` (règle du projet : toute interaction passe par lui).
- Limite : la phrase de l'onglet Estimation n'apparaît qu'avec une estimation de prix (ventes connues) ; la carte Achat, elle, fonctionne sans ventes.
