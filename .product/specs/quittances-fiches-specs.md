# Specs : Quittances et fiches (G1b)

**Discovery** : `.product/features/quittances-fiches-discovery.md` · **Épic** : `.product/specs/gestion-locative-specs.md` (G1-4, G1-6 à G1-9) · **Base** : G1a `gerer-socle` (PR #53)

Définition d'un clic (reprise de l'épic) : les boutons qui font avancer comptent ; les saisies ne comptent pas. Tutoiement pour le bailleur, vouvoiement sur les documents destinés au locataire.

## Stories

| #    | Story                                                             | Priorité | Effort |
| ---- | ----------------------------------------------------------------- | -------- | ------ |
| US-1 | Paiement partiel et contenu des documents (calcul pur)            | P0       | M      |
| US-2 | API : paiements partiels (migration 0003)                         | P0       | M      |
| US-3 | API : identité du bailleur, quittances et reçus figés, export     | P0       | M      |
| US-4 | Page Loyers : un mois au choix, « En partie », « Quittance »      | P0       | M      |
| US-5 | Document imprimable et identité du bailleur                       | P0       | M      |
| US-6 | Fiche bien : location en cours, 12 derniers mois, fin de location | P1       | M      |
| US-7 | Louer un bien vacant                                              | P1       | S      |

MoSCoW : **Must** US-1 à US-5 · **Should** US-6, US-7 · **Won't (G1c)** APL, modifier une location, supprimer un bien, pages Biens et Locataires en liste. **Must (ajoutée)** US-8 plusieurs locataires par bien (colocation à bail unique, location à la chambre), à la demande de Pierre.

---

### US-1 : Paiement partiel et contenu des documents (calcul pur)

En tant que bailleur, je veux que Deklic sache ce qui reste dû et prépare des documents exacts, pour ne jamais recalculer à la main.

```gherkin
Scénario : partiel
  Étant donné un loyer dû de 700 € (650 € + 50 € de charges) pour octobre 2026
  Quand un paiement de 300 € est enregistré pour octobre
  Alors le statut est « partiel », 300 € reçus, 400 € restent dus
  Quand un second paiement de 400 € est enregistré
  Alors le statut est « reçu » et il ne reste rien

Scénario : montant acceptable
  Étant donné 300 € déjà reçus sur 700 €
  Alors un paiement de 400 € est acceptable, un paiement de 401 € ne l'est pas

Scénario : priorité des statuts
  Alors « reçu » l'emporte (total couvert) ; puis « partiel » (au moins un centime reçu) ; puis à venir, attendu, en retard comme en G1a

Scénario : contenu d'une quittance
  Étant donné le bailleur « Pierre Georgel, 3 rue X, 13006 Marseille », le locataire Julie Martin, le bien au 12 rue des Lices 13005 Marseille, octobre 2026 entièrement payé
  Alors le contenu porte : type « quittance », numéro, bailleur, locataire, adresse du logement, période du 1er au 31 octobre 2026, loyer 650 €, charges 50 €, total 700 €, date du dernier paiement, date d'émission
  Et la mention « pour acquit »
  Et, si le mois a reçu plusieurs paiements, la mention qui annule les reçus précédents

Scénario : contenu d'un reçu
  Étant donné le paiement de 300 € du 6 octobre sur un loyer de 700 €
  Alors le contenu porte : type « reçu », numéro, montant reçu 300 €, date, total dû 700 € (loyer et charges distingués), déjà reçu avant ce paiement, reste dû 400 €
  Et ne porte pas « pour acquit »

Scénario : prorata
  Étant donné une entrée le 12 octobre
  Alors la quittance reprend le loyer et les charges au prorata (G1a) et la période du 12 au 31 octobre
```

Règles : montants en centimes ; le contenu d'un document est une valeur complète (aucune référence à relire) ; le numéro est déterministe (voir architecture).

---

### US-2 : API — paiements partiels

En tant que bailleur, je veux enregistrer plusieurs paiements pour un même mois, sans pouvoir dépasser ce qui est dû.

```gherkin
Scénario : plusieurs paiements
  Quand j'envoie POST /api/gestion/paiements { locationId, periode: "2026-10", montant: 30000, date: "2026-10-06" }
  Puis le même avec montant 40000 et date "2026-10-20"
  Alors les deux réponses sont 201 et GET /etat contient les deux paiements

Scénario : dépassement
  Étant donné 70 000 centimes déjà reçus sur un dû de 70 000
  Quand j'envoie un paiement de 1 centime pour la même période
  Alors la réponse est 409 MONTANT_DEPASSE et rien n'est écrit

Scénario : dû calculé par le serveur
  Alors le dû est recalculé côté serveur depuis la location (prorata compris), jamais lu dans la requête

Scénario : date du paiement
  Alors la période payée reste bornée comme en G1a (dans la location, au plus un an à l'avance : 400 HORS_LOCATION)
  Et la date du paiement peut être passée, mais pas future : 400 DATE_INVALIDE

Scénario : annulation d'un paiement couvert par un document
  Étant donné une quittance émise pour octobre, ou un reçu émis pour ce paiement
  Quand j'envoie DELETE /api/gestion/paiements/:id
  Alors la réponse est 409 DOCUMENT_EMIS et le paiement reste

Scénario : migration
  Étant donné une base en 0002 avec des paiements
  Quand la migration 0003 est appliquée
  Alors les paiements existants sont conservés à l'identique et la contrainte d'unicité par mois a disparu
```

---

### US-3 : API — identité du bailleur, quittances et reçus figés, export

En tant que bailleur, je veux que mes quittances soient émises une fois pour toutes, à mon nom, et pouvoir emporter toutes mes données.

```gherkin
Scénario : identité du bailleur
  Quand j'envoie PUT /api/gestion/bailleur { nom: "Pierre Georgel", adresse: "3 rue X, 13006 Marseille" }
  Alors la réponse est 200 et GET /etat renvoie bailleur { nom, adresse }

Scénario : émettre une quittance
  Étant donné octobre entièrement payé et l'identité renseignée
  Quand j'envoie POST /api/gestion/documents { type: "quittance", locationId, periode: "2026-10" }
  Alors la réponse est 201 avec le document (id, numéro, contenu figé, émis le)
  Quand je renvoie la même demande
  Alors la réponse est 200 avec le même document (même id, même numéro, même contenu)

Scénario : document figé
  Étant donné une quittance émise
  Quand un paiement du même mois est ajouté ou le bien renommé
  Alors GET /api/gestion/documents/:id renvoie exactement le contenu d'origine

Scénario : refus
  Quand je demande une quittance d'un mois non entièrement payé → 409 LOYER_NON_REGLE
  Quand je demande un reçu pour un paiement qui solde le mois → 409 LOYER_REGLE (c'est une quittance)
  Quand l'identité du bailleur manque → 409 BAILLEUR_MANQUANT
  Quand la location ou le paiement appartient à un autre compte → 404 INTROUVABLE

Scénario : émettre un reçu
  Quand j'envoie POST /api/gestion/documents { type: "recu", paiementId }
  Alors le reçu du paiement est émis (idempotent comme la quittance)

Scénario : liste des documents
  Alors GET /etat renvoie documents [{ id, type, numero, locationId, periode, paiementId?, emisLe }] sans le contenu

Scénario : export
  Quand j'envoie GET /api/gestion/export
  Alors la réponse est un fichier JSON (Content-Disposition attachment, deklic-gestion-AAAA-MM-JJ.json) contenant bailleur, biens (instantané du projet compris), locataires, locations, paiements, documents avec leur contenu, préférences
  Et cette route, en lecture, n'exige pas l'en-tête Origin mais exige la session

Scénario : suppression du compte
  Alors bailleur et documents partent en cascade avec le compte (test sur la D1 simulée)
```

---

### US-4 : Page Loyers

En tant que bailleur, je veux voir n'importe quel mois et y enregistrer exactement ce qui a été payé.

```gherkin
Scénario : un mois au choix
  Quand j'ouvre « Loyers » dans la section Gérer du menu
  Alors /gerer/loyers montre le mois en cours : « Octobre 2026 », boutons « Mois précédent » et « Mois suivant »
  Et les loyers groupés dans cet ordre : En retard, Partiels, Attendus, Reçus (un groupe vide disparaît)
  Et chaque ligne : bien, locataire, montant dû, date due, statut en mot, action principale
  Et le lien « Loyers » du menu porte la pastille des loyers en retard (reprise de l'accueil)

Scénario : paiement partiel en deux clics
  Étant donné un loyer « Attendu » de 700 €
  Quand je clique « En partie »                                          # clic 1
  Alors un formulaire en ligne propose le montant (vide) et la date (aujourd'hui)
  Quand je saisis 300 et clique « Enregistrer »                          # clic 2
  Alors la ligne passe « Partiel · 400 € restent » et propose « Reçu » (le reste) et « Reçu de 300 € »

Scénario : reçu à une autre date
  Quand j'ouvre « En partie » et saisis le montant total avec la date du 3
  Alors le loyer passe « Reçu » avec la date du 3

Scénario : saisie invalide
  Quand le montant est vide, nul, supérieur au reste dû, ou la date dans le futur
  Alors le champ dit quoi corriger et rien n'est envoyé

Scénario : quittance en un clic
  Étant donné un loyer « Reçu »
  Quand je clique « Quittance »                                          # clic 1
  Alors le document s'ouvre (US-5)

Scénario : accueil
  Alors l'accueil de Gérer montre aussi « Partiel » et le bouton « Quittance » sur les loyers reçus, et « Voir tous les loyers » mène à /gerer/loyers
```

---

### US-5 : Document imprimable et identité du bailleur

En tant que bailleur, je veux un document propre à remettre, sans rien mettre en page.

```gherkin
Scénario : première quittance
  Étant donné un compte sans identité de bailleur
  Quand je clique « Quittance »
  Alors une carte demande « Ton nom (tel qu'il figure sur le bail) » et « Ton adresse », une seule fois
  Quand je clique « Enregistrer et ouvrir »
  Alors l'identité est enregistrée et le document s'ouvre

Scénario : document hors coque
  Alors /gerer/documents/:id s'affiche sans menu : barre « ← Loyers », « Imprimer ou enregistrer en PDF »
  Et une page A4 : titre « Quittance de loyer » ou « Reçu de paiement », numéro, bailleur, locataire, logement, période, tableau loyer / charges / total, paiements, mentions, date et lieu d'émission
  Et à l'impression, seule la page est imprimée

Scénario : document introuvable ou d'un autre compte
  Alors « Document introuvable » et un lien vers Loyers

Scénario : exporter mes données
  Quand j'ouvre Mon compte
  Alors la carte « Mes données de gestion » propose « Exporter » qui télécharge le fichier JSON
```

---

### US-6 : Fiche bien (P1)

En tant que bailleur, je veux ouvrir un bien et voir d'un coup d'œil où il en est.

```gherkin
Scénario : fiche
  Quand je clique sur un bien (accueil ou Loyers)
  Alors /gerer/biens/:id montre : nom, adresse, statut (Loué, Vacant, Départ prévu le …), « Voir l'analyse » s'il vient d'un projet
  Et la location en cours : locataire, loyer, charges, dépôt, jour du loyer, entrée
  Et la frise des 12 derniers mois : un point par mois avec son statut en mot (reçu, partiel, retard, vacant), « Quittance » sur un mois reçu

Scénario : terminer la location
  Quand je clique « Terminer la location » et donne la date de sortie                  # 2 clics
  Alors POST /api/gestion/locations/:id/fin { fin } enregistre la sortie
  Et le dernier loyer est au prorata (G1a), aucun loyer n'est dû ensuite, le bien devient « Vacant » après la sortie
  Et une date avant l'entrée → 400 ; des paiements pour des mois après la sortie → 409 PAIEMENTS_APRES_SORTIE
```

---

### US-7 : Louer un bien vacant (P1)

En tant que bailleur, je veux ajouter un locataire à un bien vacant sans le recréer.

```gherkin
Scénario : ajouter le locataire
  Étant donné un bien « Vacant »
  Quand je clique « Ajouter le locataire » (fiche ou accueil)                          # clic 1
  Alors le formulaire de « Ajouter à la main » apparaît sans la partie bien, loyer et charges repris de la dernière location s'il y en a une
  Quand je clique « Louer »                                                            # clic 2
  Alors POST /api/gestion/biens/:id/locations { locataire, location } crée le locataire et la location
  Et une location qui chevauche une location existante du bien → 409 BIEN_OCCUPE
```

## Contrats d'API (ajouts de G1b)

Toutes les routes sous `/api/gestion`, session exigée, `Origin` exigé pour les écritures (G1a), 404 pour une ressource d'un autre compte, corps ≤ 64 Ko.

| Méthode  | Chemin                 | Corps                                                                          | Réponses                                                                                |
| -------- | ---------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `POST`   | `/paiements`           | inchangé                                                                       | 201 ; **409 MONTANT_DEPASSE** (remplace PERIODE_DEJA_RECUE) ; 400 DATE_INVALIDE         |
| `DELETE` | `/paiements/:id`       | —                                                                              | 204 ; 404 ; **409 DOCUMENT_EMIS**                                                       |
| `PUT`    | `/bailleur`            | `{ nom, adresse }`                                                             | 200 `{ nom, adresse }`                                                                  |
| `POST`   | `/documents`           | `{ type: "quittance", locationId, periode }` ou `{ type: "recu", paiementId }` | 201 nouveau ; 200 déjà émis ; 409 LOYER_NON_REGLE, LOYER_REGLE, BAILLEUR_MANQUANT ; 404 |
| `GET`    | `/documents/:id`       | —                                                                              | 200 document complet ; 404                                                              |
| `POST`   | `/locations/:id/fin`   | `{ fin }`                                                                      | 200 location ; 400 ; 404 ; 409 PAIEMENTS_APRES_SORTIE                                   |
| `POST`   | `/biens/:id/locations` | `{ locataire, location }`                                                      | 201 `{ locataire, location }` ; 404 ; 409 BIEN_OCCUPE                                   |
| `GET`    | `/export`              | —                                                                              | 200 JSON en pièce jointe                                                                |
| `GET`    | `/etat`                | —                                                                              | + `bailleur` (ou `null`) et `documents` (sans contenu)                                  |

## Modèle de données (migration `0003`)

| Table                        | Colonnes                                                                                                                                      | Remarques                                                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `gestion_paiement` (recréée) | mêmes colonnes                                                                                                                                | sans `unique (locationId, periode)` ; index `(locationId, periode)`                                               |
| `gestion_bailleur`           | `userId` (clé, cascade), `nom`, `adresse`, `modifieLe`                                                                                        | une ligne par compte                                                                                              |
| `gestion_document`           | `id`, `userId` (cascade), `type`, `numero`, `cle` (unique par compte), `locationId`, `periode`, `paiementId`, `contenu` (JSON figé), `emisLe` | `locationId` sans cascade vers le paiement : un document survit à tout sauf à la suppression du compte ou du bien |

## Hors specs, rappelés

- Aucun e-mail n'est envoyé (G2).
- La modification d'une location (loyer, jour, charges) n'existe pas encore : un document émis ne peut donc pas diverger ; la règle « figé » est tout de même testée.

## Auto-revue (checkpoint validé par Claude, sur autorisation de Pierre)

- **« En partie » est un bouton de la ligne, pas un menu « … »** : un menu aurait coûté un troisième clic (ouvrir le menu, choisir, enregistrer).
- **Un reçu par paiement partiel** : c'est ce que dit l'art. 21 (« si le locataire effectue un paiement partiel, le bailleur est tenu de délivrer un reçu »), et un reçu reste exact même si d'autres paiements suivent.
- **Annulation bloquée après émission** : plus simple et plus sûr qu'un document « annulé » ; l'annulation reste possible pendant les 10 secondes du bandeau, avant toute quittance.
- **PERIODE_DEJA_RECUE disparaît** au profit de MONTANT_DEPASSE : le client web de G1a traduit déjà les codes inconnus en message générique ; le nouveau code a sa phrase.
- **P1 découplées** : US-6 et US-7 n'ont aucune dépendance entrante ; si la session s'allonge, elles partent en G1c sans toucher au reste.

---

### US-8 : Plusieurs locataires pour un bien (P0, ajoutée le 14/09/2026 à la demande de Pierre)

En tant que bailleur en colocation ou en location à la chambre, je veux gérer plusieurs locataires pour un même bien, pour que chacun ait les bons documents.

Remplace la ligne « Won't (G1c) : colocation » de la priorisation ; US-3 (« louer un bien vacant ») et US-7 s'y appuient.

```gherkin
Scénario : colocation à bail unique
  Quand je crée une location avec Julie Martin et Léa Bernard (« + Ajouter un colocataire »)
  Alors une seule location est créée, un seul loyer est dû chaque mois
  Et GET /etat rend la location avec ses deux locataires (le premier saisi, puis les colocataires)
  Et la quittance du mois porte « Julie Martin et Léa Bernard », quel que soit le payeur

Scénario : location à la chambre
  Étant donné le bien « Coloc Rouet » loué « Chambre 1 » à Hugo Petit
  Quand je loue « Chambre 2 » à Léa Bernard aux mêmes dates                          # 2 clics
  Alors deux locations coexistent sur le bien, chacune avec son loyer, ses paiements et ses documents
  Et la page Loyers affiche une ligne par chambre : « Coloc Rouet · Chambre 2 »
  Et le logement de la quittance de Léa est « Coloc Rouet — Chambre 2 »

Scénario : garde-fou
  Étant donné une location du bien sans libellé (bien loué en entier)
  Quand j'ajoute une location sans libellé qui chevauche ses dates
  Alors la réponse est 409 BIEN_OCCUPE
  Et deux locations au même libellé qui se chevauchent sont refusées de même
  Et deux libellés différents aux mêmes dates sont acceptés

Scénario : bornes
  Alors une location a au plus 10 colocataires en plus du premier locataire ; un libellé fait au plus 40 caractères
```

Contrats et données (compléments) :

| Élément                                  | Changement                                                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `NouvelleLocation`                       | + `libelle` facultatif (1 à 40 caractères)                                                                               |
| `CreationLocation`, `NouvelleOccupation` | + `colocataires: NouveauLocataire[]` (0 à 10, défaut vide)                                                               |
| `LocationGeree`                          | + `libelle` facultatif, + `colocataireIds: string[]`                                                                     |
| `ContenuDocument`                        | `locataire` devient `locataires` (au moins un) ; `logement.libelle` facultatif                                           |
| Migration `0003`                         | + colonne `gestion_location.libelle` ; + table `gestion_colocataire (locationId, locataireId, userId, ordre)` en cascade |
