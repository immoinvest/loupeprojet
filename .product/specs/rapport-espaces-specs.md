# Specs — rapport-espaces

Épic : un Rapport plus serré, sans perte d'information.

## US-1 — Lien de l'annonce à droite du titre (Must)

```gherkin
Scénario : projet créé depuis une annonce d'un portail
  Étant donné un projet dont l'annonce a des photos ou des caractéristiques et une adresse https d'un portail
  Quand j'ouvre le Rapport
  Alors « Voir l'annonce sur <portail> » est sur la ligne du titre « Le bien », à droite
  Et il n'y a plus de ligne dédiée au lien sous les pastilles
  Et le lien s'ouvre dans un nouvel onglet, sans référent
Scénario : lien non sûr
  Étant donné une adresse d'annonce en http ou hors portail
  Alors aucun lien n'est affiché
```

## US-2 — Prix sans la phrase du prix bas (Must)

```gherkin
Scénario : prix jugé bon
  Étant donné un projet dont le feu prix est vert
  Quand j'ouvre le Rapport
  Alors la carte « Est-ce que c'est cher ? » ne contient plus « Un prix aussi bas se vérifie en visite »
  Et la fourchette estimée et « Voir l'estimation » restent
```

La question du vendeur qui baisse reste dans la liste de visite (questions de la catégorie vendeur).

## US-3 — Rendements et points d'offre empilés à côté du prix (Must)

```gherkin
Scénario : tablette, ordinateur et papier (≥ 768 px)
  Quand j'ouvre le Rapport
  Alors « Combien ça rapporte ? » et « Avant de faire une offre » sont l'un sous l'autre dans la colonne de droite
  Et le bas de « Avant de faire une offre » est aligné sur le bas de « Est-ce que c'est cher ? »
  Et le lien vers la visite est en bas de sa carte
  Et il n'y a plus de rangée pleine largeur pour « Avant de faire une offre »
Scénario : téléphone
  Alors les cartes s'empilent : prix, rendements, avant de faire une offre, leviers, impôts, revente
Scénario : analyse sans loyer
  Alors « Combien ça rapporte ? » (à compléter) et « Avant de faire une offre » sont empilés de la même façon
```

## Hors périmètre (Won't)

Contenu des cartes Impôts et Revente, photos de « Le bien », cascade de l'autofinancement.
