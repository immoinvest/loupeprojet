# Specs : carte-interactive

Discovery : `../features/carte-interactive-discovery.md`. Données de test : 144 rue de l'Olivier (Marseille 5e), ventes simulées autour du bien.

---

## Épopée A : se déplacer sur la carte

### US-1 : gestes, plein écran, recentrer

En tant que Camille, je veux zoomer et déplacer la carte facilement sans qu'elle bloque le défilement de la page.

Priorité : P0 · Effort : M

```gherkin
Scénario: molette sans Ctrl sur ordinateur
  Quand je fais tourner la molette au-dessus de la carte sans Ctrl
  Alors la page défile, la carte ne zoome pas
  Et le message « Ctrl + molette pour zoomer » apparaît puis s'efface

Scénario: Ctrl + molette
  Quand je fais tourner la molette avec Ctrl (ou ⌘)
  Alors la carte zoome et aucun message n'apparaît

Scénario: un doigt au téléphone
  Quand je glisse un doigt sur la carte
  Alors la page défile
  Et le message « Utilisez deux doigts pour déplacer la carte » apparaît

Scénario: plein écran
  Quand je clique « Plein écran »
  Alors la carte couvre toute la fenêtre, un bouton « Fermer la carte » a le focus
  Et molette et glisser à un doigt déplacent la carte sans message
  Quand j'appuie sur Échap
  Alors la carte reprend sa place et « Plein écran » retrouve le focus

Scénario: recentrer
  Quand je clique « Recentrer sur le bien »
  Alors la carte revient au cadrage du cercle de 300 m
```

### US-2 : fonds de carte et couleur des pastilles

Priorité : P1 · Effort : S

```gherkin
Scénario: fonds
  Étant donné le fond « Plan IGN » choisi par défaut
  Quand je choisis « Photo aérienne »
  Alors les tuiles ORTHOIMAGERY.ORTHOPHOTOS remplacent le plan
  Quand je coche « Parcelles cadastrales »
  Alors les tuiles CADASTRALPARCELS.PARCELLAIRE_EXPRESS s'ajoutent par-dessus

Scénario: couleur par prix, ancienneté ou DPE
  Étant donné la couleur « Prix au m² » par défaut et sa légende en trois tranches
  Quand je choisis « Ancienneté »
  Alors la légende devient « Moins d'un an », « 1 à 3 ans », « Plus de 3 ans »
  Quand je choisis « DPE »
  Alors la légende devient « DPE A à C », « DPE D ou E », « DPE F ou G », « DPE inconnu »

Scénario: DPE absent
  Étant donné aucune vente avec un DPE
  Alors le choix « DPE » n'est pas proposé
```

## Épopée B : voir les ventes

### US-3 : bulle d'une vente et regroupement

Priorité : P0 · Effort : M

```gherkin
Scénario: clic sur une pastille
  Quand je clique une vente
  Alors une bulle montre date, prix, surface (et Carrez), pièces, prix au m², prix d'aujourd'hui, distance, place, DPE et dépendances s'ils sont connus
  Et un bouton « Voir dans le tableau »
  Et une case vide n'apparaît jamais (ligne absente quand l'information manque)

Scénario: ventes au même point
  Étant donné trois ventes aux mêmes coordonnées
  Alors une seule pastille affiche « 3 »
  Quand je la clique
  Alors les trois ventes s'ouvrent en éventail autour du point
```

### US-4 : carte et tableau liés

Priorité : P0 · Effort : M

```gherkin
Scénario: de la carte au tableau
  Quand je clique « Voir dans le tableau » dans une bulle
  Alors le tableau passe à la page de cette vente (en retirant les filtres qui la cachaient)
  Et la ligne est mise en avant et amenée à l'écran

Scénario: du tableau à la carte
  Quand je clique « Voir sur la carte » dans une ligne
  Alors la carte vient à l'écran, se centre sur la vente et ouvre sa bulle
  Et la vente est mise en avant des deux côtés

Scénario: filtres appliqués aux pastilles
  Quand j'active le filtre « Même immeuble » du tableau
  Alors seules les pastilles des ventes filtrées restent

Scénario: clic sur un cercle
  Quand je clique le cercle de 100 m
  Alors le filtre « À moins de 100 m » du tableau s'active
  Quand je le clique encore
  Alors le filtre se retire

Scénario: nouvelle analyse
  Quand l'analyse change
  Alors sélection, filtres et rayon reviennent à zéro
```

### US-5 : accessibilité et impression

Priorité : P0 · Effort : S

```gherkin
Scénario: rôle de la carte
  Alors la carte a role="region" et le nom « Carte des ventes comparables autour du bien : N points. »
  Et les boutons de la carte ont un nom, des cibles de 44 px au doigt
  Et Échap ferme la bulle ouverte

Scénario: impression
  Alors la carte et ses boutons ne sont pas imprimés ; le tableau l'est
```

## Priorités (MoSCoW)

- Must : US-1, US-3, US-4, US-5.
- Should : US-2.

## Auto-revue critique

- Chaque scénario est vérifiable : pur en Vitest (messages, couleurs, groupes, liaison, fiche), écran en Vitest avec Leaflet simulé, gestes réels et tuiles en Playwright.
- « Échap ferme la bulle puis le plein écran » : un premier Échap ferme la bulle si elle est ouverte, le suivant ferme le plein écran. Précisé dans l'architecture.
- Validé : cinq stories, on passe à l'architecture.
