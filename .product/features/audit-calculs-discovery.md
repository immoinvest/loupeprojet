# Discovery — `audit-calculs` (fiche de backlog 22)

Session de nuit S1, 15/09/2026. Branche `feat/audit-calculs`.

## La demande

Pierre veut que chaque calcul du moteur soit vérifié deux fois, recoupé avec son Excel « Modèle Excel - Projet 92K.xlsx », et que les écarts soient expliqués ou corrigés, avec des recommandations.

## Résultats attendus (outcomes)

- Chaque indicateur du rapport a un verdict daté : identique, écart voulu (l'Excel se trompe ou simplifie), écart d'hypothèse, ou erreur du moteur.
- Les écarts connus deviennent des **tests** : un changement du moteur qui déplace un chiffre du cas de référence fait échouer la CI.
- Les erreurs confirmées du moteur sont corrigées, une PR `fix/calcul-…` par erreur, après la PR d'audit.

## Livrables (outputs)

1. `.product/audit/excel-92k.md` : lecture complète de l'Excel (entrées, formules, résultats, erreurs).
2. `.product/audit/calculs-2026-09.md` : tableau Excel / moteur / à la main ou source / verdict / action, recommandations.
3. `packages/moteur/src/exemples/projet-92k.ts`, `packages/moteur/tests/reference/projet-92k.test.ts`, tests de propriétés (fast-check).
4. Tableau « Ton Excel → Loupe » de `.product/functional-spec.md` mis à jour.

## Périmètre

- Dans : lecture de l'Excel (script jetable hors dépôt), exemple, tests, docs d'audit. Aucun changement du code de calcul dans cette PR.
- Hors : `apps/*`, écriture dans `revente/` et `fiscalite/` sauf corrections d'erreurs confirmées (PR séparées), barème de travaux (session S5).

## Contraintes

- Le fichier Excel reste hors git ; seules ses entrées chiffrées entrent dans le dépôt (décision de la fiche de session : hypothèses de projet, aucune donnée personnelle).
- Couverture du moteur maintenue à 100 % ; `exemples/` est exclu de la couverture.
- Aucune nouvelle dépendance d'exécution ; `fast-check` en devDependency de `packages/moteur`.

## Ce que révèle la première lecture

- **Sept feuilles** : prêt (deux banques côte à côte : LCL 155 000 € et CIC 108 000 €), autofinancement, imposition, revente, rendement, et **deux tableaux d'amortissement, un par banque** (question ouverte 1 : ce n'est pas une copie, c'est la seconde offre ; seule la première concerne le projet 92K).
- Le projet est une **colocation meublée de 4 chambres à 460 €**, 155 000 € FAI, 25 ans à 3,30 %.
- L'Excel contient plusieurs erreurs de formule (taux de la mensualité, intérêts calculés avec l'assurance, assurance comptée deux fois, amortissement déduit en créant un déficit, mobilier réintégré à la plus-value, IRA déduite du prix de cession, « TRI » = multiple ÷ années).
- Trois points du moteur sont contraires aux textes (voir l'audit) : ordre d'imputation LMNP (CE 15/04/2015), frais d'emprunt au nu réel (BOI-RFPI-BASE-20-80), prix d'acquisition de la plus-value quand les honoraires sont à la charge de l'acquéreur (BOI-RFPI-PVI-20-10-20-20 § 40 et 70).

## Risques

- Une correction change des chiffres visibles (impôt LMNP certaines années, impôt nu réel, impôt de plus-value) : dit en tête du rapport du matin.
- La session S4 modifie `revente/` et `fiscalite/` ensuite : les corrections sont petites et fusionnées avant.

## Auto-revue critique

- Le département, la surface et une ligne « Autre » de l'Excel ne sont pas représentables ou pas connus : ils sont documentés comme écarts d'hypothèse plutôt que forcés dans le moteur. Ajouter une charge libre au moteur serait une évolution produit, pas un audit : recommandation.
- Les sources consultées sont le BOFiP, Légifrance (via recherches) et des articles spécialisés pour la CSG 2026 ; la hausse à 18,6 % est confirmée par plusieurs sources mais la valeur reste « à confirmer » tant que le texte consolidé n'est pas cité dans les règles.
- Validé : on passe aux specs.
