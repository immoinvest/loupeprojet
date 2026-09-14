# Architecture : synchronisation des projets avec le compte

Specs : `.product/specs/sync-projets-specs.md`

## 1. Vue d'ensemble

```
ProjetsProvider (localStorage)                      apps/comptes (worker Pages, même origine)
  loupe.projets.v1  ← écrans inchangés               POST /api/projets/synchroniser
  loupe.synchro.v1  ← journal (à envoyer, curseur)     acces() : hôte, Origin, session
        │                                              bodyLimit 720 Ko, Zod (@loupe/projets)
SynchroProvider (sous CompteProvider)                  DepotProjets D1 : table projet (0004)
  préparer → client.synchroniser → appliquer  ───────▶
  déclencheurs : connexion, modification +1,5 s,
  retour réseau, onglet visible (30 s)
```

Le stockage local reste la source des écrans ; la synchronisation est une couche à côté, qui transforme `{ projets, journal }` par des fonctions pures de `@loupe/projets`.

## 2. Décisions (ADR-S1 à S7)

- **S1 — Appareil d'abord, projet entier, dernière modification gagne.** Comparaison des dates ISO (`modifieLe` du projet, `le` d'une suppression) ; côté serveur, date bornée à `maintenant` ; à date égale, la dernière arrivée gagne (une horloge d'appareil en avance, bornée à l'heure du serveur, ne doit pas faire perdre la modification suivante ; un réessai réécrit le même contenu).
- **S2 — Révision par compte.** Chaque écriture prend `max(revision) + 1` du compte dans la même instruction SQL (D1 sérialise les écritures) ; le client garde un `curseur`. La purge ne supprime jamais la ligne de révision maximale (sinon un numéro serait réutilisé).
- **S3 — Suppressions gardées.** Une suppression est une ligne `supprime = 1, contenu = null`, gardée 90 jours et 500 au plus par compte. Chaque réponse porte `ids`, la liste complète des projets actifs : un appareil qui a manqué une suppression purgée la rattrape quand même.
- **S4 — Premier échange en lecture seule.** Au changement de compte, le premier appel n'envoie rien ; si le compte a déjà des projets, le projet d'exemple intact quitte l'appareil ; ensuite tout le reste est envoyé.
- **S5 — Le compte des projets est retenu.** Le journal note `compte` (identifiant) et `synchronises` (ids connus du serveur). Connexion à un autre compte : les projets synchronisés avec le précédent quittent l'appareil. Déconnexion : même chose, sauf les modifications pas encore envoyées, qui restent sans compte. Suppression du compte : tout reste sur l'appareil, sans compte.
- **S6 — CPU de 10 ms.** Le serveur valide par Zod ce qu'il écrit, jamais ce qu'il relit : le contenu stocké est la sortie de `JSON.stringify` d'un objet validé et la réponse est assemblée sans le réanalyser ; le client revalide toute la réponse. Lots de 10 changements, pages de 25 projets.
- **S7 — Paquet `@loupe/projets`.** `ProjetEnregistreSchema` et ses sous-schémas quittent `apps/web/src/stockage/projets.ts` (réexportés) pour être partagés par l'API. Dépend de `@loupe/moteur` (schéma du projet, migration) et de Zod.

## 3. Fichiers

### `packages/projets` (nouveau, couverture 100 %)

| Fichier             | Contenu                                                                                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/enregistre.ts` | `StatutProjetSchema`, `AdresseBienSchema`, `EtatReponseSchema`, `ReponseVisiteSchema`, `VisiteSchema`, `ProjetEnregistreSchema`, `migrerEnregistre`, `LONGUEUR_MAX_NOTE`, `NOM_EXEMPLE`, `estExempleIntact` |
| `src/contrat.ts`    | bornes (`LIMITE_PROJETS` 200, `MAX_CHANGEMENTS` 10, `TAILLE_MAX_PROJET` 64 000, `PAGE_PROJETS` 25), `ChangementSchema`, `RequeteSynchroSchema`, `ReponseSynchroSchema`                                      |
| `src/journal.ts`    | `JournalSynchroSchema`, `JOURNAL_VIDE`, `noterEnregistrement`, `noterSuppression`                                                                                                                           |
| `src/fusion.ts`     | `changerDeCompte`, `oublierCompte`, `detacherCompte`, `preparerEnvoi`, `appliquerReponse`                                                                                                                   |
| `src/index.ts`      | exports                                                                                                                                                                                                     |

### `apps/comptes`

| Fichier                                                                     | Contenu                                                                                           |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `migrations/0004_projets.sql`                                               | table `projet`, index `(userId, revision)` (0003 est pris par la branche `quittances-fiches`)     |
| `src/acces.ts`                                                              | garde de session déplacée de `gestion/acces.ts` (réexport conservé)                               |
| `src/projets/depot.ts`                                                      | `DepotProjets`, `estTableProjetAbsente`                                                           |
| `src/projets/depot-d1.ts`                                                   | `depotProjetsD1(base, options)` : lecture des lignes visées, limite, lot d'upserts + purge, pages |
| `src/projets/routes.ts`                                                     | `routeurProjets` : `POST /synchroniser`, erreurs                                                  |
| `src/dependances.ts`, `src/app.ts`, `scripts/migration.ts`, `tests/aide.ts` | câblage (`projets` dans `Dependances`, version 0.3.0)                                             |

### `apps/web`

| Fichier                                                                                                   | Contenu                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/stockage/projets.ts`                                                                                 | réexporte les schémas de `@loupe/projets` ; `creerProjet` inchangé                                                                                                                      |
| `src/stockage/journal.ts`                                                                                 | `lireJournal`, `ecrireJournal` (`loupe.synchro.v1`)                                                                                                                                     |
| `src/stockage/ProjetsContext.tsx`                                                                         | état `{ projets, journal }` tenu dans une référence (plus de fermeture périmée), mutations notées au journal, contexte interne `useStockageProjets` (lire, transformer, version locale) |
| `src/stockage/synchro/types.ts`                                                                           | `ClientProjets`, `CodeErreurSynchro`, `StatutSynchro`                                                                                                                                   |
| `src/stockage/synchro/reseau.ts`                                                                          | `clientProjetsReseau` (fetch, Zod, codes)                                                                                                                                               |
| `src/stockage/synchro/memoire.ts`                                                                         | `clientProjetsMemoire` : mêmes règles que l'API, pour les tests et `AppEnMemoire`                                                                                                       |
| `src/stockage/synchro/cycle.ts`                                                                           | `synchroniserTout(client, stockage)` : boucle préparer → envoyer → appliquer (au plus 40 tours), statut final                                                                           |
| `src/stockage/synchro/SynchroContext.tsx`                                                                 | `SynchroProvider`, `useSynchro` : déclencheurs, minuterie, transitions du compte                                                                                                        |
| `src/compte/CompteContext.tsx`                                                                            | `sortie` : `'deconnexion'                                                                                                                                                               | 'suppression' | null`, posée par les actions |
| `src/ecrans/MesProjets.tsx`, `src/ecrans/Compte.tsx`, `src/textes/mon-compte.ts`, `src/textes/synchro.ts` | ligne d'état, carte, explications                                                                                                                                                       |
| `src/App.tsx`                                                                                             | `SynchroProvider` sous `CompteProvider` ; `AppEnMemoire` reçoit `projetsDistants`                                                                                                       |

## 4. Algorithme du serveur

```
synchroniser(userId, { depuis, changements }):
  maintenant ← horloge
  lignes ← select id, modifieLe, supprime where userId and id in (ids des changements)
  actifs ← count supprime = 0
  pour chaque changement :
    le ← min(date du changement, maintenant)
    gagne ← ligne absente ou le > ligne.modifieLe
    enregistrer : si gagne et (ligne absente ou supprimée) et actifs ≥ 200 → refuses ; sinon upsert (contenu, le, supprime 0)
    supprimer   : upsert (null, le, supprime 1)
  + purge des suppressions (> 90 jours, au-delà des 500 plus récentes, jamais la révision maximale)
  batch atomique ; acceptés ← instructions dont meta.changes > 0
  si depuis > max(revision) : depuis ← 0
  page ← lignes actives de revision > depuis, par révision, 26 au plus ; suite ← 26 lues
  curseur ← dernière révision de la page si suite, sinon max(revision, depuis)
  perdants ← enregistrements non acceptés ni refusés : leur ligne active est ajoutée
  projets ← page ∪ perdants − acceptés
  ids ← select id where supprime = 0
```

Upsert :

```sql
insert into projet (userId, id, contenu, modifieLe, revision, supprime)
values (?, ?, ?, ?, (select coalesce(max(revision), 0) + 1 from projet where userId = ?), ?)
on conflict (userId, id) do update set contenu = excluded.contenu, modifieLe = excluded.modifieLe,
  revision = excluded.revision, supprime = excluded.supprime
where excluded.modifieLe > projet.modifieLe
```

## 5. Algorithme de l'appareil

- `preparerEnvoi(projets, journal)` : rien si `premiere` ; sinon d'abord les suppressions, puis les projets à envoyer présents, 10 au plus, avec la date de chacun (`envoi`).
- `appliquerReponse(projets, journal, envoi, reponse)` :
  1. à envoyer ← retirer les ids envoyés non refusés dont la date locale n'a pas bougé, et les ids sans projet local ;
  2. à supprimer ← retirer les suppressions envoyées dont la date n'a pas bougé ;
  3. si `premiere` et `ids` non vide : l'exemple intact quitte l'appareil et la liste à envoyer ;
  4. chaque projet reçu remplace ou s'ajoute, sauf s'il est à envoyer ou à supprimer ;
  5. un projet local absent de `ids` et pas à envoyer quitte l'appareil ;
  6. tri par `creeLe` décroissant ; `curseur`, `synchronises ← ids`, `premiere ← faux`.
- Cycle : tant qu'il reste à envoyer (hors refusés de ce cycle) ou `suite`, recommencer ; statut `a_jour`, `limite` (refusés), `hors_ligne` (réseau), `reconnexion` (401), `indisponible` (autres).
- Déclencheurs : `utilisateur.id` connu → `changerDeCompte` puis cycle ; version locale qui change → minuterie 1,5 s ; `online` ; `visibilitychange` visible si le dernier cycle a plus de 30 s. Un seul cycle à la fois ; une demande pendant un cycle en relance un à la fin.
- Transitions : `sortie = 'deconnexion'` → `oublierCompte` ; `'suppression'` → `detacherCompte`. Une session absente au chargement ne touche à rien.

## 6. Sécurité

| Menace                                   | Parade                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| Lire ou écraser les projets d'un autre   | clé primaire `(userId, id)`, `userId` de la session seulement, jamais du corps |
| CSRF                                     | écriture exigeant un en-tête Origin connu, cookie `SameSite=Lax`               |
| Contenu arbitraire stocké                | `ProjetEnregistreSchema` complet (après migration), 64 Ko par projet           |
| Épuisement du quota D1                   | 200 actifs, 10 changements, 720 Ko, 500 suppressions gardées                   |
| Cache d'une réponse privée               | `Cache-Control: no-store`                                                      |
| Projets d'un autre compte sur l'appareil | S5                                                                             |
| Texte d'annonce                          | aucun champ nouveau : le projet ne porte que portail, identifiant et lien      |

Risque résiduel : pas de limite de débit par compte (même situation que Gérer) ; un compte peut répéter des lots de 10 écritures.

## 7. Ordre d'implémentation

US-1 paquet → US-2 API → US-3 journal local → US-4 synchronisation → US-5 écrans → QA (formats e2e inchangés, sans compte) → audit → docs.

## 8. Auto-revue

- **Rejeté** : un dépôt mémoire côté serveur (Gérer l'a abandonné) ; les tests passent par la D1 simulée sur `node:sqlite`.
- **Rejeté** : une table compteur par compte pour les révisions ; la règle « ne jamais purger la révision maximale » suffit.
- **Point d'attention** : `ProjetsProvider` passe d'une fermeture sur `projets` à une référence ; les écrans qui enchaînent deux mutations dans le même clic (Partage « Ajouter », Gérer « J'ai acheté ce bien ») en profitent.
- **Point d'attention** : les parcours e2e sans compte ne doivent faire aucune requête `/api/projets` ; vérifié par un test d'écran (client mémoire qui compte les appels).
- **Bug trouvé par la suite complète** (`gerer-pret.test.tsx`) : « J'ai acheté ce bien » crée puis change le statut dans la même milliseconde ; à date égale, le compte gardait la première version et la renvoyait, le projet repassait « Offre faite ». Toute modification et toute suppression sont désormais datées par `dateDeModification` (`@loupe/projets`), strictement après la précédente ; et, comme le test fige l'horloge (cas réel d'un appareil en avance sur le serveur), la date bornée pouvait encore égaler la précédente : à date égale, le serveur prend désormais la dernière arrivée (`>=`).
- **Changé pendant l'implémentation** : `derniere` (date de la dernière synchronisation) retiré du contexte, aucun écran ne l'affichait ; `lancer(compte)` reçoit le compte au lieu de relire une référence (aucune branche morte) ; la spec des formats simule un compte des projets qui renvoie la liste complète des actifs (un faux compte qui répondrait `ids: []` retirerait les projets de l'appareil, comme le vrai le ferait).

## 9. Audit de sécurité (diff de la branche)

| Catégorie (poids)                   | Constat                                                                                                                                                                                                                                                                      | Note  |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Authentification, autorisation (25) | Garde `acces` partagée avec Gérer (hôte connu, `Origin` connu pour écrire, session Better Auth) ; `userId` pris de la session, jamais du corps ; clé `(userId, id)` et `where userId = ?` sur chaque requête ; tests 401, 403, isolement de deux comptes au même identifiant | 25/25 |
| Injection (20)                      | Requêtes préparées ; nombre de `?` tiré de la longueur du lot (10 au plus) ; réponse assemblée à partir de `JSON.stringify` et du contenu stocké, qui est lui-même la sérialisation d'un objet validé                                                                        | 20/20 |
| Validation des entrées (20)         | Zod complet côté serveur (migration puis `ProjetEnregistreSchema`, clés inconnues retirées), date ISO, identifiant ≤ 64, un changement par projet, 10 changements, 64 Ko par projet, corps ≤ 720 Ko avant lecture ; réponse revalidée côté client                            | 20/20 |
| Données sensibles, journaux (15)    | Journal limité au chemin et au code ; aucun texte d'annonce nouveau ; `no-store` ; déconnexion : projets du compte retirés de l'appareil ; changement de compte : ceux du précédent aussi                                                                                    | 15/15 |
| Configuration, dépendances (10)     | Aucune dépendance externe ajoutée ; migration manuelle avec 503 dédié et repli sur l'appareil ; pas de limite de débit par compte (un compte peut répéter des lots de 10 écritures), comme Gérer                                                                             | 7/10  |
| IA / LLM (10)                       | Sans objet (aucun appel au modèle)                                                                                                                                                                                                                                           | 10/10 |

**Score : 97/100 (A).** Risque résiduel accepté : absence de limite de débit par compte sur les écritures D1 (mêmes bornes que Gérer : volume par requête et nombre de lignes par compte). À traiter avec une limite commune aux routes `/api/gestion` et `/api/projets` si le quota D1 est un jour approché.
