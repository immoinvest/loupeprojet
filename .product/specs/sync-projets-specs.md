# Specs : synchronisation des projets avec le compte

Discovery : `.product/features/sync-projets-discovery.md` · Architecture : `.product/architecture/sync-projets.md`

## Épic

Les projets d'une personne connectée la suivent sur tous ses appareils, sans rien changer pour les personnes sans compte ni pour le travail hors ligne.

## Stories

| #    | Story                                                        | Priorité | Couche                                  |
| ---- | ------------------------------------------------------------ | -------- | --------------------------------------- |
| US-1 | Paquet `@loupe/projets` : schémas, contrat, règles de fusion | P0       | `packages/projets`, `apps/web/stockage` |
| US-2 | API `POST /api/projets/synchroniser` et migration 0004       | P0       | `apps/comptes`                          |
| US-3 | Journal de synchronisation dans le stockage local            | P0       | `apps/web/src/stockage`                 |
| US-4 | Synchronisation automatique (compte, modifications, réseau)  | P0       | `apps/web/src/stockage/synchro`         |
| US-5 | Ligne d'état et textes (Mes projets, Mon compte)             | P0       | `apps/web/src/ecrans`, `textes`         |

### US-1 — Paquet `@loupe/projets`

**En tant que** développeur, **je veux** un seul contrat partagé par l'API et le web, **afin que** le serveur valide exactement ce que le web enregistre.

```gherkin
Scénario: les schémas d'un projet enregistré sont partagés
  Étant donné les imports existants de "@/stockage/projets"
  Quand les schémas sont déplacés dans @loupe/projets
  Alors ces imports compilent et se comportent comme avant (réexport)

Scénario: fusion d'une réponse du serveur
  Étant donné un appareil qui a envoyé le projet A (modifié le 10:00) et supprimé B
  Et le serveur renvoie C (nouveau) et la liste des projets actifs [A, C]
  Quand la réponse est appliquée
  Alors A n'est plus « à envoyer », B n'est plus « à supprimer », C est ajouté
  Et un projet synchronisé absent de la liste active quitte l'appareil

Scénario: modification pendant l'envoi
  Étant donné A envoyé avec la date 10:00 puis modifié à 10:01 avant la réponse
  Quand la réponse est appliquée
  Alors A reste « à envoyer » et la version locale est gardée

Scénario: changement de compte
  Étant donné des projets synchronisés avec le compte de Léa et un projet créé sans compte
  Quand Camille se connecte sur l'appareil
  Alors les projets de Léa quittent l'appareil et le projet créé sans compte est à envoyer à Camille

Scénario: projet d'exemple
  Étant donné un appareil qui n'a que le projet d'exemple jamais modifié
  Quand il se connecte à un compte qui a déjà des projets
  Alors l'exemple quitte l'appareil et n'est pas envoyé
```

### US-2 — API de synchronisation

```gherkin
Scénario: accès
  Étant donné une requête sans session
  Alors la réponse est 401 NON_CONNECTE
  Et une écriture sans en-tête Origin connu est 403 ORIGINE_INCONNUE

Scénario: dernière modification gagne
  Étant donné le projet A enregistré sur le compte avec la date 10:05
  Quand un appareil envoie A daté de 10:00
  Alors le serveur garde la version de 10:05 et la renvoie à cet appareil

Scénario: date dans le futur
  Quand un appareil envoie un projet daté de demain
  Alors la date retenue pour comparer est l'heure du serveur

Scénario: isolement des comptes
  Étant donné Léa et Camille qui enregistrent chacune un projet d'identifiant "p1"
  Alors chacune ne reçoit que le sien

Scénario: bornes
  Étant donné un compte à 200 projets actifs
  Quand un nouveau projet est envoyé
  Alors il est listé dans "refuses" et les autres changements passent
  Et un corps de plus de 720 Ko est refusé en 413, un projet invalide ou de plus de 64 Ko en 400

Scénario: pagination
  Étant donné 60 projets modifiés depuis le curseur
  Alors la réponse en donne 25 avec "suite" vrai et un curseur qui permet de lire la suite

Scénario: base non migrée
  Étant donné une base sans la table projet
  Alors la réponse est 503 PROJETS_INDISPONIBLE

Scénario: suppression du compte
  Quand le compte est supprimé
  Alors ses projets sont effacés (cascade)
```

### US-3 — Journal de synchronisation local

```gherkin
Scénario: les modifications sont notées
  Étant donné une personne dont l'appareil est lié à un compte
  Quand elle crée, modifie, change le statut ou supprime un projet
  Alors le journal "loupe.synchro.v1" note le projet à envoyer ou la suppression datée

Scénario: sans compte
  Étant donné un appareil jamais lié à un compte
  Alors le journal reste vide et aucune requête n'est faite

Scénario: journal illisible
  Étant donné un journal corrompu
  Alors il est remplacé par un journal neuf, les projets restent là
```

### US-4 — Synchronisation automatique

```gherkin
Scénario: première connexion
  Étant donné trois projets créés sans compte
  Quand Camille se connecte
  Alors l'appareil lit le compte puis y envoie ses trois projets

Scénario: autre appareil
  Étant donné un compte avec deux projets
  Quand Camille ouvre Deklic connectée sur un nouvel appareil
  Alors les deux projets s'affichent dans Mes projets

Scénario: modification
  Quand Camille modifie une hypothèse
  Alors le projet est envoyé 1,5 s après la dernière modification (une seule requête pour une rafale)

Scénario: hors ligne
  Étant donné le réseau coupé
  Quand Camille modifie un projet
  Alors l'état dit « hors ligne » et l'envoi repart au retour du réseau

Scénario: retour sur l'onglet
  Quand l'onglet redevient visible (au plus une fois toutes les 30 s)
  Alors les changements des autres appareils sont lus

Scénario: déconnexion
  Quand Camille se déconnecte
  Alors les projets synchronisés quittent l'appareil
  Et un projet pas encore envoyé reste sur l'appareil, sans compte

Scénario: suppression du compte
  Quand Camille supprime son compte
  Alors ses projets restent sur l'appareil, sans compte
```

### US-5 — Ligne d'état et textes

```gherkin
Scénario: sans compte
  Alors Mes projets dit « N projets · sauvegardés sur cet appareil »

Scénario: connecté
  Alors Mes projets dit « N projets · sauvegardés sur votre compte » suivi de l'état :
    | à_jour        | à jour                                        |
    | en_cours      | envoi en cours…                               |
    | hors_ligne    | hors ligne : envoi au retour du réseau        |
    | indisponible  | sauvegarde du compte indisponible, projets gardés sur cet appareil |
    | limite        | limite de 200 projets atteinte                |
    | reconnexion   | session expirée : reconnectez-vous            |

Scénario: carte du compte et Mon compte
  Alors la carte ne promet plus « bientôt » et Mon compte explique la déconnexion et la suppression
```

## Modèle de données

```sql
create table "projet" (
  "userId" text not null references "user" ("id") on delete cascade,
  "id" text not null,
  "contenu" text,            -- ProjetEnregistre en JSON ; null pour une suppression
  "modifieLe" text not null, -- ISO 8601, borné à l'heure du serveur
  "revision" integer not null,
  "supprime" integer not null,
  primary key ("userId", "id")
);
create index "projet_userId_revision_idx" on "projet" ("userId", "revision");
```

## Contrat d'API

`POST /api/projets/synchroniser`

```jsonc
// requête
{ "depuis": 0, "changements": [
  { "type": "enregistrer", "projet": { /* ProjetEnregistre */ } },
  { "type": "supprimer", "id": "…", "le": "2026-09-14T10:00:00.000Z" }
] }
// réponse 200
{ "curseur": 12, "suite": false, "ids": ["…"], "refuses": [], "projets": [ /* ProjetEnregistre */ ] }
```

Erreurs : 400 `CHAMPS_INVALIDES`, 401 `NON_CONNECTE`, 403 `ORIGINE_INCONNUE`, 413 `CORPS_TROP_GROS`, 503 `PROJETS_INDISPONIBLE`, 500 `ERREUR_INTERNE`.

## Auto-revue

- Toutes les stories sont P0 : sans l'une d'elles, la promesse « sur tous vos appareils » n'est pas tenue ou pas visible.
- La ligne d'état aurait pu être une icône seule ; le texte court est gardé (lecteurs d'écran, et Pierre ne lit pas le code : il doit voir que ça marche).
