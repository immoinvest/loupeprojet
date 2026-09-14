# Architecture : Quittances et fiches (G1b)

**Specs** : `.product/specs/quittances-fiches-specs.md` · **Base** : `.product/architecture/gerer-socle.md` (ADR-G1 à G7, toujours valables)

## 1. Vue d'ensemble

```
apps/web                                   apps/comptes (worker Pages, même origine)              D1 deklic-comptes
───────────────────────────────            ─────────────────────────────────────────              ─────────────────────
Loyers (mois, En partie, Quittance) ──┐    /api/gestion                                          gestion_paiement (recréée)
Accueil (lignes partagées)            ├──▶  POST /paiements   ── somme ≤ dû (insertion atomique) ─▶ gestion_bailleur (nouvelle)
Document hors coque (impression PDF)  │    PUT  /bailleur                                          gestion_document (nouvelle)
Fiche bien, fin de location, louer    │    POST /documents   ── contenu figé calculé une fois ──▶
Mon compte : Exporter                 └──▶ GET  /documents/:id, POST /locations/:id/fin,
                                             POST /biens/:id/locations, GET /export
            ▲                                         ▲
            └──────── @loupe/gestion (pur) ───────────┘  statut partiel, reste dû, contenu et numéro
                                                         des documents, fin de location, chevauchement
```

Le calcul reste dans le paquet pur, partagé par le serveur (qui décide) et le web (qui affiche et valide avant d'envoyer).

## 2. Décisions (ADR-G8 à G12)

| ADR | Décision                                                                                                                                                                 | Pourquoi                                                                                                   | Écarté                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| G8  | **Le contenu d'un document est stocké figé** (JSON validé par Zod) à l'émission ; il n'est jamais recalculé                                                              | Art. 21 : le document atteste un paiement à une date ; un loyer modifié plus tard ne doit pas le changer   | Recalculer à l'ouverture (dérive silencieuse)                                 |
| G9  | **Émission idempotente** : une clé par document (`quittance:<locationId>:<periode>`, `recu:<paiementId>`), unique par compte ; une seconde demande rend le même document | Double clic, deux onglets, relance réseau : jamais deux quittances pour un mois                            | Compteur global de numéros (course à la synchronisation)                      |
| G10 | **Numéro déterministe** : `Q-AAAAMM-XXXXXXXX` (8 premiers caractères de la location), `R-AAAAMM-XXXXXXXX-YYYY` (4 premiers du paiement)                                  | Lisible, stable, sans table de compteurs ; unique par la clé                                               | Numéro séquentiel par bailleur (utile en comptabilité, prévu en G5 si besoin) |
| G11 | **Somme des paiements ≤ dû, garantie par une insertion conditionnelle** (`insert … select … where somme + montant <= du`)                                                | Atomique dans SQLite : deux « En partie » simultanés ne dépassent jamais le dû                             | Lire puis écrire (course), verrou applicatif                                  |
| G12 | **PDF par l'impression du navigateur** sur une page hors coque, comme `/simulateur-pret/imprimer`                                                                        | Stack du projet (CLAUDE.md), gratuit, aucune dépendance ; G2 tranchera le PDF serveur pour la pièce jointe | Bibliothèque PDF côté client (poids), service de rendu (coût)                 |

Le contenu stocke des **codes de mention** (`pour_acquit`, `annule_recus`) et des nombres ; les phrases vivent dans `apps/web/src/textes/gerer-documents.ts` (principe du moteur : codes côté calcul, textes côté web).

## 3. Inventaire des fichiers

### `packages/gestion`

| Fichier            | Rôle                                                                                                                                                            | État    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `src/loyers.ts`    | `StatutLoyer` + `partiel` ; `SuiviLoyer.resteDu` ; priorité reçu > partiel > à venir / attendu / en retard                                                      | modifié |
| `src/paiements.ts` | `resteDu(du, paiements)`, `montantAcceptable(du, paiements, montant)`                                                                                           | nouveau |
| `src/documents.ts` | schémas `IdentiteBailleurSchema`, `ContenuDocumentSchema`, `DocumentSchema`, `DocumentCompletSchema`, `DemandeDocumentSchema` ; `cleDocument`, `numeroDocument` | nouveau |
| `src/contenus.ts`  | `contenuQuittance(entrees)`, `contenuRecu(entrees)` → `{ ok, contenu }` ou `{ ok: false, code }`                                                                | nouveau |
| `src/baux.ts`      | `finAcceptee(location, fin, paiements)`, `chevauche(locationsDuBien, nouvelle)`, `NouvelleOccupationSchema`, `FinLocationSchema`                                | nouveau |
| `src/mois.ts`      | lignes : `partiel` placé entre en retard et attendu ; `resteDu` par ligne                                                                                       | modifié |
| `src/schemas.ts`   | `EtatGestionSchema` + `bailleur` (nullable) et `documents` ; `ExportGestionSchema`                                                                              | modifié |
| `src/index.ts`     | exports                                                                                                                                                         | modifié |

### `apps/comptes`

| Fichier                                 | Rôle                                                                                                                                                                 | État                |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `migrations/0003_gestion_documents.sql` | recrée `gestion_paiement` sans l'unicité (copie à l'identique), index `(locationId, periode)` ; crée `gestion_bailleur`, `gestion_document` (`unique (userId, cle)`) | nouveau             |
| `scripts/migration.ts`                  | `MIGRATIONS` + `{ fichier: '0003_gestion_documents.sql', table: 'gestion_document' }`                                                                                | modifié             |
| `src/gestion/depot.ts`                  | codes métier (voir § 5) ; interface + `enregistrerBailleur`, `emettreDocument`, `document`, `terminerLocation`, `louer`, `exporter`                                  | modifié             |
| `src/gestion/depot-d1.ts`               | assemble les trois parties ; `payer` avec insertion conditionnelle ; `annulerPaiement` bloqué par un document                                                        | modifié             |
| `src/gestion/depot-documents.ts`        | bailleur, émission et lecture des documents, export                                                                                                                  | nouveau             |
| `src/gestion/depot-baux.ts`             | fin de location, louer un bien vacant                                                                                                                                | nouveau             |
| `src/gestion/lignes.ts`                 | `versBailleur`, `versDocument`, `versDocumentComplet` (JSON relu par Zod)                                                                                            | modifié             |
| `src/gestion/routes.ts`                 | nouvelles routes, `STATUTS_METIER` complété, en-tête `Content-Disposition` de l'export                                                                               | modifié             |
| `src/erreurs.ts`                        | nouveaux codes                                                                                                                                                       | modifié             |
| `tests/gestion-*.test.ts`               | paiements partiels, documents, baux, export, migration 0003 sur base 0002 remplie                                                                                    | nouveaux / modifiés |

### `apps/web`

| Fichier                                                                                                      | Rôle                                                                                                        | État                                |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `src/gestion/types.ts`, `reseau.ts`, `memoire.ts`                                                            | client : `enregistrerBailleur`, `emettreDocument`, `document`, `terminerLocation`, `louer` ; codes traduits | modifiés                            |
| `src/gestion/GestionContext.tsx`                                                                             | actions correspondantes ; l'état garde `bailleur` et `documents` à jour                                     | modifié                             |
| `src/gestion/saisie.ts`                                                                                      | `occupationDepuisSaisie` (formulaire sans la partie bien)                                                   | modifié                             |
| `src/gestion/loyers-page.ts`                                                                                 | mois précédent / suivant, groupes de la page Loyers, validation de « En partie »                            | nouveau                             |
| `src/textes/gerer-loyers.ts`, `gerer-documents.ts`, `gerer-fiche.ts`                                         | textes                                                                                                      | nouveaux                            |
| `src/ecrans/gerer/LigneLoyer.tsx`                                                                            | ligne partagée (accueil et Loyers) : statut, Reçu, En partie, Quittance / Reçu de …                         | nouveau (extrait de `LoyersDuMois`) |
| `src/ecrans/gerer/EnPartie.tsx`                                                                              | formulaire en ligne montant + date                                                                          | nouveau                             |
| `src/ecrans/gerer/useActionsLoyer.ts`                                                                        | payer, annuler (10 s), émettre puis ouvrir le document, identité à demander                                 | nouveau                             |
| `src/ecrans/gerer/IdentiteBailleur.tsx`                                                                      | carte nom + adresse, « Enregistrer et ouvrir »                                                              | nouveau                             |
| `src/ecrans/gerer/Loyers.tsx`                                                                                | page `/gerer/loyers`                                                                                        | nouveau                             |
| `src/ecrans/gerer/LoyersDuMois.tsx`                                                                          | utilise `LigneLoyer` et `useActionsLoyer` ; lien « Voir tous les loyers »                                   | modifié                             |
| `src/ecrans/gerer/DocumentGestion.tsx`, `document/PageDocument.tsx`                                          | `/gerer/documents/:id` hors coque, page A4                                                                  | nouveaux                            |
| `src/ecrans/gerer/FicheBien.tsx`, `fiche/FriseMois.tsx`, `fiche/TerminerLocation.tsx`, `fiche/LouerBien.tsx` | `/gerer/biens/:id`                                                                                          | nouveaux (P1)                       |
| `src/ecrans/compte/MesDonneesGestion.tsx`                                                                    | lien d'export dans Mon compte                                                                               | nouveau                             |
| `src/coque/SectionGerer.tsx`                                                                                 | lien « Loyers » avec la pastille des retards                                                                | modifié                             |
| `src/App.tsx`                                                                                                | routes `gerer/loyers`, `gerer/biens/:id` (coque), `gerer/documents/:id` (hors coque)                        | modifié                             |
| `e2e/formats.ts`, `e2e/reponses-gestion.ts`                                                                  | écrans Loyers, Fiche bien, Document                                                                         | modifiés                            |

## 4. Flux

### Paiement « En partie »

1. Web : `montantAcceptable` refuse avant l'envoi (montant > reste dû, date future).
2. Serveur : lit la location du compte (404 sinon), calcule le dû du mois (`loyerDuMois`), vérifie la période (G1a) et la date.
3. `insert into gestion_paiement (…) select ?, …, ? where (select coalesce(sum(montant), 0) from gestion_paiement where userId = ? and locationId = ? and periode = ?) + ? <= ?` ; `meta.changes = 0` → 409 `MONTANT_DEPASSE`.

### Émission d'une quittance

1. Web : « Quittance » → `emettreDocument({ type: 'quittance', locationId, periode })`.
2. Serveur : document existant pour la clé → 200. Sinon lit bailleur (absent → 409 `BAILLEUR_MANQUANT`), location, bien, locataire, paiements du mois ; `contenuQuittance` (non soldé → 409 `LOYER_NON_REGLE`) ; `insert … on conflict (userId, cle) do nothing` puis relecture par clé (course entre deux onglets) ; 201 si écrit, 200 sinon.
3. Web : `409 BAILLEUR_MANQUANT` → carte `IdentiteBailleur` ; « Enregistrer et ouvrir » → `PUT /bailleur` puis nouvel essai ; succès → navigation vers `/gerer/documents/:id`.

### Annulation d'un paiement

`select` du paiement du compte (404) ; document de clé `recu:<id>` ou `quittance:<locationId>:<periode>` → 409 `DOCUMENT_EMIS` ; sinon `delete`.

### Fin de location et location d'un bien vacant

`finAcceptee` : fin < début → 400 `FIN_AVANT_ENTREE` ; paiement pour une période postérieure à la sortie → 409 `PAIEMENTS_APRES_SORTIE`. `louer` : bien du compte (404), `chevauche` avec une location du bien → 409 `BIEN_OCCUPE` ; locataire et location écrits par `batch`.

## 5. Codes d'erreur

| Code serveur             | HTTP | Code web                 | Phrase (tutoiement)                                                                          |
| ------------------------ | ---- | ------------------------ | -------------------------------------------------------------------------------------------- |
| `MONTANT_DEPASSE`        | 409  | `montant_depasse`        | « Ce montant dépasse ce qui reste dû ce mois-ci. »                                           |
| `DATE_INVALIDE`          | 400  | `invalide`               | (message générique « Vérifie les champs »)                                                   |
| `DOCUMENT_EMIS`          | 409  | `document_emis`          | « Une quittance ou un reçu a déjà été émis pour ce paiement : il ne peut plus être annulé. » |
| `LOYER_NON_REGLE`        | 409  | `loyer_non_regle`        | « Le loyer n'est pas encore entièrement reçu : Deklic prépare un reçu, pas une quittance. »  |
| `LOYER_REGLE`            | 409  | `invalide`               | —                                                                                            |
| `BAILLEUR_MANQUANT`      | 409  | `bailleur_manquant`      | (ouvre la carte d'identité, pas de message d'erreur)                                         |
| `FIN_AVANT_ENTREE`       | 400  | `invalide`               | —                                                                                            |
| `PAIEMENTS_APRES_SORTIE` | 409  | `paiements_apres_sortie` | « Des loyers sont déjà reçus après cette date : annule-les d'abord. »                        |
| `BIEN_OCCUPE`            | 409  | `bien_occupe`            | « Ce bien a déjà une location à ces dates. »                                                 |
| `PERIODE_DEJA_RECUE`     | —    | —                        | retiré (remplacé par `MONTANT_DEPASSE`)                                                      |

## 6. Données personnelles et sécurité

- Le contenu d'un document contient le nom du locataire, l'adresse du logement et l'identité du bailleur : lu seulement par son compte (`where userId = ?`, 404 sinon), jamais journalisé, relu par Zod avant d'être renvoyé.
- L'export est une lecture : session exigée, pas d'`Origin` (lien de téléchargement), `Cache-Control: no-store` (hérité d'`acces`).
- Bornes contre l'abus : identité ≤ 120 + 300 caractères ; au plus un document par clé ; les paiements restent bornés par le dû (et donc par la location).

## 7. Ordre d'implémentation

1. **US-1** paquet pur (statut partiel, contenus, numéros, baux) — tests 100 %.
2. **US-2** migration 0003 + paiements partiels + annulation bloquée — D1 simulée, base 0002 remplie migrée.
3. **US-3** bailleur, documents, export — accès croisé, idempotence, figé.
4. Fusion de `master`.
5. **US-4** page Loyers, ligne partagée, En partie.
6. **US-5** document hors coque, identité, export dans Mon compte.
7. **US-6** fiche bien et fin de location ; **US-7** louer un bien vacant.
8. Spec des formats, QA, audit, docs, PR.

## 8. Écarts assumés et risques

- **Recréer `gestion_paiement`** : SQLite ne sait pas retirer une contrainte `unique` de table ; la migration copie les lignes à l'identique dans une nouvelle table puis la renomme. Aucune table ne référence `gestion_paiement` : pas de clé étrangère à suspendre. Testé sur une base 0002 remplie.
- **Migration 0002 pas encore en production** : Pierre appliquera 0002 et 0003 d'une seule commande (`wrangler d1 migrations apply` les enchaîne).
- **`GET /etat` grossit** avec les documents (sans contenu) : quelques dizaines d'octets par document ; pagination toujours repoussée (G1c), bornée de fait par la durée des baux.
- **Mentions en codes** : une phrase de mention corrigée plus tard change l'affichage des anciens documents, pas leurs montants ni leurs noms ; acceptable (mêmes sens juridiques).

## Auto-revue (checkpoint validé par Claude, sur autorisation de Pierre)

- **Trois fichiers de dépôt plutôt qu'un** : `depot-d1.ts` fait déjà 240 lignes ; les documents et les baux y dépasseraient 300 (règle `max-lines`).
- **Pas de clé étrangère document → paiement** : un document doit survivre à la lecture de ses paiements ; l'annulation bloquée suffit à garder la cohérence.
- **Insertion conditionnelle vérifiée sur la D1 simulée (`node:sqlite`)** : même moteur SQLite que D1 ; un test lance deux paiements concurrents.
- **La ligne de loyer devient un composant partagé** : l'accueil et la page Loyers affichent la même chose ; sans cela, « En partie » et « Quittance » seraient codés deux fois.

## ADR-G13 : plusieurs locataires par bien (décision de Pierre du 14/09/2026, story US-8)

| Question | Décision | Pourquoi | Écarté |
| --- | --- | --- | --- |
| Colocation à bail unique | `locataireId` reste le premier locataire ; les autres vivent dans `gestion_colocataire (locationId, locataireId, userId, ordre)` et remontent en `colocataireIds` | Additif : G1a (accueil, porte « J'ai acheté ce bien ») continue de lire `locataireId` sans changement | Remplacer `locataireId` par un tableau (réécriture de G1a) |
| Location à la chambre | Plusieurs locations simultanées sur un bien, distinguées par `libelle` (« Chambre 2 ») | Chaque chambre a ses loyers et ses documents : c'est le modèle de loyer dû par location déjà en place | Une table « chambres » (plus lourd, sans besoin exprimé : nombre de chambres, surfaces) |
| Chevauchement | Refusé seulement entre locations du même bien **et du même libellé** (absence de libellé comprise) | Garde-fou du bien loué en entier conservé | Aucun contrôle (double location par erreur) |
| Documents | `contenu.locataires` (tableau, au moins un) et `logement.libelle` | La quittance d'une colocation nomme tous les colocataires | Une quittance par colocataire (le paiement est commun) |
| Migration | Complétée dans `0003` (pas encore appliquée en production) | Une seule migration de G1b à appliquer pour Pierre | Une migration `0004` de plus |

Fichiers touchés en plus : `packages/gestion/src/{schemas,baux,contenus,documents,creation,mois}.ts`, `apps/comptes/{migrations/0003_gestion_documents.sql,src/gestion/{depot-d1,depot-baux,depot-documents,lignes}.ts}`, `apps/web` (saisie « + Ajouter un colocataire » et « Chambre », affichage des noms et du libellé). Borne : 10 colocataires par location.
