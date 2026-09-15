# Lecture de l'Excel « Modèle Excel - Projet 92K.xlsx »

Relevée le 15/09/2026 par un script jetable (dézippage du `.xlsx`, lecture de `xl/worksheets/sheet1…7.xml`, `sharedStrings.xml` et `workbook.xml` ; valeurs = celles enregistrées par Excel au dernier calcul). Le fichier reste hors git ; seules les entrées chiffrées sont reprises dans `packages/moteur/src/exemples/projet-92k.ts`.

## Sept feuilles

| Feuille                      | Rôle                                                                | Formules |
| ---------------------------- | ------------------------------------------------------------------- | -------- |
| Calculs prêt immo            | Deux offres côte à côte : banque 1 (LCL) et banque 2 (CIC)          | 31       |
| Calcul de l'autofinancement  | Entrées et sorties mensuelles, cash-flow meublé et courte durée     | 12       |
| Imposition                   | Micro-BIC contre réel, année N, N+1, N+x, projection sur 25 ans     | 229      |
| NEW - Revente                | Prix de revente, IRA, amortissements réintégrés, plus-value         | 15       |
| NEW - Rendement              | Brut, net, net-net, gain total, multiple, « TRI »                   | 39       |
| Tableau d'amortissements     | 360 lignes, prêt de la banque 1 (noms `Beg_Bal`, `Int`, `End_Bal`…) | ≈ 3 600  |
| Tableau d'amortissements (2) | 360 lignes, prêt de la banque 2 (noms suffixés `2`)                 | ≈ 3 600  |

**Question ouverte 1 de la fiche** : les deux tableaux ne sont pas une copie. Chacun sert une colonne de la feuille « Calculs prêt immo » : le premier le prêt LCL de 155 000 € (le projet 92K), le second un prêt CIC de 108 000 € (100 000 € + 4 000 € de travaux + 4 000 € de notaire, 20 ans à 1,70 %, assurance 0,16 %, début 2007), exemple de comparaison qui ne concerne pas ce projet. Les autres feuilles ne lisent que la banque 1. Des noms `…3` pointent vers `#REF!` : une troisième banque a été supprimée.

## Entrées du projet (banque 1)

| Entrée                               | Valeur                                                        | Cellule              |
| ------------------------------------ | ------------------------------------------------------------- | -------------------- |
| Prix FAI                             | 155 000 €                                                     | Calculs prêt immo C6 |
| Frais d'agence (compris dans le FAI) | 9 000 €                                                       | C7                   |
| Travaux                              | 0 €                                                           | C9                   |
| Frais de notaire                     | = C6 × 9,5 % = 14 725 €                                       | C10                  |
| Apport                               | = frais de notaire = 14 725 €                                 | C8                   |
| Montant emprunté                     | = C6 − C8 + C9 + C10 = 155 000 €                              | C13                  |
| Frais de dossier / de garantie       | 850 € / 2 000 € (non financés, non déduits de l'emprunt)      | C14, C15             |
| Taux nominal                         | 3,30 %                                                        | C16                  |
| Assurance                            | 0,37 % du capital par an                                      | C18                  |
| Durée                                | 25 ans, 12 échéances/an                                       | C20, C21             |
| Revenu net mensuel                   | 2 100 €                                                       | C38                  |
| Revente pour l'IRA                   | 10 ans                                                        | C42                  |
| Loyer HC                             | = 460 × 4 = 1 840 €/mois (4 chambres, « meublée à l'année »)  | Autofinancement C6   |
| Charges demandées au locataire       | 0 €                                                           | C7                   |
| Taxe foncière / copro / PNO          | 80 / 90 / 20 €/mois                                           | G8, G10, G11         |
| Électricité-gaz / internet           | 190 / 30 €/mois                                               | G9, G12              |
| CFE / comptable / autre              | 10 / 30 / 80 €/mois                                           | G14, G15, G16        |
| Courte durée (scénarios)             | nuitée 50 €, ménage 27 € ; 10, 15, 20 nuits = 3, 4, 5 séjours | C12, C13, C14-C16    |
| Terrain                              | 10 % du prix                                                  | Imposition C6        |
| Mobilier                             | 8 000 €                                                       | C13                  |
| Durées d'amortissement               | bien 30 ans, mobilier 5 ans                                   | C32, C33             |
| Mois loués                           | 12                                                            | C40                  |
| TMI / prélèvements sociaux           | 30 % / 17,2 %                                                 | C46, C47             |
| Évolution du marché                  | 2 %/an                                                        | Revente C11          |
| « Valeur (avec travaux) »            | 160 000 €                                                     | C12                  |
| Détention                            | 5 ans                                                         | C14                  |
| Agence à la revente / diagnostics    | 8 000 € / 1 100 €                                             | C16, C17             |
| Taux IR de la plus-value             | 19 %                                                          | C26                  |

Aucun département, aucune surface, aucune vacance, aucun entretien.

## Formules clés, en clair

### Prêt

- `Interest_Rate` (nom défini) = **C17** = « TAEG hors assurance » = 3,30 % + (2 000 + 850) ÷ 25 ÷ 155 000 = **3,3735 %** (et non C16, le taux nominal).
- Mensualité hors assurance = PMT(C17 ÷ 12 ; 300 ; 155 000) = **765,49 €**.
- Assurance = 155 000 × 0,37 % ÷ 12 = **47,79 €** ; mensualité totale **813,29 €**.
- « TAEG avec assurance » = C17 + 0,37 % = **3,74 %**.
- Intérêts du tableau (colonne H) = capital restant × (C17 + assurance) ÷ 12 ; capital remboursé = mensualité − ces intérêts. Total des intérêts **90 464 €** ; assurance totale 14 337,50 € ; « Montant total des intérêts » 104 801 €.
- Endettement = 813,29 ÷ 2 100 = **38,7 %**.
- IRA à 10 ans : 3 % du capital restant dû (114 039 €) = 3 421 € ; six mois d'intérêts suivants = 2 115 €. Les deux sont affichés, le minimum n'est pas pris.

### Autofinancement

- Sorties = 765,49 + 47,79 + 80 + 190 + 90 + 20 + 30 + 0 + 10 + 30 + 80 + 0 = **1 343,29 €**.
- Cash-flow meublé = 1 840 − 1 343,29 = **+496,71 €/mois**. Courte durée : 581 / 858 / 1 135 € de recettes pour 10 / 15 / 20 nuits → −762 / −485 / −208 €.

### Imposition

- Micro-BIC = 22 080 ÷ 2 × (30 % + 17,2 %) = **5 210,88 €**.
- Réel année N = 22 080 − (notaire 14 725 + agence 9 000 + dossier 850 + travaux 0) − (intérêts année 1 **5 743,84** + assurance 573,50 + TF 960 + copro 1 080 + CFE 120 + comptable 360 + PNO 240 + gestion 0 + autre 960) − amortissement du bien (155 000 − 15 500) ÷ 30 = 4 650 − mobilier 8 000 ÷ 5 = 1 600 = **−18 782 €** ; impôt 0.
- Année N+1 : −18 782 reporté + 22 080 − charges − 6 250 d'amortissements = −12 859 €.
- Année N+x : intérêts « annualisés » = (intérêts + assurance sur 25 ans) ÷ 25 = 4 192 €, **plus** l'assurance 573,50 € ; base 8 304 € ; impôt 3 920 €/an.
- « Au bout de combien d'années » = 24 575 ÷ (22 080 − 16 287) + 0 = **4,24 ans**. La projection (colonnes R à AB) donne une base positive en **année 5** (8 304 €), l'amortissement du mobilier s'arrêtant après la 5ᵉ année.
- Frais de garantie (2 000 €), électricité-gaz (2 280 €/an) et internet (360 €/an) ne sont **pas** déduits au réel.

### Revente (5 ans)

- Prix de vente = 160 000 × 1,02⁵ = **176 653 €**.
- IRA = 3 % × capital restant dû du tableau à 5 ans (136 088 €) = **4 083 €**.
- Amortissements réintégrés : bien = min(155 000 ÷ 30 × 5 ; 155 000) = 25 833 € (prix entier, terrain compris) ; mobilier = 8 000 €.
- Plus-value réalisée = (176 653 − 8 000 − 1 100 − 4 083) − (155 000 + 0 + 14 725) = −6 255 €.
- Plus-value taxable = 176 653 − 8 000 − 1 100 − 4 083 − (155 000 + 14 725) + 25 833 + 8 000 = **27 579 €** ; taux 36,2 % (19 % + 17,2 %, table d'abattements E4:H33) ; impôt **9 983 €**.

### Rendement

- Brut = 22 080 ÷ (155 000 + 0 + 14 725) = **13,01 %**.
- Net = (22 080 − TF 960 − copro 1 080 − énergie 2 280 − autres 2 040) ÷ 169 725 = **9,26 %**.
- Net-net = (22 080 − 6 360 − impôt réel « N+x » 2 734 − intérêts annualisés 4 192) ÷ 169 725 = **5,18 %** (l'impôt de cette ligne est recalculé : (22 080 − 16 287) × 47,2 %).
- Gain total (5 ans) = capital amorti 18 912 + plus-value après impôt −16 238 + loyers 110 400 − (charges 31 800 + intérêts 27 783 + mobilier 8 000 + impôts 8 016) = **37 475 €**.
- Multiple sur apport = 37 475 ÷ 14 725 = **2,54** ; « TRI » = 2,54 ÷ 5 = **50,9 %**.

## Erreurs et simplifications de l'Excel

| #   | Où                      | Constat                                                                                                                                                                                     |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Notaire                 | Forfait 9,5 % du prix FAI, honoraires d'agence compris dans l'assiette                                                                                                                      |
| 2   | Mensualité              | PMT au « TAEG » bricolé 3,3735 % au lieu du taux nominal 3,30 % (+6,05 €/mois)                                                                                                              |
| 3   | TAEG                    | Frais ÷ 25 ÷ capital ajoutés au taux : ce n'est pas un taux actuariel                                                                                                                       |
| 4   | Tableau d'amortissement | Intérêts au taux + assurance, mensualité au taux seul : 15 293 € restent dus après la 300ᵉ échéance                                                                                         |
| 5   | Frais bancaires         | Ni financés ni déduits de l'emprunt ; la garantie n'est pas déduite au réel                                                                                                                 |
| 6   | Endettement             | Mensualité ÷ revenus, sans les loyers (lecture HCSF : + 70 % des loyers)                                                                                                                    |
| 7   | IRA                     | 3 % seulement à la revente ; la règle est le minimum des deux plafonds                                                                                                                      |
| 8   | Réel                    | L'amortissement crée un déficit (interdit, art. 39 C) ; terrain à 10 %, bien sur 30 ans sans composants, agence amortie                                                                     |
| 9   | Réel                    | Énergie et internet non déduits ; assurance comptée deux fois en « N+x »                                                                                                                    |
| 10  | Prélèvements sociaux    | 17,2 % sur le BIC ; 18,6 % depuis la LFSS 2026                                                                                                                                              |
| 11  | Plus-value              | IRA déduite du prix de cession ; mobilier réintégré (exclu par la loi) ; réintégration sur le prix entier ; « valeur avec travaux » 160 000 € sans travaux ; forfaits 7,5 % et 15 % ignorés |
| 12  | Rendement net-net       | Intérêts annualisés sur 25 ans, assurance comprise                                                                                                                                          |
| 13  | TRI                     | Multiple ÷ années : pas un taux de rendement interne                                                                                                                                        |
| 14  | Horizon                 | 10 ans pour l'IRA de la feuille prêt, 5 ans pour la revente et le rendement                                                                                                                 |
