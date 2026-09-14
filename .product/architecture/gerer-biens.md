# Architecture : Mes biens et vie de la location (G1c)

**Specs** : `.product/specs/gerer-biens-specs.md` · **Base** : `.product/architecture/gerer-socle.md` (ADR-G1 à G7) et `.product/architecture/quittances-fiches.md` (ADR-G8 à G13), toujours valables

## 1. Vue d'ensemble

```
apps/web                                     apps/comptes (worker Pages, même origine)                 D1 deklic-comptes
─────────────────────────────────            ───────────────────────────────────────────              ─────────────────────────
Mes biens, Mes locataires (depuis /etat) ┐   /api/gestion                                             gestion_location + apl
Fiche : Modifier une location            ├─▶ PATCH /locations/:id ── changement après le dernier  ──▶ gestion_changement (nouvelle)
Fiche : Supprimer ce bien                │                           mois payé (insertion atomique)
Mes locataires : Modifier                │   DELETE /biens/:id     ── cascade + locataires orphelins
Saisies : APL (Plus de détails)          └─▶ PATCH /locataires/:id
            ▲                                          ▲
            └──────── @loupe/gestion (pur) ────────────┘  montants du mois (changements, APL), premier mois
                                                          modifiable, contenus avec APL
```

Les pages « Mes biens » et « Mes locataires » ne demandent aucune route : elles se calculent depuis l'état déjà chargé par `GestionProvider`.

## 2. Décisions (ADR-G14 à G18)

| ADR | Décision                                                                                                                                                                                                                                                              | Pourquoi                                                                                                                                 | Écarté                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| G14 | **Les montants d'entrée restent sur la location** ; chaque modification est une ligne `gestion_changement` (`aPartirDe`, loyer, charges, APL). `montantsDuMois(location, periode)` rend le dernier changement dont `aPartirDe ≤ periode`, sinon les montants d'entrée | Aucune reprise de données dans la migration (rien à copier, rien à perdre) ; la création, `depuis-projet` et les saisies ne changent pas | Table de périodes qui remplace les colonnes (migration de données, toutes les écritures à revoir) |
| G15 | **Un changement vaut à partir du mois qui suit le dernier mois payé**, garanti par une insertion conditionnelle (`insert … select … where not exists (paiement de période ≥ aPartirDe)`), comme ADR-G11                                                               | Un « En partie » simultané ne peut pas se glisser sous un dû modifié ; la somme des paiements reste ≤ dû                                 | Lire puis écrire (course)                                                                         |
| G16 | **L'APL est un montant de la location** (entrée et changements), prorata comme le loyer ; le dû total ne change pas, `partLocataire = total − apl` ; le contenu d'un document porte `apl` **seulement s'il est positif**                                              | Les quittances de G1b restent valides telles quelles (champ absent) ; « Reçu » enregistre toujours le total                              | Paiements séparés CAF et locataire (attend G3 banque) ; APL retirée du total (casserait ADR-G11)  |
| G17 | **Supprimer un bien = un lot D1** : les locataires qui n'auront plus aucune location sont calculés d'abord, puis `delete` du bien (cascade des clés étrangères : locations, changements, colocataires, paiements, documents), puis `delete` de ces locataires         | Atomique (tout ou rien) ; la cascade existe déjà et est testée par la suppression d'un compte                                            | Suppression logique « archivé » (hors G1c) ; boucle de suppressions table par table               |
| G18 | **Mes biens et Mes locataires calculés côté web** (`gestion/biens.ts`, `gestion/locataires.ts`, purs) depuis `EtatGestion`                                                                                                                                            | Même état que l'accueil et la fiche ; aucun aller-retour ; testés à 100 % comme `gestion/fiche.ts`                                       | Routes de lecture dédiées (duplication de l'état)                                                 |

La mention de l'APL sur la quittance porte le drapeau **à confirmer** : `APL_QUITTANCE = { mention: 'aide_logement', aConfirmer: true, source: 'Guide du bailleur CAF' }` dans `packages/gestion/src/regles.ts`, lu par le texte du document (même principe que les règles fiscales du moteur).

## 3. Inventaire des fichiers

### `packages/gestion`

| Fichier                               | Rôle                                                                                                                                                                                                                   | État    |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `src/montants.ts`                     | `ChangementSchema`, `ModificationLocationSchema` ; `montantsDuMois(location, periode)`, `premierMoisModifiable(location, paiements)`, `changementRefuse(location, paiements, changement, aujourdhui)` → code ou `null` | nouveau |
| `src/regles.ts`                       | `HORIZON_MODIFICATION_MOIS = 12`, `CHANGEMENTS_MAX = 120`, `APL_QUITTANCE`                                                                                                                                             | modifié |
| `src/schemas.ts`                      | `champsLocation.apl` (facultatif à la saisie, ≤ loyer + charges) ; `LocationGereeSchema` + `apl` et `changements` ; `LocataireModifieSchema`                                                                           | modifié |
| `src/loyers.ts`                       | `loyerDuMois` lit `montantsDuMois` ; `LoyerDu` + `apl`, `partLocataire`                                                                                                                                                | modifié |
| `src/contenus.ts`, `src/documents.ts` | `apl` facultatif dans le contenu (quittance et reçu)                                                                                                                                                                   | modifié |
| `src/index.ts`                        | exports                                                                                                                                                                                                                | modifié |

### `apps/comptes`

| Fichier                                   | Rôle                                                                                                                                                                      | État               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `migrations/0005_gestion_changements.sql` | `alter table gestion_location add column apl integer not null default 0` ; `gestion_changement` (clé `locationId, aPartirDe`, cascade location et compte), index `userId` | nouveau            |
| `scripts/migration.ts`                    | `MIGRATIONS` + 0005                                                                                                                                                       | modifié            |
| `src/gestion/depot.ts`                    | codes `PERIODE_PAYEE` ; interface + `modifierLocation`, `supprimerBien`, `modifierLocataire`                                                                              | modifié            |
| `src/gestion/depot-modifications.ts`      | les trois écritures (insertion conditionnelle du changement, lot de suppression, mise à jour du locataire)                                                                | nouveau            |
| `src/gestion/depot-d1.ts`                 | assemble ; `etat` lit les changements (une requête par compte, groupée par location)                                                                                      | modifié            |
| `src/gestion/lignes.ts`                   | `versLocation(ligne, colocataireIds, changements)` + `apl` ; `changementsParLocation`                                                                                     | modifié            |
| `src/gestion/ecritures.ts`                | colonne `apl` à la création                                                                                                                                               | modifié            |
| `src/gestion/depot-documents.ts`          | contenus et export avec changements et APL                                                                                                                                | modifié            |
| `src/gestion/routes.ts`                   | `PATCH /locations/:id`, `DELETE /biens/:id`, `PATCH /locataires/:id` ; `STATUTS_METIER` + `PERIODE_PAYEE` (409)                                                           | modifié            |
| `src/erreurs.ts`                          | code `PERIODE_PAYEE`                                                                                                                                                      | modifié            |
| `tests/gestion-modifications.test.ts`     | modifier, supprimer, locataire, courses, accès croisé ; migration 0005 sur base 0004 remplie                                                                              | nouveau / modifiés |

### `apps/web`

| Fichier                                                                                            | Rôle                                                                                                                        | État              |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `src/gestion/types.ts`, `reseau.ts`                                                                | client : `modifierLocation`, `supprimerBien`, `modifierLocataire` ; code `periode_payee`                                    | modifiés          |
| `src/gestion/memoire.ts`, `memoire-modifications.ts`                                               | mêmes règles que l'API (le fichier mémoire dépasserait 300 lignes : écritures de G1c à part)                                | modifié / nouveau |
| `src/gestion/GestionContext.tsx`                                                                   | actions correspondantes ; après une suppression, l'état retire le bien et ce qui en dépend                                  | modifié           |
| `src/gestion/biens.ts`                                                                             | `resumeDesBiens(donnees, aujourdhui)` : état (`etatDuBien` de G1b), locataires, loyer en cours, statut du mois, tri naturel | nouveau           |
| `src/gestion/locataires.ts`                                                                        | `groupesDeLocataires(donnees, aujourdhui)` : en ce moment, anciens                                                          | nouveau           |
| `src/gestion/saisie-modifier.ts`                                                                   | lecture du formulaire « Modifier » (montants en texte → centimes, mois proposés, erreurs par champ)                         | nouveau           |
| `src/gestion/saisie.ts`                                                                            | champ APL dans « Plus de détails »                                                                                          | modifié           |
| `src/ecrans/gerer/MesBiens.tsx`, `MesLocataires.tsx`                                               | pages `/gerer/biens` et `/gerer/locataires`                                                                                 | nouveaux          |
| `src/ecrans/gerer/fiche/ModifierLocation.tsx`, `SupprimerBien.tsx`                                 | formulaire en place sur la carte ; encadré de suppression confirmée par le nom                                              | nouveaux          |
| `src/ecrans/gerer/fiche/CarteLocation.tsx`, `FicheBien.tsx`, `TerminerLocation.tsx`                | « Modifier », montants en vigueur et « depuis », « Supprimer ce bien », rappel CAF                                          | modifiés          |
| `src/ecrans/gerer/LigneDeLoyer.tsx`, `DocumentLoyer.tsx`, `AjouterMain.tsx`, `fiche/LouerBien.tsx` | « 520 € + 180 € d'APL », lignes APL de la quittance, champ APL                                                              | modifiés          |
| `src/coque/SectionGerer.tsx`, `src/App.tsx`                                                        | entrées « Mes biens » (nombre) et « Mes locataires » ; routes                                                               | modifiés          |
| `src/textes/gerer-biens.ts`                                                                        | textes des deux pages, de « Modifier », de la suppression et de l'APL                                                       | nouveau           |
| `e2e/ecrans-gerer.ts`, `e2e/reponses-gestion.ts`                                                   | spec des formats : Mes biens, Mes locataires, Modifier, Supprimer                                                           | modifiés          |

## 4. Flux

**Modifier le loyer à partir d'octobre**

```
ModifierLocation ─ lireModification (saisie-modifier) ─ changementRefuse (pur, avant d'envoyer)
  → PATCH /locations/:id  → routes : ModificationLocationSchema (Zod), compte, location du compte (404)
    → depot-modifications.modifierLocation
        · montants : insert or replace into gestion_changement … where not exists (paiement période ≥ aPartirDe)
                     0 ligne écrite → 409 PERIODE_PAYEE
        · jourLoyer, depot, libelle : update gestion_location (libellé : chevauche → 409 BIEN_OCCUPE)
    ← location relue (versLocation)
  ← GestionContext remplace la location dans l'état ; loyers, fiche et Mes biens se recalculent
```

**Supprimer un bien** : `SupprimerBien` (bouton actif quand le nom tapé est égal au nom du bien, espaces et casse ignorés) → `DELETE /biens/:id` → lot D1 (orphelins, bien, orphelins) → 204 → l'état retire le bien, ses locations, paiements, documents et locataires orphelins → navigation vers `/gerer/biens` avec le message.

## 5. Codes et erreurs

| Code serveur    | HTTP | Code web        | Phrase (textes)                                                |
| --------------- | ---- | --------------- | -------------------------------------------------------------- |
| `PERIODE_PAYEE` | 409  | `periode_payee` | « Ce mois a déjà reçu un paiement : choisis un mois suivant. » |
| `HORS_LOCATION` | 400  | existant        | inchangée                                                      |
| `BIEN_OCCUPE`   | 409  | existant        | inchangée (libellé déjà pris pendant ces dates)                |

## 6. Ordre d'implémentation

1. **US-1** paquet : `montants.ts`, `loyers.ts`, schémas (APL comprise, pour ne toucher le modèle qu'une fois), exemples de tests.
2. **US-2** API : migration 0005, lecture des changements, `PATCH /locations/:id`.
3. **US-3** API : `DELETE /biens/:id`.
4. **US-4** web : `biens.ts`, `MesBiens`, menu et route.
5. **US-5** web : client et contexte (modifier, supprimer), `ModifierLocation`, `SupprimerBien`.
6. **US-6** APL : contenus, saisies, ligne de loyer, document, rappel CAF.
7. **US-7** `PATCH /locataires/:id`, `locataires.ts`, `MesLocataires`, menu.

Un commit par story ; `master` fusionnée avant la QA et juste avant la PR ; PR ouverte seulement après la fusion de #77 et #78 (#65 fusionnée le 14/09 à 23 h 14).

## 7. Vérifications avant de coder

- [x] Aucun conflit : aucune PR ouverte n'ajoute de migration (vérifié le 14/09/2026 à 23 h 30) ; recontrôler le numéro 0005 avant la PR.
- [x] Aucune rupture : les routes existantes gardent leurs corps ; `apl` et `changements` s'ajoutent à l'état, lus par le même paquet côté web et serveur (déployés ensemble).
- [x] Clés étrangères appliquées : `node:sqlite` (tests) et D1 (production) ; la cascade de suppression d'un compte est déjà testée.
- [x] Requêtes : changements lus en une requête par compte (pas de N+1) ; lot de suppression en quatre instructions.
- [x] Entrées validées par Zod, compte appliqué à chaque requête (404 hors compte), `Origin` exigé pour écrire.
- [x] Fichiers ≤ 300 lignes : `depot-modifications.ts` et `memoire-modifications.ts` évitent de dépasser (`depot-d1.ts` 247 lignes, `memoire.ts` 225).
- [x] Cas limites : changement au mois d'entrée sans paiement ; même mois qu'un changement existant (remplacé) ; location terminée toute payée (seuls jour, dépôt, libellé) ; APL = loyer + charges (part locataire 0) ; bien à la chambre avec un locataire commun à deux chambres (non orphelin) ; nom tapé avec espaces ou majuscules.

## Écarts avec les specs

- **Migration sans reprise** (ADR-G14) : les specs prévoyaient de copier chaque location en première période ; les montants d'entrée restant sur la location, rien n'est copié. Même comportement vu de l'API.

- **Locataires sans location (US-3)** : supprimés par une seconde instruction du même lot, après la cascade, au lieu d'être calculés avant : même effet, puisque chaque locataire créé par l'API a une location ; le lot reste atomique.
- **Carte de la location (US-5)** : elle montre les montants de ce mois-ci et, quand un changement est programmé, une ligne « Loyer hors charges à partir d'octobre 2026 » ; « depuis octobre 2026 » s'affiche une fois le mois arrivé.
- **APL (US-6)** : la mention « à confirmer » ne s'affiche qu'à l'aperçu du document (barre non imprimée), jamais sur la quittance remise au locataire.
- **Menu** : « Mes biens · N » puis « Mes locataires » (sans nombre, comme dans l'UX de l'épic), après « Tous les loyers ».
- **Migration 0005 et code en production** : `depot-documents.ts` lit `l.apl` ; sans la colonne, l'émission d'un document échouerait en 500 (et non en 503) : la migration doit précéder le déploiement du code, comme 0003.

- **Borne des changements (audit)** : `CHANGEMENTS_MAX` (120) bornait la lecture (`LocationGereeSchema`) sans borner l'écriture : un compte aurait pu rendre son propre état illisible. La borne passe à l'écriture (`tropDeChangements`, 409 `LIMITE_ATTEINTE` ; remplacer le changement d'un mois reste permis) et la lecture n'a plus de borne.

## Auto-revue (checkpoint validé par Claude, sur autorisation de Pierre)

- **ADR-G14 plutôt qu'une table de périodes complète** : c'est le choix le moins risqué pour des données déjà en production (Pierre gère de vrais biens) ; la lecture reste une seule fonction pure.
- **Insertion conditionnelle (G15)** : même parade que G1b, déjà relue par l'audit de sécurité (96/100) ; elle ferme la course « paiement pendant la modification ».
- **Lot D1 (G17)** : `batch` est atomique sur D1 et simulé par `d1-sqlite.ts` ; les locataires orphelins sont calculés avant la cascade (après, leurs liens ont disparu).
- **Pas de nouvelle route de lecture (G18)** : Mes biens tient sur l'état ; « 200 biens par compte » (G1a) borne sa taille.
- **APL enregistrée dans le total (G16)** : cohérent avec « Reçu » en un clic ; la banque (G3) pourra séparer les deux virements sans changer le dû.
