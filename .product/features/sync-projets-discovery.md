# Feature Discovery : synchronisation des projets avec le compte

**Slug** : `sync-projets` · **Branche** : `feat/sync-projets` (worktree `loupe-sync-projets`, base `master` 47d9e59) · **Date** : 2026-09-14

## Demande d'origine

Pierre, 14/09/2026 : « Aujourd'hui, les projets sont sur un appareil, mais il faut les sauvegarder en base de données afin qu'ils soient disponibles pour le compte et pas seulement l'appareil. Change ça afin que je puisse avec mon compte trouver mon activité, par exemple analyser les différents biens que j'ai. »

## Situation actuelle

- Les projets (`ProjetEnregistre` : nom, statut, adresse exacte, visite, projet du moteur) vivent dans le `localStorage` du navigateur (`loupe.projets.v1`), lus et écrits par `ProjetsProvider`.
- Les comptes existent (feature `comptes`, Better Auth, D1 `deklic-comptes` en juridiction UE) ; Gérer a déjà ses données en D1 (`/api/gestion/*`, migration 0002).
- La carte de Mes projets annonce aux personnes connectées : « La synchronisation arrive bientôt : vos projets restent sur cet appareil. »

## Analyse

### Quoi

1. **Les projets d'une personne connectée sont enregistrés sur son compte** (table D1 `projet`), et reviennent sur tout appareil où elle se connecte.
2. **Le premier appareil connecté verse ses projets dans le compte** (ceux créés sans compte compris) ; le projet d'exemple jamais touché n'est pas recopié si le compte a déjà des projets.
3. **Hors ligne, rien ne change** : l'application écrit d'abord sur l'appareil, puis envoie dès que le réseau revient (l'application est installable et marche hors ligne depuis `responsive`).
4. **Sans compte, rien ne change** : aucun appel réseau, tout reste sur l'appareil (principe 9).
5. **État visible, en une ligne** sous le titre de Mes projets : « sauvegardés sur votre compte · à jour », « envoi en cours », « hors ligne », etc.

### Pourquoi

- Pierre analyse plusieurs biens, sur ordinateur et téléphone ; aujourd'hui un projet créé sur l'un est invisible sur l'autre, et perdu si le navigateur est vidé.
- Le compte n'avait pas encore de raison d'être pour l'analyse ; c'est la promesse de la carte « Retrouvez vos projets sur tous vos appareils ».

### Pour qui

Camille (téléphone en visite, ordinateur le soir) et Pierre (plusieurs biens analysés).

## Options étudiées

| Option                                                                                                  | Pour                                                 | Contre                                                                                             | Verdict     |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------- |
| A. Le serveur devient la seule source (chaque écran lit l'API)                                          | Simple à raisonner                                   | Casse le hors ligne, lenteur à chaque clic, réécrit tous les écrans, crée un chemin anonyme à part | Écartée     |
| B. **Appareil d'abord + synchronisation par projet** (dernière modification gagne, suppressions notées) | Écrans inchangés, hors ligne gardé, un seul endpoint | Conflit résolu projet par projet, pas champ par champ                                              | **Retenue** |
| C. Fusion champ par champ (CRDT)                                                                        | Aucun conflit perdu                                  | Très complexe pour un besoin rare (une personne, rarement deux appareils à la même minute)         | Écartée     |

## Périmètre

### Dans le périmètre (P0)

- Table `projet` (migration `0004_projets.sql`), API `POST /api/projets/synchroniser` dans `apps/comptes`, même garde que Gérer (hôte, en-tête Origin des écritures, session).
- Paquet pur `@loupe/projets` : schémas d'un projet enregistré (déplacés du web, réexportés), contrat de synchronisation, règles de fusion côté appareil (testées à 100 %).
- Synchronisation dans le web : au chargement connecté, 1,5 s après une modification, au retour du réseau et au retour sur l'onglet ; changement de compte, déconnexion, suppression du compte.
- Ligne d'état dans Mes projets, textes de la carte et de Mon compte mis à jour.

### Hors périmètre

- Synchroniser les réglages locaux (simulateur de prêt, préférences d'affichage) : autre feature si besoin.
- Partage d'un projet entre comptes, historique des versions, fusion champ par champ.
- Synchronisation instantanée entre deux onglets ouverts (chaque onglet se met à jour au retour de focus).

## Contraintes

- **Quotas gratuits** : D1 100 000 écritures et 5 M lectures par jour ; worker Pages 10 ms de CPU par requête → envoi groupé par 10 changements, réponses par pages de 25 projets, pas de revalidation Zod des lignes lues côté serveur.
- **Vie privée** : données en UE (D1 `deklic-comptes`), aucune donnée d'annonce en plus de ce que le projet porte déjà (portail, identifiant, lien) ; supprimer le compte efface les projets du serveur (cascade).
- **Sans compte d'abord** : aucun appel réseau pour une personne non connectée.
- **Mise en service** : la migration 0004 doit être appliquée en production par Pierre ; sans elle, l'API rend `503 PROJETS_INDISPONIBLE` et l'application reste sur l'appareil.

## Risques

| Risque                                                               | Parade                                                                                                             |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Même projet modifié sur deux appareils hors ligne                    | La modification la plus récente gagne (projet entier) ; date bornée à l'heure du serveur (horloge en avance)       |
| Projets d'une autre personne versés dans mon compte (appareil prêté) | L'appareil retient le compte des projets synchronisés ; au changement de compte, ils quittent l'appareil           |
| Projet supprimé qui revient d'un vieil appareil                      | Suppressions gardées 90 jours ; liste des identifiants actifs renvoyée à chaque synchronisation                    |
| Doublon du projet d'exemple sur chaque appareil                      | Le premier échange d'un appareil lit avant d'envoyer ; l'exemple intact n'est pas versé si le compte a des projets |
| Abus du quota D1                                                     | 200 projets actifs, 10 changements et 720 Ko par requête, 64 Ko par projet, 500 suppressions gardées au plus       |
| Migration oubliée en production                                      | 503 dédié, état « sauvegarde du compte indisponible », rien n'est perdu                                            |

## Critères de succès

- Créer un projet connecté sur l'ordinateur, ouvrir Deklic connecté sur le téléphone : le projet est là, avec ses hypothèses, son adresse et sa visite.
- Le supprimer sur le téléphone : il disparaît de l'ordinateur au retour sur l'onglet.
- Sans compte : zéro requête `/api/projets`.

## Auto-revue (checkpoint auto-validé, autorisation du 13/09/2026)

- **Doute** : effacer les projets de l'appareil à la déconnexion peut surprendre. **Retenu** quand même (appareil partagé, projets d'un autre compte) ; les modifications pas encore envoyées restent sur l'appareil, rien n'est perdu ; une phrase dans Mon compte le dit.
- **Doute** : « dernière modification gagne » peut écraser une saisie. Cas rare (même projet, deux appareils, sans réseau) ; la fusion champ par champ coûterait bien plus qu'elle ne rapporte.
- **Changé après relecture** : première idée d'un envoi en un seul lot de tous les projets ; remplacé par des lots de 10 et des pages de 25 à cause du CPU de 10 ms et de la taille des corps.
