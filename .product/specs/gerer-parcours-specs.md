# Specs : Gérer, pages reliées (G1d)

**Discovery** : `.product/features/gerer-parcours-discovery.md` · **Épic** : `.product/specs/gestion-locative-specs.md` (§ 1 deux clics, G1-6 accueil, G1-8 fiches) · **Base** : G1c `gerer-biens` (PR #80)

Définition d'un clic (épic) : un bouton ou un lien qui fait avancer compte ; une saisie, un choix dans une liste ou une case cochée ne comptent pas. Tutoiement. Tout nouvel élément cliquable prend une recette `survol-*`.

## Stories

| #    | Story                                                                   | Priorité | Effort |
| ---- | ----------------------------------------------------------------------- | -------- | ------ |
| US-1 | Fiche d'un locataire, noms en liens, fil d'Ariane                       | P0       | M      |
| US-2 | Formulaire unique « Nouveau locataire », retour à l'origine             | P0       | M      |
| US-3 | Raccourcis : retour des documents, mois de la frise, montant d'un loyer | P1       | S      |
| US-4 | « À faire » en haut des loyers du mois                                  | P0       | S      |
| US-5 | Preuve de bout en bout : écrans de référence et parcours de navigation  | P0       | S      |

MoSCoW : **Must** US-1, US-2, US-4, US-5 · **Should** US-3 · **Won't (plus tard)** téléphone du locataire, export avant la suppression du compte, supprimer un locataire, relances (G2).

Dépendances : US-2, US-3 et US-4 utilisent les adresses de US-1 (`gestion/parcours.ts`) ; US-4 mène au formulaire de US-2 ; US-5 à la fin.

---

### US-1 : Fiche d'un locataire, noms en liens, fil d'Ariane

En tant que bailleur, je veux ouvrir un locataire depuis n'importe quelle page où son nom apparaît.

```gherkin
Scénario : un clic depuis les loyers du mois
  Étant donné Antoine Dupont en retard sur Studio Baille
  Quand je clique « Antoine Dupont » dans la ligne du loyer
  Alors la page « Antoine Dupont » s'ouvre (/gerer/locataires/locataire-antoine)
  Et le fil d'Ariane dit « Gérer › Mes locataires › Antoine Dupont »
  Et la fiche montre « E-mail manquant » et « Ajouter l'e-mail »

Scénario : contenu de la fiche
  Alors je vois une carte par location : le bien (lien vers sa fiche) et sa chambre, l'état (en cours, à venir, terminée), l'entrée et la sortie, le loyer et les charges en vigueur (et l'APL), les colocataires (liens)
  Et « Ses 12 derniers loyers » : un statut par mois où il devait un loyer, « Quittance » sur un mois reçu

Scénario : corriger l'e-mail en deux clics
  Quand je clique « Ajouter l'e-mail » puis tape l'adresse et clique « Enregistrer »
  Alors l'e-mail s'affiche et le formulaire se ferme (deux clics)
  Et /gerer/locataires/:id?modifier=1 ouvre le formulaire avec le focus sur l'e-mail

Scénario : noms en liens partout
  Alors chaque nom de locataire est un lien vers sa fiche dans : Loyers du mois, Tous les loyers, fiche d'un bien, Mes biens, Mes locataires
  Et une colocation « Julie Martin et Léa Bernard » donne deux liens

Scénario : locataire introuvable
  Quand j'ouvre /gerer/locataires/inconnu
  Alors « Locataire introuvable » et un lien vers Mes locataires

Scénario : fil d'Ariane de la fiche d'un bien
  Alors la fiche « T2 Lices » montre « Gérer › Mes biens › T2 Lices », chaque étape sauf la dernière est un lien
```

Règles : fiche calculée depuis `EtatGestion` (aucune route) ; « Mes locataires » reste surligné dans le menu sur une fiche.

---

### US-2 : Formulaire unique « Nouveau locataire », retour à l'origine

En tant que bailleur, je veux louer un bien depuis la page où je le vois, puis y revenir.

```gherkin
Scénario : deux clics depuis Mes biens
  Étant donné Parking Prado sans locataire
  Quand je clique « Louer » sur sa ligne
  Alors « Nouveau locataire » s'ouvre avec « Bien : Parking Prado »
  Quand je tape « Léa Bernard » et un loyer de 120, puis clique « Enregistrer »
  Alors je reviens sur Mes biens avec « Léa Bernard loue Parking Prado. » et « Voir sa fiche »
  Et Parking Prado est « Loué » ; deux clics en tout

Scénario : depuis la fiche d'un bien
  Quand je clique « Ajouter le locataire » (bien vacant) ou « Ajouter une location » (chambre de plus)
  Alors le formulaire s'ouvre avec ce bien et le loyer, les charges, le type et le jour de sa dernière location
  Et « Enregistrer » ramène sur la fiche avec le message

Scénario : depuis Mes locataires
  Quand je clique « Ajouter un locataire »
  Alors le premier bien sans locataire est choisi ; la liste « Bien » montre « Sans locataire » puis « Déjà loués »
  Quand je choisis T2 Lices dans la liste
  Alors loyer, charges, type et jour de T2 Lices remplacent les précédents ; nom, e-mail, colocataires, chambre, entrée, dépôt et APL restent
  Et « Enregistrer » ramène sur Mes locataires

Scénario : sans origine
  Quand j'ouvre /gerer/locataires/nouveau sans « retour »
  Alors « Enregistrer » ouvre la fiche du nouveau locataire, avec le message sans « Voir sa fiche »

Scénario : Annuler
  Alors « Annuler » ramène à l'origine, ou à Mes locataires sans origine, sans rien créer

Scénario : erreurs
  Quand un champ est invalide
  Alors les messages de G1b s'affichent, le focus va au premier champ, rien n'est envoyé
  Et un refus du serveur (bien déjà loué à ces dates) s'affiche dans le formulaire

Scénario : adresses hostiles ou anciennes
  Alors « ?bien= » inconnu choisit le premier bien sans locataire
  Et « ?retour=https://exemple.org », « //exemple.org », « /projets » ou « /gererx » sont ignorés
  Et l'ancienne adresse /gerer/biens/:id?louer=1 redirige vers le formulaire du bien

Scénario : sans bien
  Alors la page montre les trois portes de Gérer
```

---

### US-3 : Raccourcis — retour des documents, mois de la frise, montant d'un loyer

En tant que bailleur, je veux revenir là d'où j'ouvre une quittance et corriger un loyer sans détour.

```gherkin
Scénario : retour d'une quittance
  Étant donné la page Loyers de mars 2026
  Quand j'ouvre la quittance de Julie
  Alors le document montre « ← Loyers de mars 2026 » qui ramène à /gerer/loyers?mois=2026-03
  Et depuis la fiche de T2 Lices : « ← T2 Lices » ; depuis la fiche de Julie : « ← Julie Martin » ; depuis les loyers du mois : « ← Loyers du mois »
  Et sans origine valide : « ← Tous les loyers » vers /gerer/loyers

Scénario : deux clics pour la quittance de mars depuis la fiche
  Quand je clique « mars 2026 » dans la frise de T2 Lices
  Alors la page Loyers de mars 2026 s'ouvre, la ligne de T2 Lices mise en évidence
  Quand je clique « Quittance »
  Alors le document s'ouvre (deux clics)

Scénario : corriger un loyer vu dans la liste
  Quand je clique le montant « 700 € » de T2 Lices (nom accessible « 700 € — modifier la location de T2 Lices »)
  Alors la fiche de T2 Lices s'ouvre, « Modifier la location » déjà ouvert
  Quand je change le loyer et clique « Enregistrer »
  Alors la location est modifiée (deux clics)
```

---

### US-4 : « À faire » en haut des loyers du mois

En tant que bailleur, je veux savoir quoi faire en ouvrant Gérer.

```gherkin
Scénario : ordre et nombre
  Étant donné un loyer en retard (Antoine), un bien vacant (Parking Prado) et un locataire en place sans e-mail (Antoine)
  Alors « À faire » liste dans l'ordre : « Loyer d'Antoine en retard », « Louer Parking Prado », « Ajouter l'e-mail d'Antoine Dupont »

Scénario : au-delà de trois
  Étant donné cinq actions
  Alors trois lignes s'affichent et « Voir les 2 autres » déplie les deux suivantes

Scénario : un clic par action
  Alors « Loyer d'… en retard » ouvre la fiche du locataire
  Et « Louer … » ouvre « Nouveau locataire » avec ce bien, retour aux loyers du mois
  Et « Ajouter l'e-mail de … » ouvre la fiche du locataire, formulaire ouvert

Scénario : rien à faire
  Étant donné tous les loyers reçus, aucun bien vacant, tous les e-mails connus
  Alors le bloc n'apparaît pas

Scénario : rien n'est stocké
  Alors les actions se déduisent des données à l'affichage ; un ancien locataire sans e-mail n'en crée pas
```

Règles : retards = loyers du mois en cours au statut « En retard » (comme la pastille du menu) ; vacant = aucune location en cours ni à venir ; e-mail manquant = locataire d'une location en cours ou à venir. La phrase « Sans locataire : … » disparaît de la page (les biens vacants sont dans « À faire »).

---

### US-5 : Preuve de bout en bout

```gherkin
Scénario : écrans de référence
  Alors « Nouveau locataire » et « Fiche d'un locataire » sont mesurés sur les neuf formats (aucun débordement, cibles de 44 px au doigt)
  Et « Louer un bien vacant » mesure la nouvelle page

Scénario : parcours de navigation (Playwright, API simulée)
  Quand je pars de Mes biens, clique « Louer » sur Parking Prado
  Alors le formulaire montre Parking Prado
  Quand je pars des loyers du mois et clique « Julie Martin »
  Alors sa fiche s'ouvre
```
