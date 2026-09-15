# S1 — `audit-calculs` (fiche 22)

Branche `feat/audit-calculs` · Prérequis : aucun · Règles : `_regles-nuit.md`

## Objectif

Vérifier tous les calculs du moteur, les recouper avec l'Excel « Projet 92K », un calcul à la main et les sources officielles ; produire le rapport d'écarts, le cas de référence en test, et les recommandations. Détail : `C:\Users\errei\Claude\loupe-backlog\.product\backlog\22-verification-calculs-excel.md`.

## Périmètre

- Lecture de l'Excel `C:\Users\errei\Claude\loupeprojet\Modèle Excel - Projet 92K.xlsx` (7 feuilles) par un script **jetable dans ton scratchpad** (dézipper, lire `xl/worksheets/*.xml`, `sharedStrings.xml`, valeurs calculées) : aucune dépendance ajoutée au dépôt, le fichier Excel **reste hors git**.
- `.product/audit/excel-92k.md`, `.product/audit/calculs-2026-09.md` (tableau Excel / moteur / à la main ou source / verdict / action, recommandations).
- `packages/moteur/src/exemples/projet-92k.ts`, `packages/moteur/tests/reference/projet-92k.test.ts`, tests de propriétés du moteur (fast-check en devDependency de `packages/moteur` si absent).
- Mise à jour du tableau « Ton Excel → Loupe » de `.product/functional-spec.md`.
- Décision prise pour Pierre : les **entrées chiffrées** de l'Excel (hypothèses du projet, aucune donnée personnelle) peuvent entrer dans le dépôt public ; pas le fichier.

## Erreurs du moteur (verdict 🟥)

- **Pas dans la PR d'audit.** Après la fusion de `feat/audit-calculs`, pour chaque erreur confirmée : branche `fix/calcul-<sujet>` depuis `origin/master`, test rouge d'abord, correction, gates, file vide, PR, fusion automatique ; une PR par erreur, dans cette même session.
- Si une correction change un chiffre visible (verdict, impôt), le dire en tête du rapport du matin.
- Écarts voulus (🟦) et d'hypothèse (🟧) : documentés, testés, pas corrigés.
- Recommandations qui dépassent une correction : les écrire dans le rapport d'audit (Pierre les transformera en fiches).

## Hors périmètre

`apps/*` (sauf lecture), `packages/moteur/src/revente/` et `fiscalite/` **en écriture** hors corrections 🟥 (la session S4 les modifie ensuite), barème de travaux (S5).

## Fin

PR d'audit fusionnée, puis PR de correction fusionnées ; rapport `C:\Users\errei\Claude\rapports-nuit\audit-calculs.md` avec le tableau des verdicts résumé.
