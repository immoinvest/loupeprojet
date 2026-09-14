# Specs — vendu-loue

Discovery : `.product/features/vendu-loue-discovery.md`. Quatre stories, toutes **Must**.

## US-1 — Moteur : décote « vendu loué » dans l'estimation (moteur)

En tant que Camille, je veux que l'estimation d'un bien vendu loué tienne compte de la décote d'occupation, pour que le feu prix ne juge pas un prix loué comme un prix libre.

```gherkin
Scénario : bien vendu loué
  Étant donné un projet dont bien.venduLoue vaut true et des ventes DVF
  Quand le moteur estime le prix
  Alors les corrections contiennent { code: "occupation", taux: -0.10 }
  Et le centre de l'estimation vaut le prix de marché × (1 + somme des taux) + effet des charges

Scénario : bien libre ou inconnu
  Étant donné bien.venduLoue false ou absent
  Alors aucune correction "occupation"

Scénario : correction ignorée
  Étant donné estimation.correctionsIgnorees contient "occupation"
  Alors la correction est listée avec ignoree: true et sans effet sur le centre

Scénario : anciens projets
  Étant donné un projet enregistré sans venduLoue
  Alors il se lit sans migration et s'estime comme avant
```

Contrat : `BienSchema.venduLoue?: boolean` ; `CodeCorrection` += `occupation` (schéma d'entrée et `EstimationResultatSchema`) ; `Regles.estimation.occupation: number` ; `aConfirmer` += `estimation.occupation` ; `tauxOccupation(bien, regles)` exportée.

## US-2 — Lecture de l'annonce (web)

```gherkin
Scénario : règles
  Quand le texte contient « vendu loué », « vente occupée », « locataire en place », « bail en cours » ou « actuellement loué »
  Alors extraireChamps renvoie venduLoue: true
  Quand il contient « vendu libre », « libre à la vente », « libre de toute occupation » ou « libre de tout occupant »
  Alors venduLoue: false (la mention libre l'emporte)
  Quand il ne dit rien (« idéal investisseur », « possibilité de louer »)
  Alors venduLoue est absent

Scénario : IA
  Étant donné une réponse /extract avec loyerActuel > 0
  Alors venduLoue vaut true, sauf si les règles ont lu une mention « libre » (false l'emporte)
  Étant donné loyerActuel null ou absent (anciennes réponses en cache)
  Alors la valeur des règles est gardée
```

## US-3 — Saisie : Vérifier et Hypothèses (web)

```gherkin
Scénario : formulaire Vérifier
  Étant donné une annonce lue avec venduLoue: true
  Alors le champ « Vendu loué » affiche « oui » avec le badge « annonce »
  Et le projet créé porte bien.venduLoue = true et la provenance bien.venduLoue = annonce
  Étant donné le champ laissé vide
  Alors le projet ne porte pas venduLoue

Scénario : Hypothèses
  Alors la carte « Le bien » propose « Vendu loué » oui / non, enregistré par appliquerSaisie
```

## US-4 — Textes : Estimation, Méthode, Rapport (web)

```gherkin
Scénario : onglet Estimation
  Alors la ligne « Vendu loué » affiche sa raison, sa source et la case « Compter »
  Et la phrase « aucune correction » cite le fait d'être vendu loué

Scénario : Méthode
  Alors la section Estimation liste la constante « Vendu loué −10 % » avec sa source, marquée à confirmer
  Et le nombre de constantes à confirmer passe de 18 à 19

Scénario : Rapport
  Alors l'explication du prix cite la location en cours parmi les ajustements
```
