# Specs — accueil-menu

Épic : **Accueil et menu recentré**. Source : `.product/features/accueil-menu-discovery.md`.

## US-1 — Le menu : Accueil, trois projets, sans Comparer (Must)

En tant que Camille, je veux un Accueil clairement signalé et un menu court, pour savoir où revenir.

```gherkin
Scénario: Accueil en tête du menu
  Étant donné la barre latérale
  Alors le premier lien après le logo est « Accueil » vers « / »
  Et le logo de la barre latérale et celui de la barre d'app mènent à « / »

Scénario: Trois projets puis tous les projets
  Étant donné 7 projets enregistrés
  Alors la section Analyser montre « Nouveau projet », les 3 plus récents et « Tous mes projets · 7 » vers « /projets »
  Et avec un seul projet, « Tous mes projets · 1 » est aussi affiché

Scénario: Comparer hors du menu
  Alors la barre latérale n'a pas de lien « Comparer »
  Et la page Tous les projets a le bouton « Comparer » qui mène à « /comparer »

Scénario: Deux accueils évités
  Étant donné une personne connectée
  Alors le lien de Gérer vers « /gerer » s'appelle « Loyers du mois » (pastille des retards conservée)
```

## US-2 — Écran Accueil : squelette selon les briques (Must)

```gherkin
Scénario: La racine est l'accueil
  Quand j'ouvre « / »
  Alors je vois un titre de niveau 1 (« Bonjour Camille » connectée, « Bienvenue sur Deklic » sinon)

Scénario: Deux briques
  Étant donné Analyser et Gérer affichées
  Alors l'accueil a deux blocs titrés « Analyser » et « Gérer », côte à côte à partir de 1 024 px

Scénario: Une seule brique
  Étant donné « Gérer seulement »
  Alors l'accueil n'a que le bloc « Gérer », sur toute la largeur
```

## US-3 — Bloc Analyser (Must)

```gherkin
Scénario: Rien à soi
  Étant donné aucun projet, ou seulement le projet d'exemple jamais modifié
  Alors le bloc propose « Analyser une annonce » vers « /projets/nouveau »
  Et « Voir l'exemple » vers le projet d'exemple s'il existe

Scénario: Des projets
  Étant donné des projets en analyse, en visite, en offre, écartés
  Alors le bloc affiche le nombre de projets à l'étude (hors écartés et achetés)
  Et le nombre par étape : En analyse, Visite prévue, Offre faite, Acheté
  Et le meilleur cash-flow mensuel parmi les projets à l'étude complets, avec un lien vers le projet
  Et une prochaine étape, par priorité : acheté (si Gérer est affiché) → « Gérer ce bien », offre → « Vérifier le financement », visite prévue → « Préparer la visite », en analyse → « Voir le rapport »
  Et les boutons « Nouveau projet » et « Tous mes projets »

Scénario: Tout est écarté
  Alors pas de prochaine étape sur un projet, mais « Analyser une annonce »
```

## US-4 — Bloc Gérer (Must)

```gherkin
Scénario: Sans compte
  Alors le bloc explique qu'il faut un compte gratuit et propose « Se connecter » vers « /connexion?retour=/ »

Scénario: Chargement / erreur
  Alors « Chargement de tes biens… », ou le message d'erreur et « Réessayer »

Scénario: Aucun bien
  Alors « Ajouter mon premier bien » vers « /gerer »

Scénario: Des biens (14/09/2026, Julie a payé, Antoine en retard)
  Alors « Septembre 2026 », « 1 loyer sur 2 reçu », « 700 € reçus sur 1 130 € », « 1 loyer en retard »
  Et « Voir les loyers du mois » vers « /gerer », « Ajouter un bien » vers « /gerer/ajouter »
```

## US-5 — Mon compte : trois choix, retours à l'accueil (Should)

```gherkin
Scénario: Trois choix exclusifs
  Étant donné la carte « Mon menu »
  Alors trois boutons radio : « Analyser et Gérer », « Analyser seulement », « Gérer seulement »
  Quand je choisis « Gérer seulement »
  Alors la section Analyser disparaît du menu et l'accueil n'a plus que Gérer
  Et un enregistrement refusé remet le choix précédent et affiche l'erreur

Scénario: Retours à l'accueil
  Alors « Continuer sans compte » et le logo de la connexion mènent à « / »
  Et une connexion sans « retour » ramène à « / »
  Et se déconnecter depuis Mon compte ou supprimer son compte ramène à « / »
```

## Modèle de données

Aucun changement de schéma. Nouvelle constante `NOM_PROJET_EXEMPLE` (stockage). Préférences : `PreferencesMenu` existant.

## Priorités (MoSCoW)

Must : US-1 à US-4. Should : US-5. Won't : choix des briques sans compte.

## Auto-revue critique

- Stories testables une à une, sans dépendance serveur. US-3 « meilleur cash-flow » ignore les résultats partiels (`complet: false`) pour ne pas afficher un chiffre faux.
- La priorité « acheté → Gérer » n'apparaît que si Gérer est affiché, sinon l'accueil pousserait vers une brique masquée.
