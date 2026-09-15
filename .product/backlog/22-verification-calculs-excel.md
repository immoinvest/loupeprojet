# 22 — Vérifier les calculs, les recouper avec l'Excel, recommander

Statut : `livrée` (audit : feature `audit-calculs`, 15/09/2026) · Notée le 14/09/2026 · Dépend de : rien ; **à faire avant 16 et 19** · Discovery : [audit-calculs-discovery.md](../features/audit-calculs-discovery.md) · Specs : [audit-calculs-specs.md](../specs/audit-calculs-specs.md) · Architecture : [audit-calculs.md](../architecture/audit-calculs.md) · Rapport : [calculs-2026-09.md](../audit/calculs-2026-09.md), [excel-92k.md](../audit/excel-92k.md)

## La demande de Pierre

> Je veux que tu vérifies deux fois les calculs qui sont faits pour t'assurer qu'ils sont bons, que tu proposes si besoin des recommandations, et que tu vérifies aussi avec l'Excel pour t'assurer qu'on arrive au même résultat.

## Ce qui a été livré

- Lecture complète de l'Excel (7 feuilles ; les deux tableaux d'amortissement sont deux offres de banque) et projet de référence `projet92k`.
- Test de référence (25 vérifications Excel / moteur / calcul à la main) et tests de propriétés fast-check.
- Tableau des écarts avec verdicts, relecture des règles contre les sources officielles, 12 recommandations.
- Trois erreurs du moteur confirmées, corrigées chacune dans sa PR : ordre d'imputation LMNP (CE 15/04/2015), frais d'emprunt au nu réel (BOI-RFPI-BASE-20-80), prix d'acquisition de la plus-value (BOI-RFPI-PVI-20-10-20-20).

## Questions ouvertes : décisions

1. Deux tableaux d'amortissement : un par banque (LCL pour le projet, CIC en comparaison).
2. Écart voulu contre erreur : moteur gardé, écart documenté et testé.
3. Publication en page : non cette nuit ; rapport en Markdown dans le dépôt.
4. Contrôle récurrent : `projet-92k.test.ts` dans la CI.
5. Entrées chiffrées dans le dépôt public : oui (hypothèses de projet, aucune donnée personnelle) ; le fichier Excel reste hors git.
