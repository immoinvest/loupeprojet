# Specs — `audit-calculs` (fiche 22)

## Épic : garantir les calculs du moteur

### US-1 — Lire l'Excel pour de vrai (Must)

En tant que Pierre, je veux une lecture fidèle de mon Excel pour savoir ce qu'il calcule exactement.

- **Étant donné** le fichier `Modèle Excel - Projet 92K.xlsx`, **quand** le script jetable le dézippe, **alors** `.product/audit/excel-92k.md` liste par feuille les entrées, les formules clés en clair et leurs valeurs enregistrées.
- **Et** les deux tableaux d'amortissement sont identifiés (une offre par banque).

### US-2 — Le projet 92K dans le moteur (Must)

- **Étant donné** les entrées de l'Excel, **quand** on les saisit dans `projet92k`, **alors** le projet est valide pour `ProjetSchema` et le rapport est complet.
- **Et** chaque entrée absente ou non représentable est dite dans le commentaire du fichier.

### US-3 — Test de référence (Must)

- **Étant donné** `projet92k`, **quand** le moteur calcule, **alors** chaque indicateur de l'Excel est vérifié : valeur Excel si l'Excel est juste, sinon valeur du moteur avec la raison écrite, et un calcul à la main dans le test.
- **Et** les formules fautives de l'Excel sont reproduites à part pour prouver l'écart (mensualité au mauvais taux, intérêts avec l'assurance…).

### US-4 — Tests de propriétés (Should)

- Somme du capital amorti = capital emprunté ; capital restant dû décroissant ; TRI qui annule la VAN ; impôt des régimes micro et LMNP jamais négatif ; cash-flow avant impôt = recettes − charges − crédit ; TAEG ≥ taux nominal.

### US-5 — Rapport d'écarts et recommandations (Must)

- `.product/audit/calculs-2026-09.md` : une ligne par indicateur, verdict ✅ 🟦 🟧 🟥, action ; recommandations.
- Tableau « Ton Excel → Loupe » de `functional-spec.md` à jour.

### US-6 — Corrections des erreurs 🟥 (Must, PR séparées après la fusion de l'audit)

- **Ordre LMNP** : dotation de l'année, puis amortissements différés, puis déficits antérieurs (CE 15/04/2015).
- **Nu réel** : frais de dossier et de garantie déductibles l'année 1 ; frais d'emprunt et assurance emprunteur suivent le régime des intérêts (report sur les revenus fonciers, pas d'imputation sur le revenu global).
- **Plus-value** : prix d'acquisition = prix de l'acte (hors honoraires acquéreur) ; honoraires acquéreur dans les frais réels ; forfaits 7,5 % et 15 % sur le prix de l'acte.

Chaque correction : test rouge d'abord, puis correction, puis mise à jour du test de référence.

## Priorités (MoSCoW)

Must : US-1, 2, 3, 5, 6. Should : US-4. Won't (recommandations) : charge libre « autre », indexation des loyers et charges, lissage de la surtaxe, CSG déductible, départements restés à 4,50 %.

## Auto-revue critique

Les critères sont vérifiables par test sauf US-1 et US-5 (documents). US-6 est découpée en trois PR pour respecter « une PR par erreur ». Validé.
