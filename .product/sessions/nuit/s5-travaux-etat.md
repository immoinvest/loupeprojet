# S5 — `travaux-etat` (fiche 19)

Branche `feat/travaux-etat` · **Prérequis : `feat/audit-calculs`, `feat/formulaire-rapide`** · Règles : `_regles-nuit.md`

## Objectif

Travaux estimés au m² selon l'état du bien (et un supplément de rénovation énergétique si DPE F ou G), fourchette bas / estimé / haut, montant modifiable, recalculé tant que la personne ne l'a pas saisi ; projets existants inchangés. Détail : `C:\Users\errei\Claude\loupe-backlog\.product\backlog\19-travaux-selon-etat.md`.

## Barème

- Règles `travaux` datées dans `packages/moteur/src/regles/2026-09.ts`, **drapeau « à confirmer »**, sources listées (celles de la fiche) ; valeurs par défaut du tableau de la fiche (0 / 0 / 400 / 1 200 €/m² ; +250 €/m² si F/G, moitié si « à rénover »). Chercher en discovery une source publique (ANAH, ONRE, ADEME) : si tu en trouves une fiable, l'utiliser et le dire ; **ne jamais inventer** un chiffre.
- Mention « hors aides, à confirmer par devis » partout.

## Découpage

1. **Moteur** (tests d'abord, 100 %) : `estimerTravaux`, `travauxChoix` facultatif (défaut `saisi` pour les projets existants), recalcul par `appliquerSaisie` quand état / surface / DPE changent, section Méthode.
2. **Écrans** : carte Achat (Hypothèses), résumé « Estimé pour vous » du formulaire Vérifier (tel que livré par S3), phrase sous l'état dans Estimation, « dont travaux estimés » du Rapport, question de visite.

## Périmètre

`packages/moteur/src/{estimation,regles,schema}/`, `apps/web/src/hypotheses/appliquer.ts`, `ecrans/hypotheses/CarteAchat.tsx`, `ecrans/FormulaireProjet.tsx` et `ecrans/formulaire/*` (partie travaux seulement), `ecrans/adresse/Estimation.tsx` (une phrase), `textes/`, tests.

## Hors périmètre

Onglet Estimation au-delà de la phrase (S7), Fiscalité (S4).

## Fin

PR fusionnée ; rapport `C:\Users\errei\Claude\rapports-nuit\travaux-etat.md` ; action pour Pierre : valider ou changer le barème « à confirmer ».
