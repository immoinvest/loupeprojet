# Specs : estimation-confiance

Discovery : `../features/estimation-confiance-discovery.md`. Périmètre de la PR 1 : `packages/moteur` (estimation, règles, schémas), `data` (index DVF), `apps/worker` (`/marche`, `/marche/adresse`), `apps/web` (onglet Estimation, Rapport, Méthode, enrichissement). La PR 2 (carte) est décrite dans l'épopée E3, à spécifier en détail quand Pierre a tranché le fond de carte.

Projet d'exemple : T3 65 m², Marseille 5e, 155 000 €, repère `{ medianM2: 3050, q1M2: 2700, q3M2: 3400, nombreVentes: 31, rayonMetres: 500 }` (sans précision ni ancienneté : rayon → quartier au-delà de 300 m, ancienneté supposée 12 mois).

---

## Épopée E1 : la note de confiance

### US-1 : Note de confiance calculée par le moteur

En tant que Camille,
je veux que l'estimation porte une note de confiance sur 100 expliquée par ses composantes,
afin de savoir à quel point m'y fier avant de négocier.

Priorité : P0 · Effort : M

```gherkin
Scénario: repère de commune, prix dispersés (cas de Pierre)
  Étant donné un repère { medianM2: 3423, q1M2: 2833, q3M2: 4135, nombreVentes: 1823, precision: 'commune', ancienneteMedianeMois: 12 }
  Quand le moteur calcule la confiance
  Alors la note est 41 et le niveau « faible »
  Et les composantes valent localisation 4/35, comparables 20/20, dispersion 6/30, ancienneté 11/15

Scénario: adresse précise, ventes proches, resserrées et récentes (cas de Pierre)
  Étant donné un repère { medianM2: 3600, q1M2: 3384, q3M2: 3816, nombreVentes: 15, rayonMetres: 90, precision: 'quartier', ancienneteMedianeMois: 8 }
  Alors la note est 82 et le niveau « élevée »

Scénario: même immeuble
  Étant donné un repère de précision « immeuble », 6 ventes, quartiles à ± 5 %, vieilles de 4 mois
  Alors localisation vaut 35/35 et le niveau est « élevée »

Scénario: rue étendue (demande de Pierre, 14/09/2026)
  Étant donné un repère de précision « rue » dont les ventes s'étendent sur 531 m
  Alors la localisation vaut les points du quartier pour 531 m, 12/35, et non 30/35
  Et jusqu'à 150 m, la rue garde ses 30 points

Scénario: paliers interpolés et bornés
  Étant donné le barème des comparables (3 → 0, 10 → 12, 30 → 20)
  Alors 2 ventes donnent 0, 5 ventes 3, 20 ventes 16, 50 ventes 20

Scénario: précision déduite et ancienneté supposée (projet enregistré avant la feature)
  Étant donné un repère sans « precision » ni « ancienneteMedianeMois », avec rayonMetres 500
  Alors la précision retenue est « quartier », la localisation vaut 12/35
  Et l'ancienneté vaut 12 mois, marquée « supposée »
  Étant donné un repère sans rayon
  Alors la précision retenue est « commune »

Scénario: sans quartiles
  Étant donné un repère { medianM2: 3000, nombreVentes: 40 } saisi à la main
  Alors la dispersion est inconnue (valeur null) et vaut 0 point

Scénario: la fourchette suit le niveau
  Étant donné les marges élevée 5 %, bonne 6,5 %, moyenne 8 %, faible 12 %, très faible 15 %
  Quand l'estimation est calculée
  Alors bas = centre × (1 − marge du niveau) et haut = centre × (1 + marge du niveau)

Scénario: résultats validés par le schéma
  Alors Resultats.estimation.confiance est { note, niveau, precision, composantes[4] } et passe ResultatsSchema
  Et les maxima des quatre composantes des règles font 100
```

### US-2 : Données d'ancienneté et de période dans les référentiels et le Worker

En tant que Deklic,
je veux connaître l'ancienneté médiane et la période des ventes du repère,
afin de noter la fraîcheur des données.

Priorité : P0 · Effort : M

```gherkin
Scénario: index DVF avec la date médiane
  Étant donné 5 ventes d'appartements d'une commune datées 2024-01-01, 2025-01-09, 2025-01-13, 2025-06-15, 2025-12-31
  Quand l'index du département est écrit
  Alors la commune porte dateMediane « 2025-01-13 » (vente médiane ; pour un nombre pair, la plus ancienne des deux centrales)

Scénario: GET /marche avec l'ancienneté
  Étant donné l'index publié avec dateMediane « 2025-01-13 » et l'horloge au 13/09/2026
  Quand je demande /marche?codeInsee=13055&codePostal=13005
  Alors dvf porte dateMediane « 2025-01-13 » et ancienneteMedianeMois 20
  Et la réponse en cache dépend de la version 2 du contrat

Scénario: index publié sans date médiane
  Étant donné un index sans dateMediane, fenêtre 2024-01-01 → 2025-12-31, horloge au 13/09/2026
  Alors dateMediane est null et ancienneteMedianeMois vaut 20 (milieu de la fenêtre, 2025-01-01)

Scénario: GET /marche/adresse avec la période du repère
  Étant donné un repère « même côté de la rue » de 6 comparables datés entre 2024-03-01 et 2025-07-15
  Alors reference porte periode { debut: '2024-03-01', fin: '2025-07-15' }, dateMediane et ancienneteMedianeMois
  Et chaque groupe porte dateMediane et periode (null sans comparable)
  Et la clé de cache dépend de la version 4 du contrat
```

### US-3 : Le web enregistre les nouveaux champs du repère

En tant que Camille,
je veux que le repère de mon projet garde d'où il vient, sa période et son ancienneté,
afin que la note soit juste, projet rouvert ou non.

Priorité : P0 · Effort : S

```gherkin
Scénario: création du projet (GET /marche)
  Étant donné une réponse /marche { commune: 'Marseille 5e Arrondissement', dvf: { ventes: 1823, …, fenetre, dateMediane, ancienneteMedianeMois: 20 } }
  Quand le projet est construit
  Alors marche.dvf vaut { medianM2, q1M2, q3M2, nombreVentes, precision: 'commune', lieu: 'Marseille 5e Arrondissement', periode: fenetre, ancienneteMedianeMois: 20 }
  Et la provenance de marche.dvf.ancienneteMedianeMois est « dvf »

Scénario: ancien Worker (réponse sans les champs)
  Étant donné une réponse /marche sans fenetre ni ancienneteMedianeMois
  Alors marche.dvf porte precision « commune » et le lieu, sans période ni ancienneté

Scénario: « Utiliser ce repère pour l'estimation »
  Étant donné une référence « meme_cote » avec periode et ancienneteMedianeMois 9
  Quand je clique sur « Utiliser ce repère pour l'estimation »
  Alors marche.dvf porte precision « rue », rayonMetres, periode et ancienneteMedianeMois 9, sans lieu
  Et « meme_parcelle » ou « parcelles_voisines » donnent « immeuble », « rayon_100 » à « rayon_300 » donnent « quartier »
```

---

## Épopée E2 : ce que l'onglet montre

### US-4 : Carte « Confiance » en tête de l'onglet Estimation

En tant que Camille,
je veux voir d'abord si je peux me fier à l'estimation et pourquoi,
afin de lire le reste avec le bon recul.

Priorité : P0 · Effort : M

```gherkin
Scénario: repère de commune (projet d'exemple avec adresse absente)
  Étant donné le projet d'exemple ouvert sur l'onglet Estimation
  Alors la première carte sous le titre s'intitule « Peut-on se fier à cette estimation ? »
  Et elle affiche une pastille « Confiance moyenne » et « 62 sur 100 » (repère du projet d'exemple : quartier à 500 m, 31 ventes, dispersion 23 %, ancienneté supposée)
  Et une liste de quatre raisons, chacune avec ses points, par exemple « Repère à l'échelle du quartier, à 500 m au plus · 12/35 »
  Et la raison d'ancienneté dit qu'elle est supposée
  Et une phrase invite à indiquer l'adresse du bien

Scénario: après l'analyse d'une adresse et le clic sur « Utiliser ce repère »
  Étant donné l'analyse du 144 rue de l'Olivier (repère même côté, 6 ventes, période connue, ancienneté 9 mois)
  Quand je clique sur « Utiliser ce repère pour l'estimation »
  Alors la carte Confiance se met à jour (« Ventes de la même rue, à 90 m au plus · 30/35 », « 6 ventes comparables », « ventes vieilles de 9 mois en médiane »)
  Et l'invitation à indiquer l'adresse disparaît

Scénario: sans repère
  Étant donné un projet sans marche.dvf
  Alors la carte dit qu'il n'y a pas encore de repère de prix et renvoie au code postal ou à l'adresse

Scénario: téléphone
  Étant donné un format de 375 px
  Alors la carte ne déborde pas ; les raisons passent à la ligne
```

### US-5 : Carte « Le repère utilisé » sans adresse

En tant que Camille,
je veux voir les chiffres qui ont servi à l'estimation même sans adresse,
afin de savoir d'où sort le prix estimé.

Priorité : P0 · Effort : S

```gherkin
Scénario: repère de commune posé à la création
  Étant donné un projet dont marche.dvf vient de /marche (lieu « Marseille 5e Arrondissement », période 2024-01 → 2025-12)
  Et aucune adresse analysée
  Alors sous le formulaire d'adresse, une carte « Le repère utilisé » affiche :
    « Appartements vendus à Marseille 5e Arrondissement : 1 823 ventes entre janvier 2024 et décembre 2025 »
    la médiane, la moitié des ventes entre q1 et q3
    une pastille « Moins précis : repère de commune »
    la provenance (« donnée publique »)

Scénario: repère saisi à la main
  Étant donné marche.dvf modifié dans Hypothèses (provenance « utilisateur »)
  Alors la carte montre la provenance « à toi », sans lieu ni période

Scénario: adresse analysée
  Étant donné une adresse analysée avec succès
  Alors la carte « Le repère utilisé » n'est pas affichée (la carte « Le repère de prix » la remplace)

Scénario: impression
  Étant donné le mode document
  Alors les cartes Confiance et Repère s'impriment comme le reste de l'onglet, sans bouton
```

### US-6 : Rapport et Méthode

En tant que Camille,
je veux retrouver la confiance dans le rapport et son mode d'emploi dans la Méthode,
afin de comprendre la fourchette où qu'elle apparaisse.

Priorité : P1 · Effort : S

```gherkin
Scénario: carte « Est-ce que c'est cher ? »
  Étant donné le projet d'exemple
  Alors la carte écrit « Estimé entre 190 000 € et 223 000 € · confiance moyenne (62/100). »

Scénario: Méthode
  Étant donné la page Méthode, section « L'estimation du prix »
  Alors une étape explique la note sur 100 et ses quatre composantes avec leurs maxima
  Et les constantes listent les barèmes de localisation, de comparables, de dispersion, d'ancienneté, les seuils des niveaux et les cinq marges, source « Choix Deklic »
```

---

## Épopée E3 : la carte des ventes (PR 2, à détailler)

### US-7 : Ventes géolocalisées dans `/marche/adresse`

Contrat v5 : `ventesCarte` = toutes les ventes comparables situées à 300 m ou moins et portant des coordonnées (plafond 300, les plus proches d'abord) avec `lat`, `lon`, `prixM2Actualise`, `date`, `surface`, `groupes`. `ventesProches` inchangé.

### US-8 : Composant `CarteVentes`

Leaflet en dépendance npm chargée à la demande (`React.lazy`), tuiles IGN Plan (Géoplateforme, sans clé), points colorés par prix au m² (sous q1, entre q1 et q3, au-dessus de q3), bien au centre, cercles 100/200/300 m, survol et focus clavier = prix, surface, date ; carte masquée à l'impression (les tableaux restent) ; téléphone : hauteur 280 px, gestes de carte sans bloquer le défilement de la page ; mention « les tuiles de carte sont chargées depuis l'IGN » dans la page Méthode (aucune page Vie privée n'existe encore) ; ajout à `ecransDeReference`.

---

## Contrats

### `GET /marche` (v2)

`dvf` : `{ ventes, medianeM2, q1M2, q3M2, type, fenetre: { debut, fin }, millesime, codeInsee, dateMediane: string | null, ancienneteMedianeMois: number }`.

### `GET /marche/adresse` (v4)

`groupes[]` : `+ dateMediane: string | null`, `+ periode: { debut, fin } | null`. `reference` : `+ dateMediane`, `+ periode`, `+ ancienneteMedianeMois: number` (calculée à la date de la réponse).

### Moteur

- `DvfSchema` : `+ precision?: 'immeuble' | 'rue' | 'quartier' | 'commune'`, `+ ancienneteMedianeMois?: entier ≥ 0`, `+ periode?: { debut: AAAA-MM-JJ, fin: AAAA-MM-JJ }`, `+ lieu?: texte (1 à 120 caractères)`.
- `confianceEstimation(dvf, regles) → { note, niveau, precision, composantes: [{ code, valeur, points, maximum, supposee }] }` ; `EstimationPrix.confiance` devient cet objet ; `niveauConfiance` disparaît.
- Règles `estimation.confiance` : `localisation`, `comparables`, `dispersion`, `anciennete`, `ancienneteSupposeeMois`, `niveaux` ; `estimation.marges` à cinq niveaux.

## MoSCoW

- Must : US-1, US-2, US-3, US-4, US-5.
- Should : US-6.
- Could (PR 2) : US-7, US-8.
- Won't : liens vers d'autres estimateurs, geste « Analyser à la commune », pondération par surface.
