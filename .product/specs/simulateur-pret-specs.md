# Specs — Simulateur de prêt

Discovery : `.product/features/simulateur-pret-discovery.md`. Branche à créer : `feat/simulateur-pret`.

## Épics

| Épic | Titre                                            | Stories                              |
| ---- | ------------------------------------------------ | ------------------------------------ |
| E1   | Moteur : simuler une offre, comparer deux offres | US-1, US-2                           |
| E2   | Écran : saisie, résultats, comparaison, tableaux | US-3, US-4, US-5                     |
| E3   | Sorties : CSV, impression, lien, coque, Méthode  | US-6, US-7, US-8                     |
| E4   | Documentation et fin de pipeline                 | registre, README, CLAUDE.md, backlog |

## Modèle de données (moteur, Zod)

```
OffrePretSchema
  nom: string 1..40                          défaut « Offre A » / « Offre B » (posé par le web)
  apport: montant ≥ 0                        défaut 0
  fraisDossier: montant ≥ 0                  défaut 0
  fraisGarantie: montant ≥ 0                 défaut 0
  fraisBancairesFinances: boolean            défaut false (payés comptant ; true = comme un projet Deklic)
  tauxNominal: taux 0..0,2                   obligatoire
  tauxAssurance: taux 0..0,02                défaut 0,0025 (même défaut que PretSchema)
  dureeAnnees: entier 1..30                  obligatoire
  differeTotalMois: entier 0..36             défaut 0
  differePartielMois: entier 0..36           défaut 0
  refine : differeTotalMois + differePartielMois < dureeAnnees × 12  (message « Le différé doit être plus court que le prêt », path differeTotalMois)

ProjetFinanceSchema
  prix: > 0, ≤ 100 000 000                   prix affiché, honoraires inclus
  honorairesAgence: montant                  défaut 0 (inclus dans le prix, à la charge de l'acquéreur)
  travaux: montant                           défaut 0
  fraisNotaire: montant                      obligatoire (le web le pré-remplit par fraisNotaireEstimes)
  departement: string 2..3                   facultatif (sert seulement à l'estimation des frais de notaire)
  revenusMensuels: montant                   facultatif (endettement)

SimulationPretSchema
  versionRegles: VersionReglesSchema         défaut « 2026-09 »
  projet: ProjetFinanceSchema
  offres: [OffrePretSchema] de 1 à 2 éléments

ResultatPret (type)
  aEmprunter: boolean                        false si l'apport couvre tout (tableau vide, mensualités 0, TAEG null)
  besoin: number                             prix + travaux + fraisNotaire (+ frais bancaires si financés)
  montantEmprunte: number                    max(0, besoin − apport)
  fraisBancaires: number                     fraisDossier + fraisGarantie
  mensualiteHorsAssurance, assuranceMensuelle, mensualiteTotale: number   (phase d'amortissement)
  echeancier: Echeance[]                     par phase (réutilise financement/echeancier)
  tableau: LigneAmortissement[]              mensuel (réutilise tableauAmortissement)
  parAnnee: AnneeCredit[]
  totalInterets, totalAssurance, totalMensualites: number
  coutTotalCredit: number                    intérêts + assurance + frais bancaires
  taegHorsAssurance, taegAvecAssurance: number | null
  tauxUsure: number ; tauxUsureDepasse: boolean
  endettement: number | null                 mensualiteTotale ÷ revenusMensuels ; null sans revenus

ComparaisonOffres (type)
  criteres: CritereCompare[]                 dans l'ordre : mensualiteTotale, coutTotalCredit, totalInterets, totalAssurance,
                                             taegHorsAssurance, taegAvecAssurance, montantEmprunte, dureeAnnees, endettement
  CritereCompare = { code, a: number | null, b: number | null, ecart: number | null (a − b), meilleure: 'a' | 'b' | null }
  meilleure : la plus petite valeur pour tous les critères ; null si égalité (à 1 centime ou 0,001 point près) ou valeur absente ;
  dureeAnnees et montantEmprunte : informatifs, meilleure = null toujours (une durée plus courte n'est pas « meilleure » en soi)
```

Le web n'ajoute aucun calcul : il convertit des textes en `SimulationPretEntree`, appelle le moteur et formate.

## Stories

### US-1 : Simuler une offre de prêt (moteur)

En tant que développeur, je veux `simulerPret(projet, offre, regles)` pur, bâti sur `tableauAmortissement`, `taeg`, `echeancier`, pour obtenir tous les chiffres d'une offre avec les mêmes formules que le rapport d'un projet.

Priorité **P0** · Effort **M**

```gherkin
Scénario : cas de référence sans intérêts
  Étant donné un projet { prix 100 000, travaux 0, fraisNotaire 0 } et une offre { apport 0, tauxNominal 0, dureeAnnees 20, tauxAssurance 0,003, fraisDossier 500, fraisGarantie 1 000 }
  Quand je simule
  Alors montantEmprunte = 100 000, mensualiteHorsAssurance = 416,67 (100 000 ÷ 240, arrondi à l'affichage), assuranceMensuelle = 25, mensualiteTotale = 441,67
  Et totalInterets = 0, totalAssurance = 6 000, fraisBancaires = 1 500, coutTotalCredit = 7 500
  Et taegHorsAssurance > 0 (les 1 500 € de frais sur 240 mois), taegAvecAssurance > taegHorsAssurance
  Et tableau a 240 lignes, la dernière a crdFin = 0 (à 1 centime près)

Scénario : cas de référence vérifié à la main
  Étant donné un projet { prix 100 000, fraisNotaire 0 } et une offre { apport 0, tauxNominal 0,12, dureeAnnees 1, tauxAssurance 0 }
  Quand je simule
  Alors mensualiteHorsAssurance = 8 884,88 (100 000 × 0,01 ÷ (1 − 1,01^−12)) et totalInterets = 6 618,55 (à 1 centime près)

Scénario : cohérence avec le rapport d'un projet
  Étant donné projetExemple et l'offre construite depuis ses hypothèses avec fraisBancairesFinances = true,
    projet { prix, honoraires, travaux, fraisNotaire = fraisAcquisition(...).total, revenus }
  Quand je simule
  Alors montantEmprunte, mensualiteTotale, totalInterets, totalAssurance, coutTotalCredit, taegAvecAssurance sont égaux (au centime, au 0,0001 pour les taux) à calculerFinancement(projetExemple, regles)

Scénario : différés
  Étant donné une offre avec differeTotalMois 12 et differePartielMois 6 sur 20 ans
  Quand je simule
  Alors echeancier a trois phases (differe_total 1..12, differe_partiel 13..18, amortissement 19..240)
  Et tableau est identique à tableauAmortissement({ capital, tauxAnnuel, dureeMois 240, 12, 6, tauxAssurance })

Scénario : l'apport couvre tout
  Étant donné un projet { prix 100 000, fraisNotaire 8 000 } et une offre { apport 120 000 }
  Quand je simule
  Alors aEmprunter = false, montantEmprunte = 0, tableau = [], mensualiteTotale = 0, coutTotalCredit = fraisBancaires, taeg null, endettement = 0 si revenus, sinon null

Scénario : frais bancaires financés
  Étant donné la même offre avec fraisBancairesFinances true puis false
  Alors montantEmprunte diffère exactement de fraisDossier + fraisGarantie et coutTotalCredit compte les frais dans les deux cas

Scénario : usure et endettement
  Étant donné une offre à 6 % avec assurance 1 % et regles.credit.tauxUsure = 0,0529
  Alors tauxUsureDepasse = true
  Et avec revenusMensuels 2 100 et mensualiteTotale 807,23, endettement = 0,3844 ; sans revenus, endettement = null

Scénario : hypothèse invalide
  Étant donné differeTotalMois 240 sur 20 ans
  Quand je valide par OffrePretSchema
  Alors l'erreur porte le message « Le différé doit être plus court que le prêt » sur differeTotalMois (et simulerPret n'est pas appelé)
```

### US-2 : Comparer deux offres (moteur)

En tant que Camille, je veux voir, critère par critère, laquelle des deux offres est la meilleure et de combien.

Priorité **P0** · Effort **S**

```gherkin
Scénario : nominal
  Étant donné A { mensualiteTotale 807,23, coutTotalCredit 94 000 } et B { 545,54, 25 287 }
  Quand je compare
  Alors le critère mensualiteTotale a a = 807,23, b = 545,54, ecart = 261,69, meilleure = 'b'
  Et coutTotalCredit meilleure = 'b'

Scénario : égalité et absence
  Étant donné deux offres identiques
  Alors chaque critère a meilleure = null et ecart = 0
  Étant donné A sans revenus (endettement null)
  Alors le critère endettement a a = null, ecart = null, meilleure = null

Scénario : critères informatifs
  Étant donné A sur 25 ans et B sur 20 ans
  Alors le critère dureeAnnees a ecart = 5 et meilleure = null ; montantEmprunte de même

Scénario : ordre stable
  Alors criteres est toujours dans l'ordre déclaré, avec les neuf codes, même si des valeurs manquent
```

### US-3 : Saisir un projet et deux offres, voir les résultats

En tant que Camille, je veux saisir le bien financé et une ou deux offres et voir les résultats se mettre à jour à chaque frappe, pour comparer sans bouton ni rechargement.

Priorité **P0** · Effort **L**

```gherkin
Scénario : page vide
  Étant donné aucune simulation enregistrée
  Quand j'ouvre /simulateur-pret
  Alors je vois le titre « Comparer deux offres de prêt », trois cartes : « Le projet financé », « Offre A », « Offre B »
  Et les défauts : prix 150 000, honoraires 0, travaux 0, frais de notaire estimés (badge « estimé »), revenus vides ;
    offres : apport 0, frais de dossier 0, garantie 0, taux nominal = taux moyen 20 ans des règles (badge « taux du mois »), assurance 0,25 %, durée 20 ans, différés 0, frais bancaires financés « non »
  Et les résultats sont déjà calculés pour A ; l'offre B, identique à A, affiche ses résultats et la comparaison indique « offres identiques »

Scénario : saisie et recalcul
  Quand je tape 3,3 dans « Taux nominal » de l'offre A et 25 dans « Durée »
  Alors la carte de résultats de A affiche montant emprunté, mensualité hors assurance, assurance, mensualité totale, TAEG hors et avec assurance, coût total du crédit, total des intérêts, total assurance, échéancier par phase
  Et la comparaison se met à jour sans autre action

Scénario : frais de notaire estimés puis modifiés
  Quand je change le prix
  Alors les frais de notaire suivent (badge « estimé ») tant que je ne les ai pas modifiés ; une fois modifiés, badge « à toi » et ils ne bougent plus (bouton « Ré-estimer » pour revenir)
  Quand je saisis un département (ex. 13)
  Alors l'estimation utilise le taux DMTO de ce département

Scénario : erreur de champ
  Quand je tape « abc » dans « Taux nominal » ou un différé total de 300 mois sur 20 ans
  Alors le champ montre l'erreur (message du schéma), la carte de résultats de cette offre affiche « Corrigez les champs en rouge » et la comparaison est masquée ; l'autre offre reste calculée

Scénario : rien à emprunter
  Quand l'apport dépasse prix + travaux + frais de notaire
  Alors la carte affiche « Rien à emprunter : l'apport couvre tout » et coût total = frais bancaires

Scénario : usure et endettement
  Quand le TAEG avec assurance dépasse le taux d'usure des règles
  Alors une pastille « au-dessus du taux d'usure (5,29 %, T3 2026) » apparaît sur l'offre
  Quand je renseigne des revenus nets
  Alors « Taux d'endettement » apparaît dans les résultats (mensualité totale ÷ revenus) avec une pastille « surveiller » au-delà du seuil HCSF des règles (35 %)

Scénario : offre B vide
  Quand je vide le nom et les champs de B (bouton « Retirer l'offre B »)
  Alors la page n'affiche qu'une offre, ni comparaison ni second onglet de tableau ; « Ajouter une offre B » la remet avec les valeurs de A

Scénario : dernière simulation retrouvée
  Étant donné une simulation saisie
  Quand je recharge la page
  Alors les mêmes valeurs sont là (stockage local, clé « loupe.simulateur.v1 », validée par Zod ; contenu illisible ignoré)
```

### US-4 : Comparaison des deux offres

En tant que Camille, je veux un tableau critère / A / B / écart avec la meilleure valeur mise en avant et une phrase de synthèse.

Priorité **P0** · Effort **S**

```gherkin
Scénario : tableau
  Étant donné A (LCL, 3,3 %, 25 ans) et B (CIC, 1,7 %, 20 ans) valides
  Alors la carte « Laquelle coûte le moins ? » montre un tableau avec les neuf critères, les valeurs formatées (euros, pourcentages à deux décimales, ans), l'écart signé, la meilleure valeur en gras avec une pastille « meilleure »
  Et la phrase de synthèse : « <nom de la meilleure offre> coûte <écart de coût total> de moins sur toute la durée, pour une mensualité de <écart de mensualité> de moins. » (chiffres formatés depuis la comparaison, jamais recopiés ; si la mensualité la plus basse n'est pas celle du coût total le plus bas, la phrase le dit : « <A> a la mensualité la plus basse, <B> le coût total le plus bas »)

Scénario : durées différentes
  Alors une ligne « Durée » rappelle 25 ans et 20 ans et une note : « Une mensualité plus faible sur une durée plus longue coûte plus d'intérêts : comparez le coût total. »

Scénario : offres identiques
  Alors le tableau s'affiche sans pastille et la phrase dit « Les deux offres sont identiques. »

Scénario : impression
  Étant donné le mode document
  Alors le tableau s'imprime tel quel, sans bouton
```

### US-5 : Tableaux d'amortissement à l'écran

En tant que Camille, je veux consulter le tableau d'amortissement de chaque offre, année par année puis mois par mois.

Priorité **P0** · Effort **M**

```gherkin
Scénario : onglets
  Étant donné deux offres valides
  Alors la carte « Tableaux d'amortissement » a deux boutons d'onglet nommés par les offres (aria-pressed), A sélectionné

Scénario : vue par année
  Alors le tableau (caption « Tableau d'amortissement, <nom>, <durée> ans à <taux> ») a une ligne par année : année, intérêts, capital remboursé, mensualités, assurance, capital restant dû fin d'année, plus une ligne de totaux
  Quand je clique une année (bouton « Voir les mois », aria-expanded)
  Alors ses douze lignes mensuelles apparaissent sous elle : mois, phase (« différé total » / « différé partiel » / « amortissement »), CRD début, intérêts, capital, mensualité hors assurance, assurance, mensualité totale, CRD fin

Scénario : différé
  Étant donné un différé total de 12 mois
  Alors l'année 1 montre 0 € de capital remboursé et un CRD fin supérieur au CRD début, et chaque ligne mensuelle porte la phase

Scénario : rien à emprunter
  Alors la carte affiche « Pas de tableau : rien à emprunter » pour cette offre
```

### US-6 : Télécharger le tableau d'amortissement en CSV

En tant que Pierre, je veux télécharger le tableau mensuel de chaque offre pour l'ouvrir dans Excel.

Priorité **P0** · Effort **S**

```gherkin
Scénario : contenu du fichier
  Étant donné l'offre A (LCL, 155 000 € empruntés, 3,3 %, 25 ans, assurance 0,37 %)
  Quand j'appelle csvAmortissement(offre, resultat)
  Alors le texte commence par le BOM U+FEFF, puis l'en-tête
    « Mois;Année;Phase;Capital restant dû début;Intérêts;Capital remboursé;Mensualité hors assurance;Assurance;Mensualité totale;Capital restant dû fin »
  Et une ligne par mois avec les montants arrondis au centime et la virgule décimale : « 1;1;Amortissement;155000,00;426,25;333,19;759,44;47,79;807,23;154666,81 » (valeurs à confirmer au centime par le test, calculées par le moteur)
  Et une dernière ligne « Totaux;;;;<intérêts>;<capital>;<mensualités>;<assurance>;<total>;0,00 »
  Et les lignes se terminent par \r\n ; aucun champ ne contient de « ; » (les phases sont des libellés fixes)

Scénario : nom du fichier
  Alors nomFichierCsv(offre) = « deklic-amortissement-lcl-25-ans-3-30.csv » (nom de banque en minuscules sans accent ni espace, durée, taux avec deux décimales ; « offre-a » si le nom est vide)

Scénario : bouton
  Quand je clique « Télécharger le tableau (CSV) » sous l'onglet de l'offre A
  Alors un fichier CSV est proposé par le navigateur (Blob text/csv;charset=utf-8, lien download, URL révoquée après le clic)
  Et en mode document le bouton n'existe pas

Scénario : offre sans emprunt
  Alors le bouton est absent
```

### US-7 : Imprimer et partager la simulation

En tant que Camille, je veux imprimer la simulation (ou l'enregistrer en PDF) et envoyer un lien qui la reproduit.

Priorité **P1** · Effort **M**

```gherkin
Scénario : lien
  Quand je clique « Copier le lien »
  Alors le presse-papiers reçoit <origine>/simulateur-pret#s=<base64url de la simulation> ; si le presse-papiers refuse, le lien s'affiche dans un champ à copier
  Quand j'ouvre ce lien dans un contexte neuf
  Alors la même simulation est affichée et enregistrée localement

Scénario : lien corrompu ou trop ancien
  Quand j'ouvre /simulateur-pret#s=abc
  Alors la page affiche les défauts et une pastille « Lien illisible : simulation par défaut affichée » ; rien n'est enregistré avant une première modification

Scénario : pré-remplissage partiel
  Quand le fragment ne contient que projet.prix et offres[0].{tauxNominal, dureeAnnees}
  Alors le reste prend les défauts du schéma (c'est le contrat du futur bouton « Simuler un prêt » d'un projet : lienSimulateur(origine, simulation))

Scénario : impression
  Quand je clique « Imprimer »
  Alors /simulateur-pret/imprimer#s=… s'ouvre hors coque en mode document et lance window.print() après 150 ms (même mécanique que Imprimer.tsx) ;
    le document contient : en-tête (logotype, « Simulation de prêt », date d'impression, version des règles), les paramètres du projet et des offres, les résultats, la comparaison, les tableaux annuels (pas les mois), un pied « outil d'aide à la décision, pas un conseil »
  Et « Retour au simulateur » ramène à la page avec la même simulation
```

### US-8 : Entrée dans la coque et page Méthode

En tant que Camille, je veux trouver le simulateur dans le menu et comprendre ce qu'il calcule.

Priorité **P1** · Effort **S**

```gherkin
Scénario : barre latérale
  Alors la barre latérale a une rubrique « Outils » (nav aria-label « Outils ») avec le lien « Simulateur de prêt » (icône Calculator) avant la rubrique « Aide »

Scénario : Méthode
  Alors la page Méthode a une section « Simulateur de prêt » : montant emprunté, mensualité, assurance sur capital initial (simplification), TAEG (frais inclus, résolu numériquement), coût total, taux d'endettement (mensualité ÷ revenus, distinct de l'effort HCSF qui compte 70 % des loyers), frais bancaires payés comptant ou financés ; constantes lues dans les règles (taux moyens, usure, seuil HCSF)

Scénario : page introuvable inchangée
  Alors /simulateur-pret/autre affiche la page « Page introuvable » comme avant
```

## MoSCoW

| Story | Priorité | Effort | Dépend de  |
| ----- | -------- | ------ | ---------- |
| US-1  | Must     | M      | —          |
| US-2  | Must     | S      | US-1       |
| US-3  | Must     | L      | US-1       |
| US-4  | Must     | S      | US-2, US-3 |
| US-5  | Must     | M      | US-3       |
| US-6  | Must     | S      | US-5       |
| US-7  | Should   | M      | US-3       |
| US-8  | Should   | S      | US-3       |

Effort total : **XL** (deux à cinq jours de session), à livrer en deux PR au plus : E1 + E2 (US-1 à US-5), puis E3 (US-6 à US-8), ou tout en une si la session tient.

Pourrait (Could, hors de cette feature) : « Copier le tableau » dans le presse-papiers, date de première échéance et colonne date, capacité d'emprunt, XLSX, trois offres.

## Contrat du lien `#s=`

```
/simulateur-pret#s=<base64url(JSON de SimulationPretEntree)>
JSON : { "versionRegles"?: "2026-09", "projet": { "prix": 150000, "honorairesAgence"?: 0, "travaux"?: 0, "fraisNotaire": 12000, "departement"?: "13", "revenusMensuels"?: 2400 },
         "offres": [ { "nom"?: "LCL", "apport"?: 15000, "fraisDossier"?: 800, "fraisGarantie"?: 2000, "fraisBancairesFinances"?: false, "tauxNominal": 0.033, "tauxAssurance"?: 0.0037, "dureeAnnees": 25, "differeTotalMois"?: 0, "differePartielMois"?: 0 } ] }
```

Taux en décimal (comme partout dans le moteur), montants en euros. `fraisNotaire` est obligatoire dans le schéma ; le lien de pré-remplissage d'un projet le fournira (`fraisAcquisition(...).total`). Une seule offre suffit.
