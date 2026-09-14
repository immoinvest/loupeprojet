# Discovery — estimation-confiance

Date : 2026-09-14. Fiche de backlog : `.product/backlog/09-estimation-carte-confiance.md`. Demande de Pierre :

> « Pour Estimation, lorsqu'on met l'adresse d'un bien, on a pas mal de statistiques. J'aimerais une carte qui montre aussi, sur le quartier, les ventes aux alentours. Ensuite, lorsque l'adresse n'est pas renseignée, mettre tout de même les chiffres qui ont été utilisés, même s'ils sont moins précis. Enfin, un indice de confiance sur l'estimation : sans adresse il sera probablement bas, surtout s'il y a de grandes différences de prix dans le quartier ; avec une adresse et plein de ventes à peu près pareilles, récentes, il sera haut. Indiquer cet indice tôt dans l'onglet. »

## Découpage : deux PR

1. **PR 1 — confiance expliquée et repère visible** (ce document, implémentée en premier) : note de confiance sur 100 avec ses composantes, en tête de l'onglet Estimation ; carte « Le repère utilisé » quand l'adresse n'est pas connue ; Rapport et Méthode reprennent la confiance.
2. **PR 2 — carte géographique des ventes** : le bien au centre, les ventes en points colorés par prix au m², cercles de 100, 200 et 300 m, survol. Dépend d'une décision de Pierre (fond de carte).

## Vérification préalable : les coordonnées des ventes

Le CSV publié `dvf/<millésime>/<codeInsee>.csv` porte déjà `lat` et `lon` pour chaque vente (colonnes 6 et 7, `data/src/schemas/dvf.ts`, source DVF géolocalisé d'Etalab), vides quand la parcelle n'est pas géocodée. **Aucune republication n'est nécessaire pour la carte** : il suffit que `/marche/adresse` renvoie les coordonnées des ventes (PR 2, contrat v5). Le Worker les lit déjà pour calculer les distances.

## Ce que l'utilisateur obtient (PR 1)

- **En tête de l'onglet Estimation**, avant le formulaire : « Confiance bonne · 72 sur 100 », puis les quatre raisons en clair, chacune avec ses points :
  - _localisation_ : « ventes du même immeuble » / « de la même rue » / « à moins de 200 m » / « repère à l'échelle de la commune » ;
  - _comparables_ : « 18 ventes comparables » ;
  - _dispersion_ : « prix resserrés : la moitié des ventes à ± 9 % de la médiane » ou « prix très dispersés (± 38 %) » ;
  - _ancienneté_ : « ventes vieilles de 8 mois en médiane » (ou « ancienneté supposée : fenêtre de deux ans » pour un repère sans date connue).
  - Sans adresse : « Indiquez l'adresse du bien pour affiner. »
- **Sans adresse**, sous le formulaire, la carte **« Le repère utilisé »** : « Appartements vendus à Marseille 5e Arrondissement : 1 823 ventes entre janvier 2024 et décembre 2025, médiane 3 423 €/m², la moitié des ventes entre 2 833 et 4 135 €/m² », badge de provenance (« donnée publique » ou « à toi ») et mention « Moins précis : repère de commune ». Le repère est celui posé à la création du projet (`GET /marche`) ou saisi dans Hypothèses. Sans repère du tout, la carte le dit et renvoie au code postal ou à l'adresse.
- **La fourchette d'estimation suit la note** : cinq niveaux, de ± 5 % (élevée) à ± 15 % (très faible), au lieu de trois.
- **Le Rapport** (carte « Est-ce que c'est cher ? ») écrit « Estimé entre … et … · confiance bonne (72/100) ».
- **La Méthode** explique la note : composantes, barèmes, niveaux, largeur de la fourchette, tout lu dans les règles datées.

## Règle de la note (choix Deklic, datée 14/09/2026, `regles/2026-09.ts`)

Note sur 100 = somme de quatre composantes. Barèmes en paliers, interpolés linéairement entre deux paliers, bornés au premier et au dernier :

| Composante                                 | Maximum | Barème                                                                                                                       |
| ------------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Localisation du repère                     | 35      | même immeuble ou parcelles voisines 35 · même rue 30 · quartier : ≤ 100 m 26, ≤ 200 m 22, ≤ 300 m 18, au-delà 12 · commune 4 |
| Nombre de ventes comparables               | 20      | 3 ventes ou moins 0 · 10 ventes 12 · 30 ventes ou plus 20                                                                    |
| Dispersion (écart interquartile ÷ médiane) | 30      | 10 % ou moins 30 · 45 % ou plus 0                                                                                            |
| Ancienneté médiane des ventes              | 15      | 6 mois ou moins 15 · 30 mois ou plus 0 ; inconnue : 12 mois supposés (milieu de la fenêtre de deux ans), signalé             |

Niveaux : élevée ≥ 80 · bonne ≥ 65 · moyenne ≥ 45 · faible ≥ 25 · très faible en dessous. Marges de la fourchette : ± 5 % · ± 6,5 % · ± 8 % · ± 12 % · ± 15 %.

Cas de Pierre, vérifiés dans les tests du moteur :

- sans adresse, arrondissement dispersé (Marseille 5e : 1 823 ventes, quartiles 2 833 et 4 135 pour une médiane de 3 423, soit 38 %) : 4 + 20 + 6 + 11 = **41, faible** ;
- adresse, 15 ventes à moins de 100 m, quartiles à ± 6 % de la médiane, vieilles de 8 mois : 26 + 14 + 28 + 14 = **82, élevée** ;
- même immeuble, 6 ventes resserrées récentes : 35 + 5 + 30 + 15 = **85, élevée** ; sans quartiles connus (repère saisi à la main) : dispersion 0, très faible ou faible selon le reste.

## Données nécessaires

| Où                                | Aujourd'hui                                                                | Ajout                                                                                                                                                                                                                                                                                              |
| --------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `marche.dvf` (moteur)             | `medianM2`, `q1M2`, `q3M2`, `nombreVentes`, `rayonMetres?`, `actualiseAu?` | `precision?` (immeuble, rue, quartier, commune), `ancienneteMedianeMois?`, `periode?` (début, fin), `lieu?` (nom de la commune ou de l'arrondissement) ; tous optionnels : les projets enregistrés restent valides, la précision manquante se déduit du rayon, l'ancienneté manquante est supposée |
| `dvf/<m>/index/<dep>.json` (data) | ventes, médiane, quartiles par commune et type                             | `dateMediane` (date de la vente médiane) ; optionnelle à la lecture (index publiés avant)                                                                                                                                                                                                          |
| `GET /marche` (worker)            | `dvf.{ventes, medianeM2, q1M2, q3M2, fenetre, millesime, codeInsee}`       | `dvf.dateMediane`, `dvf.ancienneteMedianeMois` (calculée à la date de la réponse ; sans date médiane, milieu de la fenêtre) ; contrat v2                                                                                                                                                           |
| `GET /marche/adresse`             | `reference.{code, rayonMetres, statistiques}`                              | `reference.{dateMediane, periode, ancienneteMedianeMois}` (sur les comparables du groupe repère) ; contrat v4                                                                                                                                                                                      |

La dispersion se calcule dans le moteur à partir des quartiles déjà présents. Aucun modèle de langage, aucun nouvel appel réseau, aucun coût.

## Hors périmètre

- La carte géographique (PR 2) et la mention de vie privée qui va avec.
- « Analyser à la commune » comme geste séparé : le repère de commune est déjà posé à la création ; on le montre.
- Liens vers d'autres estimateurs (question 6 de la fiche) : à trancher par Pierre, hors de cette feature.
- Pondération par le type et la surface des ventes : les comparables sont déjà filtrés (même type, surface à ± 40 %).

## Questions posées à Pierre (réponses attendues, hypothèses retenues en attendant)

1. Fond de carte de la PR 2 : **IGN Géoplateforme** (recommandé) ou carte schématique sans tiers.
2. Indice : **note 0-100 en mots avec composantes** (recommandé, retenu ici) ou trois niveaux.

## Risques

- **Les projets enregistrés** portent un `marche.dvf` sans les nouveaux champs : la note est calculée avec une précision déduite et une ancienneté supposée, et l'onglet le dit. Rouvrir l'onglet Estimation avec une adresse remet tout à jour.
- **Décalage web / Worker** : le site est déployé au merge, le Worker à la main ensuite ; les nouveaux champs sont optionnels dans le contrat lu par le web, qui se contente de l'ancien Worker (ancienneté supposée).
- **Index DVF non republié** : sans `dateMediane`, le Worker prend le milieu de la fenêtre de 24 mois ; l'Action « Référentiels » (DVF, département 13) est relancée après la fusion.
- **Une note reste un choix** : les barèmes sont des choix Deklic, datés, affichés dans la Méthode, et chaque composante est expliquée en clair (principe métier n° 7).
