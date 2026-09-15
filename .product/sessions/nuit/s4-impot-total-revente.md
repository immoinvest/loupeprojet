# S4 — `impot-total-revente` (fiche 16)

Branche `feat/impot-total-revente` · **Prérequis : `feat/audit-calculs`** (et, si la session S1 a ouvert des `fix/calcul-*` sur la revente ou la fiscalité, attendre aussi leur fusion : vérifier avec `gh pr list --search "head:fix/calcul"` avant de créer ta branche) · Règles : `_regles-nuit.md`

## Objectif

Par régime fiscal : impôt pendant l'exploitation + impôt à la revente (amortissements réintégrés en LMNP réel) = impôt total ; « ce qu'il vous reste au total » ; pastille « le plus avantageux au total ». Détail et propositions : `C:\Users\errei\Claude\loupe-backlog\.product\backlog\16-fiscalite-impot-total-revente.md`.

## Découpage (une seule session, deux temps)

1. **Moteur d'abord, tests d'abord** : `reventeParRegime`, champs par régime, schéma Zod, cas de référence vérifiés à la main et documentés, non-régression de `Resultats.revente` et du TRI ; s'appuyer sur le cas `projet-92k` de l'audit S1.
2. **Écrans** : cartes des régimes (trois lignes), graphique empilé (Recharts), tableau « La revente selon le régime », case « revente » de la frise, textes, indicateur « impôt total » dans Comparer (proposition de la fiche).

## Règles métier

Aucun taux inventé : tout vient de `regles/2026-09.ts`. Déficit foncier et horizon ≤ 3 ans : avertissement (proposition). Résidences services : mention seulement. Libellé factuel, jamais une recommandation.

## Périmètre

`packages/moteur/src/{revente,fiscalite}/`, schéma des résultats, `apps/web/src/ecrans/Fiscalite.tsx` (+ sous-composants), `textes/regimes.ts`, `analyses/comparaison.ts`, tests.

## Hors périmètre

Barème de travaux (S5), onglet Revente au-delà du texte, liens vers les hypothèses (S9).

## Fin

PR fusionnée ; rapport `C:\Users\errei\Claude\rapports-nuit\impot-total-revente.md` avec un exemple chiffré LMNP réel vs micro-BIC.
