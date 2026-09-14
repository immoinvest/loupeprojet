# Discovery — accueil-menu

Date : 14/09/2026 · Demande de Pierre (session principale).

## Demande brute

1. Un **Accueil** au-dessus des briques Analyser, Gérer et Outils : aujourd'hui, rien ne dit qu'un clic sur le logo ramène à l'accueil (le logo mène à Mes projets ou à Gérer).
2. L'accueil **dépend des briques activées** : deux briques → page divisée en deux ; une brique activée mais vide → appel à l'action (nouveau projet, ajouter un bien) ; sinon, un contenu qui donne envie de passer à l'action (acheter un bien rentable, puis l'exploiter).
3. Section **Analyser** du menu : les **trois derniers projets**, puis un bouton **« Voir tous les projets »** qui mène à l'actuelle page Mes projets.
4. **Comparer** sort du menu ; il reste accessible depuis Tous les projets (le bouton existe déjà dans l'en-tête de la page).
5. **Mon compte** : choisir Analyser et Gérer, Analyser seul ou Gérer seul ; au moins un.

## Ce qui existe déjà

- `coque/Sidebar.tsx` : logo → `/projets` (ou `/gerer` si Analyser masqué), sections `SectionAnalyser` (Nouveau projet, 5 projets, « Tous mes projets · N » au-delà de 5, Comparer) et `SectionGerer` (Ajouter un bien, « Accueil » de Gérer avec pastille des retards). `BarreApp` (téléphone) : logo → `/projets`.
- La racine `/` redirige vers `/projets`.
- **Point 5 déjà livré** (feature `gerer-socle`, G1a) : carte « Mon menu » dans Mon compte, deux interrupteurs, la dernière section affichée est figée, préférence enregistrée sur le compte (`PreferencesMenu`) avec copie locale. Sans compte, les deux sections sont affichées et la page Mon compte n'est pas accessible.
- Gérer : `statut` anonyme / chargement / pret / erreur, `resumeDuMois` (loyers reçus, dus, en retard), écran des trois portes quand aucun bien.
- Projets : stockage local, projet d'exemple amorcé au premier lancement (nom « T3 · 65 m² · Marseille 5e », statut Visite prévue), statuts analyse / visite / offre / écarté / scénario / acheté.

## Résultats attendus (outcomes)

- Camille sait où elle est et où revenir : un lien « Accueil » en tête de menu, et le logo y mène aussi.
- À l'ouverture, l'accueil lui dit **quoi faire maintenant** : analyser une première annonce, reprendre le projet le plus avancé, ou encaisser ses loyers.
- Le menu est plus court (3 projets, pas de Comparer) et ne défile presque plus.

## Livrables (outputs)

- Route `/` = écran **Accueil** (au lieu de la redirection).
- Bloc Analyser de l'accueil :
  - **vide** (aucun projet à soi : liste vide ou seulement l'exemple jamais modifié) → appel à l'action « Analyser une annonce », lien vers l'exemple s'il existe ;
  - **avec projets** → nombre de projets à l'étude, avancement par statut (en analyse, visite, offre, acheté), meilleur cash-flow, **prochaine étape** proposée (acheté → le gérer ; offre → financement ; visite prévue → questions de visite ; en analyse → rapport), boutons Nouveau projet et Tous mes projets.
- Bloc Gérer de l'accueil :
  - sans compte → pourquoi un compte, « Se connecter » (retour à l'accueil) ;
  - chargement / erreur (avec Réessayer) ;
  - **vide** (aucun bien) → appel à l'action « Ajouter mon premier bien » (les trois portes de Gérer) ;
  - **avec biens** → mois en cours, « N loyers sur M reçus », barre des montants, retards, bouton vers les loyers du mois et Ajouter un bien.
- Deux briques affichées → deux colonnes à partir de 1 024 px, empilées en dessous. Une seule → une colonne.
- Menu : lien « Accueil » sous le logo ; logo (barre latérale et barre d'app) → `/` ; Analyser = Nouveau projet, 3 projets, « Tous mes projets · N » toujours affiché ; Comparer retiré ; dans Gérer, l'ancien « Accueil » devient « Loyers du mois » (deux « Accueil » seraient ambigus).
- Mon compte : la carte « Mon menu » propose **trois choix exclusifs** (Analyser et Gérer · Analyser seulement · Gérer seulement) au lieu de deux interrupteurs : c'est la formulation de Pierre, et « au moins un » devient impossible à enfreindre par construction.
- Après connexion sans destination, « Continuer sans compte », déconnexion et suppression du compte : retour à l'accueil (`/`) au lieu de `/projets`.

## Hors périmètre

- Choisir les briques sans compte (la préférence vit sur le compte ; sans compte, les deux restent affichées, comme aujourd'hui).
- Synchronisation des projets, nouvelles pages de Gérer (Loyers, Biens, Locataires : session parallèle `quittances-fiches`).
- Contenus éditoriaux longs, vidéos, statistiques de marché nationales sur l'accueil.

## Contraintes

- Aucun appel réseau nouveau : l'accueil lit les projets locaux (moteur dans le navigateur) et les données de Gérer déjà chargées par `GestionProvider`.
- Tutoiement (écrans d'analyse et de Gérer), peu de texte (direction visuelle C), exigence « deux clics » de Pierre.
- Accessibilité : un seul `h1`, un `h2` par bloc, cibles de 44 px, lisible à 320 px.
- Session parallèle `quittances-fiches` (worktree `loupe-gestion`) modifie des écrans de Gérer : ne toucher ni `LoyersDuMois.tsx` ni `Portes.tsx` ; `SectionGerer.tsx` seulement pour un libellé.

## Risques

| Risque                                                                                                 | Parade                                                                                           |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Le projet d'exemple rend l'accueil « jamais vide »                                                     | Exemple intact = nom de l'exemple et jamais modifié (`creeLe === modifieLe`) : compté comme vide |
| Calculer tous les projets sur l'accueil (coût)                                                         | Même calcul que Mes projets, sans scénarios ; mémoïsé                                            |
| Tests et e2e qui cliquent sur « Comparer » dans le menu, ou attendent la redirection `/` → Mes projets | Mis à jour dans la même PR                                                                       |
| Conflit avec la session Gérer                                                                          | Périmètre limité ci-dessus                                                                       |

## Auto-revue critique

- Point 5 déjà livré : je ne le refais pas, je le reformule en trois choix (demande explicite « un ou l'autre ou les deux »). Si Pierre préférait les interrupteurs, le changement est local à `MonMenu.tsx`.
- « Voir tous les projets » : je garde le libellé existant « Tous mes projets · N » (le nombre informe) mais il est désormais toujours affiché, en bouton sous les trois projets.
- La « prochaine étape » est une règle écrite (statuts), aucune IA : conforme au principe 1.
