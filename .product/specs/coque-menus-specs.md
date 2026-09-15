# Specs : coque-menus — « Mes projets · N [+] » et menu du statut

Discovery : `../features/coque-menus-discovery.md`. Web seul.

## US-1 : Une seule ligne « Mes projets · N [+] » (P0, S)

En tant que Camille, je veux ouvrir mes projets ou en créer un depuis la même ligne du menu, afin d'avoir un menu plus court.

```gherkin
Scénario: la ligne en tête de la section Analyser
  Étant donné 7 projets enregistrés
  Quand j'ouvre le menu
  Alors le premier lien de la section « Analyser » s'appelle « Mes projets · 7 » et mène à /projets
  Et le lien suivant s'appelle « Nouveau projet », affiche un « + » et mène à /projets/nouveau
  Et viennent ensuite les trois projets les plus récents
  Et il n'y a plus de lien « Tous mes projets »

Scénario: aucun projet
  Étant donné aucun projet enregistré
  Alors la ligne affiche « Mes projets · 0 » et son « + »

Scénario: états actifs séparés
  Quand je suis sur /projets
  Alors « Mes projets » porte aria-current="page" et la ligne entière est surlignée
  Quand je suis sur /projets/nouveau
  Alors seul le « + » porte aria-current="page", en accent plein

Scénario: cibles
  Alors le « + » mesure au moins 44 × 44 px et porte l'infobulle « Nouveau projet »
  Et la ligne s'affiche aussi dans le tiroir sous 1 024 px
```

## US-2 : Composant de liste de choix accessible `MenuChoix` (P0, M)

En tant que personne au clavier ou au lecteur d'écran, je veux une liste de choix aussi utilisable qu'une liste native.

```gherkin
Scénario: ouverture
  Étant donné le bouton fermé (aria-haspopup="listbox", aria-expanded="false")
  Quand je clique, ou j'appuie sur Entrée, Espace, flèche bas ou flèche haut
  Alors la liste (role="listbox") s'ouvre, reçoit le focus, et l'option active est l'option choisie

Scénario: clavier dans la liste
  Quand j'appuie sur flèche bas / haut, Début, Fin
  Alors l'option active (aria-activedescendant) change, sans boucler
  Quand je tape une lettre
  Alors l'option active est la suivante dont le libellé commence par cette lettre (accents ignorés)
  Quand j'appuie sur Entrée ou Espace
  Alors l'option active est choisie, la liste se ferme et le focus revient au bouton
  Quand j'appuie sur Échap
  Alors la liste se ferme sans changer le choix et le focus revient au bouton
  Quand j'appuie sur Tab
  Alors la liste se ferme

Scénario: souris
  Quand je clique une option
  Alors elle est choisie et la liste se ferme
  Quand je clique en dehors
  Alors la liste se ferme sans rien choisir
  Quand je choisis l'option déjà choisie
  Alors rien n'est enregistré

Scénario: placement
  Alors la liste s'ouvre sous le bouton, au-dessus s'il manque la place dessous et qu'il y en a plus dessus
  Et sous 640 px elle monte du bas de l'écran, sur un voile, avec des options de 48 px
```

## US-3 : Le statut du projet dans cette liste (P0, S)

```gherkin
Scénario: ordre et précisions
  Quand j'ouvre « Statut du projet »
  Alors les options sont, dans l'ordre : En analyse, Visite prévue, Offre faite, Acheté
  Et, après un séparateur : Scénario « pour comparer », Écarté « on n'y va pas »
  Et chaque option montre le point de couleur de son statut, l'option actuelle porte une coche et aria-selected="true"

Scénario: changer le statut
  Quand je choisis « Offre faite »
  Alors le projet est enregistré avec le statut offre, la pastille affiche « Offre faite » dans sa couleur
  Et « Acheté » ouvre toujours la porte de Gérer quand elle est disponible

Scénario: impression et animation
  Alors à l'impression la pastille n'a pas de chevron
  Et l'apparition de la liste (100 ms) est coupée quand le système réduit les animations
```

## US-4 : « Mes biens · N [+] » dans Gérer (P1, S)

Bloquée au départ (page « Mes biens » absente), livrée après la fusion de G1c (PR #80) pendant la même nuit.

```gherkin
Scénario: la ligne en tête de la section Gérer, compte connecté
  Étant donné un compte qui gère 2 biens
  Alors le premier lien de « Gérer » s'appelle « Mes biens · 2 » et mène à /gerer/biens
  Et le suivant s'appelle « Ajouter un bien », porte l'infobulle « Ajouter un bien » et mène à /gerer/ajouter
  Quand j'ouvre la fiche d'un bien
  Alors la ligne « Mes biens » reste surlignée et le « + » n'est pas actif
```

## Auto-revue

Critères vérifiables par des tests (rôles, attributs ARIA, clavier). Risque d'oubli : Tab dans la liste et le choix identique → ajoutés. US-4 explicitement bloquée plutôt que livrée à moitié.
