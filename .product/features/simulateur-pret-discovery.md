# Feature Discovery : Simulateur de prêt (deux offres côte à côte, tableaux d'amortissement à télécharger)

Fiche de backlog : `.product/backlog/08-simulateur-pret.md`. Demande de Pierre du 14/09/2026.

## Demande

> Ajoute un simulateur de prêt qui ressemble à ce qu'il y avait, qui permet de comparer deux offres de banques différentes et de télécharger les tableaux d'amortissement en sortie. Prépare toutes les spécifications nécessaires au développement.

## Ce qu'il y avait (ancien simulateur, supprimé le 13/09/2026 au commit `ad0b3ea`, relu dans l'historique)

Une page unique « Simulateur de Prêts Immobiliers » en trois colonnes :

- **Données du bien** : prix FAI, frais d'agence, montant des travaux, frais de notaire (saisis), revenu mensuel net.
- **Prêt 1 / Prêt 2** : nom de la banque, apport, frais de dossier, frais de garantie, taux nominal, taux d'assurance, durée (curseur 5 à 30 ans), différé total (curseur 0 à 36 mois), différé partiel (0 à 36 mois). Sous chaque colonne, les **résultats** (montant emprunté, taux nominal, TAEG hors et avec assurance, TAEA, taux d'endettement, coût total du crédit) et un **échéancier** par phase (différé total, différé partiel, amortissement : échéance hors et avec assurance).
- **Comparaison des prêts** : tableau critère / banque A / banque B / différence colorée (TAEG hors et avec assurance, mensualité totale, coût total du crédit, taux d'endettement, durée).
- **Tableaux d'amortissement** : un onglet par banque, 20 lignes par page (10 à 100), colonnes n°, date, solde initial, mensualité, capital, intérêts, intérêts cumulés, reste à rembourser, assurance, mensualité totale.
- **Sorties** : un PDF (jsPDF) avec résultats, comparaison, échéanciers et tableaux ; un **lien de partage** (`?sim=` base64 de la saisie).

Le modèle Excel de Pierre (`Modèle Excel - Projet 92K.xlsx`, feuille « Calculs prêt immo ») a la même structure : deux banques (LCL / CIC), revenu net → endettement, revente après x années → capital restant dû et IRA, deux tableaux d'amortissement.

## Ce que le dépôt a déjà

- `packages/moteur/src/financement/` : `tableauAmortissement` (différé total, partiel, combiné : la logique de l'ancien outil, testée), `regrouperParAnnee`, `echeancier` (regroupement par phase), `calculerMensualite`, `assuranceMensuelle`, `taeg` (résolu numériquement, frais de dossier et garantie inclus), `ira`, `tauxEffort`, `fraisAcquisition` (DMTO par département, émoluments par tranches). Tout est pur et couvert à 100 %.
- `calculerFinancement(projet, regles)` exige un `Projet` complet : inutilisable tel quel pour un prêt seul. Il finance les frais bancaires dans le montant emprunté ; l'Excel et l'ancien outil ne les financent pas.
- Règles datées (`regles/2026-09.ts`) : taux moyens par durée, taux d'usure, seuil HCSF, IRA.
- Web : `ChampHypothese` (champ libellé + badge + erreur, piloté par un `Descripteur`), conversions texte ↔ valeur (`hypotheses/conversion.ts`), `ModeDocument` et la page `Imprimer` (impression navigateur), `stockage/partage.ts` (base64url + Zod pour un fragment d'URL), formatage des nombres, composants `Carte`, `Ligne`, `Bouton`, `Pastille`, `GrosChiffre`.
- Principe du projet : le PDF se fait par `@media print` et l'impression du navigateur, pas par une bibliothèque.

## Analyse

- **Quoi** : une page `/simulateur-pret`, hors de tout projet, accessible depuis la barre latérale (nouvelle rubrique « Outils »). Trois colonnes comme avant : « Le projet financé » (prix FAI, honoraires d'agence, travaux, frais de notaire calculés par le moteur et modifiables, revenus nets facultatifs), « Offre A », « Offre B ». Chaque changement recalcule tout, sans bouton « Calculer ». Sous les offres : résultats, échéancier par phase, alerte si le TAEG dépasse l'usure. Puis la **comparaison** (critère / A / B / écart, meilleure valeur en évidence, phrase de synthèse) et les **tableaux d'amortissement** (un onglet par offre, présentés par année, chaque année dépliable en douze mois). Deux sorties : **CSV** du tableau mensuel de chaque offre (s'ouvre dans Excel, Numbers, Google Sheets) et **impression** (dossier « prêt » hors coque : paramètres, résultats, comparaison, tableaux annuels). Un **lien** reproduit la simulation (fragment d'URL, jamais envoyé au serveur) et la dernière simulation est retrouvée à la prochaine visite (stockage local).
- **Pourquoi** : c'est l'outil que Pierre utilisait ; choisir entre deux offres est une décision à part entière, souvent prise sans projet Deklic ouvert (offres reçues après le compromis). Le moteur sait déjà tout calculer : le simulateur est surtout une porte d'entrée de plus, gratuite et sans compte, vers des chiffres exacts (différés, TAEG résolu, coût total).
- **Pour qui** : Camille (première offre de prêt en main) et Pierre ; toute personne qui compare deux offres, même sans projet.
- **Où** : `packages/moteur` (nouveau module `pret/`, pur), `apps/web` (page, composants, sorties, textes, tests), docs. Aucun worker, aucune donnée externe.

## Outcomes

1. Comparer deux offres et savoir laquelle coûte le moins, en moins de cinq minutes, avec les mêmes formules que le rapport d'un projet (TAEG résolu numériquement, différés, assurance, frais).
2. Repartir avec un tableau d'amortissement exploitable hors de Deklic (CSV mensuel, une ligne par échéance) et un document imprimable.
3. Rien ne quitte le navigateur : pas d'appel réseau, pas de compte ; un lien reproduit la simulation.

## Outputs

1. Moteur : `OffrePretSchema`, `ProjetFinanceSchema`, `SimulationPretSchema` ; `simulerPret(projet, offre, regles) → ResultatPret` ; `comparerOffres(a, b) → ComparaisonOffres` ; `fraisNotaireEstimes` (réutilise `fraisAcquisition`).
2. Web : écran `SimulateurPret` (formulaire trois colonnes, résultats, comparaison, tableaux), écran `SimulateurImprimer` (hors coque, mode document), modules purs `simulateur/{saisie,lien,csv}.ts`, textes `textes/simulateur.ts`, entrée « Outils › Simulateur de prêt » dans la barre latérale, section « Simulateur de prêt » de la page Méthode.
3. Sorties : CSV par offre (UTF-8 avec BOM, `;`, virgule décimale), impression, lien `#s=…`, dernière simulation en stockage local.
4. Tests : moteur (100 %), modules web (100 %), écrans (rendu), un parcours e2e (deux offres, comparaison, téléchargement, lien).

## Périmètre

### IN

- Tout ce qui précède, avec une ou deux offres (la seconde peut être vide : pas de comparaison).
- Frais de notaire : calculés par le moteur à partir du prix, des honoraires et d'un département facultatif (taux DMTO par défaut sinon), modifiables (badge « estimé » puis « à toi »).
- Frais bancaires (dossier, garantie) : payés comptant par défaut, avec une case « financés par le prêt » (c'est le comportement d'un projet Deklic).
- Contrat du lien de pré-remplissage `#s=` que le bouton « Simuler un prêt » d'un projet (fiche de backlog 01) utilisera plus tard : `lienSimulateur(origine, simulation)`.

### OUT (plus tard, ou jamais)

- Le bouton « Simuler un prêt » dans un projet et le retour « appliquer à mon projet » (fiche 01).
- Capacité d'emprunt (revenus → montant maximal), prêts à paliers ou lissés, PTZ, prêt relais, taux variable, remboursement anticipé partiel ou versements supplémentaires, modulation d'échéance.
- Assurance calculée sur le capital restant dû (le moteur la calcule sur le capital initial ; simplification connue, dite dans Méthode).
- Dates d'échéance (l'ancien outil datait les lignes à partir d'aujourd'hui ; le moteur n'a pas de date système). Idée pour plus tard : « première échéance » saisie, dates calculées côté web.
- Export XLSX (le CSV s'ouvre dans Excel) ; PDF généré par bibliothèque (l'impression du navigateur suffit, comme partout dans Deklic).
- Enregistrement de plusieurs simulations, synchronisation avec un compte.
- Trois offres ou plus.

## Contraintes

- Moteur pur, sans I/O ni date, couverture 100 % (lignes, branches, fonctions) ; montants en euros, arrondi au centime aux frontières d'affichage et dans le CSV ; taux en décimal.
- Toute saisie validée par Zod (formulaire, fragment d'URL, stockage local) ; jamais d'exception sur un lien corrompu ; le lien est affiché comme texte, jamais interprété.
- Aucun `console.log`, aucun `dangerouslySetInnerHTML`, aucune bibliothèque de PDF ou de tableur, aucun CDN.
- Textes en français dans `textes/`, codes dans le moteur ; pas de tiret cadratin ; moins de texte que de chiffres.
- Accessibilité : chaque champ a un libellé, les curseurs annoncent leur valeur, les onglets des tableaux sont des boutons `aria-pressed`, cibles de 44 px, tableaux avec `caption`.
- Le CSV est produit par une fonction pure testée (contenu exact) ; seul le déclenchement du téléchargement est un effet (Blob + lien `download`), isolé dans un fichier minuscule.

## Risques

| Risque                                                                                      | Mitigation                                                                                                                                    |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Chiffres différents entre le simulateur et le rapport d'un projet (frais financés ou non)   | Case « frais bancaires financés » ; test du moteur : `simulerPret` avec la case cochée = `calculerFinancement` sur `projetExemple` au centime |
| « Taux d'endettement » confondu avec l'effort HCSF d'un projet (qui compte 70 % des loyers) | Libellé « taux d'endettement (mensualité ÷ revenus) », explication ⓘ et section Méthode                                                       |
| CSV mal ouvert par Excel (encodage, séparateur, décimales)                                  | BOM UTF-8, séparateur `;`, virgule décimale, `\r\n` ; testé sur le contenu ; vérifié à la main dans Excel avant la PR                         |
| 360 lignes rendues deux fois (deux offres) ralentissent la page sur un PC lent              | Vue par année, mois dépliés à la demande ; calcul mémoïsé (≈ 2 ms par offre, TAEG compris)                                                    |
| Fragment `#s=` forgé                                                                        | Décodage tolérant, Zod strict, valeurs bornées (prix ≤ 100 M€, taux ≤ 20 %, durée 1 à 30 ans, différés ≤ 36 mois), défauts en repli           |
| Téléchargement bloqué dans certains contextes (aperçu, iframe)                              | Le CSV s'affiche aussi via « Copier le tableau » (P2) ; sinon message clair                                                                   |
| Usure : le taux d'usure daté du moteur (5,29 %, T3 2026) vieillit                           | Affiché avec sa date, drapeau « à confirmer » comme les autres règles                                                                         |

## Auto-validation critique

- **Moteur plutôt que web** pour `simulerPret` : les mêmes fonctions servent au rapport d'un projet ; un écart entre les deux serait une faute. Le coût est un module de plus à couvrir à 100 %, petit (trois fichiers).
- **Pas de XLSX** : une bibliothèque de tableur pèse 300 Ko à 1 Mo pour un gain nul (Excel ouvre un CSV correctement formé). Réversible : le CSV reste, un XLSX pourrait s'ajouter.
- **Impression par le navigateur** plutôt que jsPDF comme avant : cohérent avec le reste de Deklic (`garder`), zéro dépendance, mise en page par CSS déjà en place. Le tableau mensuel complet (jusqu'à 720 lignes pour deux offres) n'est pas imprimé : les années le sont, les mois vont dans le CSV.
- **Recalcul immédiat** sans bouton « Calculer » : c'est le comportement de l'onglet Hypothèses ; l'ancien outil avait un bouton, mais rien ne le justifie avec un calcul de 2 ms.
- **Frais bancaires non financés par défaut** : c'est la réalité d'une offre de prêt (payés à la signature) et le choix de l'Excel ; la case permet l'autre lecture et la cohérence avec un projet.

## Definition of Done

- [ ] Gates verts : lint, format, typecheck, `test:coverage` (100 % sur `packages/moteur`, `apps/web/src/simulateur`, `apps/web/src/textes`), build
- [ ] Moteur : cas de référence à la main (taux 0 %, 12 % sur un an), cohérence avec `calculerFinancement`, différés, apport couvrant tout, usure, endettement absent
- [ ] Écran : deux offres saisies → résultats, comparaison, tableaux ; erreurs de champ ; offre B vide ; imprimable
- [ ] CSV téléchargé pour chaque offre, ouvert dans Excel avec les bonnes colonnes et décimales (vérification manuelle notée dans la PR)
- [ ] Lien copié → même simulation dans un contexte neuf ; lien corrompu → défauts et message
- [ ] Barre latérale : rubrique « Outils » ; page Méthode : section du simulateur
- [ ] e2e : parcours complet en Chromium
- [ ] Docs : `architecture/simulateur-pret.md` (déjà écrit, à ajuster), registre, README, CLAUDE.md, fiche de backlog 08 passée à « livrée » ; PR ouverte et armée en auto-merge
