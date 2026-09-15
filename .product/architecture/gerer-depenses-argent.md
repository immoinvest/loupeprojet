# Architecture : dépenses, prêt du bien et Argent (G5-4, prêt, G5-1)

**Session de nuit A1 (15-16/09/2026)** · **Specs de l'épic** : `.product/specs/gestion-locative-specs.md` (G5-1, G5-4, § 2 Dépense et Bien.prêt) · **Base** : `gerer-socle.md`, `quittances-fiches.md`, `gerer-biens.md`, `gerer-parcours.md` (ADR-G1 à G23), toujours valables · Migration réservée **0007**

## 1. Découverte (résumé)

**Résultat attendu** : le bailleur voit ce que ses biens lui rapportent vraiment, mois par mois et sur l'année : loyers encaissés, dépenses, mensualités de prêt, cash-flow réel.

**Ce qui est livré**

1. **Dépenses** : « Ajouter une dépense » en deux clics depuis la fiche d'un bien et la page Argent : montant, catégorie (liste fixe), bien ou aucun, date, libellé facultatif, récupérable sur le locataire, récurrence facultative (mensuelle, trimestrielle, annuelle, avec une date de fin facultative). Modifier, supprimer avec confirmation. Les occurrences d'une dépense récurrente se calculent à l'affichage, jamais stockées une à une.
2. **Prêt du bien** : capital, taux, durée, première échéance, assurance mensuelle. Pour un bien venu d'une analyse, le prêt est **proposé depuis l'instantané du projet** (montant emprunté, taux, durée, assurance calculés par `@loupe/moteur`) : « Enregistrer ce prêt » en un clic. Mensualité du mois et capital restant dû calculés par le tableau d'amortissement du moteur, jamais stockés.
3. **Argent** : page `/gerer/argent` (entrée « Argent » du menu Gérer) et carte « Argent » sur la fiche d'un bien. Pour un mois ou une année : loyers encaissés, dépenses par catégorie, mensualités, cash-flow réel ; courbe des 12 derniers mois en HTML/CSS ; filtre par bien (`MenuChoix`) ; chaque montant d'un bien mène à sa fiche. « À faire » propose « Enregistrer le prêt de … » pour un bien acheté depuis une analyse avec emprunt.

**Hors périmètre** : réel contre prévu, déclaration, export CSV (A2) ; régularisation des charges (B2, qui lira `recuperable`) ; opérations bancaires (C3) ; différés de prêt (le prêt du bien est amortissable dès la première échéance).

**Contraintes** : migration **uniquement additive** et fusionnée sans être appliquée en production (règle « migration sans risque ») ; sans la table, seules les nouvelles routes rendent `503 DEPENSES_INDISPONIBLE` et seuls les nouveaux écrans disent « Bientôt disponible ».

## 2. Stories

| #    | Story                                                                                                                | Priorité |
| ---- | -------------------------------------------------------------------------------------------------------------------- | -------- |
| US-1 | Paquet : schémas des dépenses et du prêt, occurrences, mensualités via le moteur, bilans du mois et de l'année       | Must     |
| US-2 | API : migration 0007, routes des dépenses et du prêt, 503 sans table, export enrichi seulement si les tables sont là | Must     |
| US-3 | Web : client réseau et mémoire, contexte `useArgent`, saisies, prêt proposé depuis l'analyse                         | Must     |
| US-4 | Web : ajouter, modifier, supprimer une dépense (deux clics comptés)                                                  | Must     |
| US-5 | Web : carte « Argent » de la fiche (mois, 12 mois, prêt proposé ou saisi)                                            | Must     |
| US-6 | Web : page Argent (mois ou année, filtre, courbe, montants liés), menu, « À faire »                                  | Must     |
| US-7 | Écrans de référence (formats) et parcours Playwright                                                                 | Should   |

Critères d'acceptation principaux (Gherkin résumé) :

```gherkin
Scénario : ajouter une dépense en deux clics depuis la fiche
  Étant donné la fiche du T2 Lices
  Quand je clique « Ajouter une dépense » (1), saisis 840 €, « Taxe foncière », le 15/10/2026, et clique « Enregistrer » (2)
  Alors je reviens sur la fiche et la carte Argent compte 840 € de dépenses en octobre

Scénario : dépense récurrente
  Étant donné une assurance de 12 € mensuelle depuis le 03/01/2026
  Alors elle compte 12 € chaque mois à partir de janvier 2026, 144 € sur l'année, et une seule ligne est enregistrée

Scénario : prêt proposé par l'analyse
  Étant donné un bien acheté depuis un projet (emprunt 150 000 € à 3,35 % sur 25 ans)
  Quand je clique « Enregistrer ce prêt » sur la carte Argent (un clic)
  Alors la mensualité et le capital restant dû du mois s'affichent, calculés par le moteur

Scénario : cash-flow réel
  Étant donné 700 € encaissés, 120 € de dépenses et 612 € de mensualité en octobre
  Alors Argent affiche « Cash-flow réel −32 € » et la courbe des 12 mois

Scénario : migration pas encore appliquée
  Étant donné une base migrée jusqu'à 0006
  Alors /api/gestion/etat et toutes les routes existantes répondent comme avant
  Et /api/gestion/argent, /depenses, /biens/:id/pret rendent 503 DEPENSES_INDISPONIBLE
  Et la page Argent affiche « Bientôt disponible », le reste de Gérer marche
```

## 3. Décisions (ADR-G24 à G28)

| ADR | Décision                                                                                                                                                                                                                                                                                                                                    | Pourquoi                                                                                                                             | Écarté                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| G24 | **Deux tables latérales** : `gestion_depense` (clé `id`, compte, bien facultatif, cascade du compte et du bien) et `gestion_pret` (clé `bienId`, cascade) ; aucune modification de table existante ; `GET /etat` inchangé                                                                                                                   | Règle « migration sans risque » : la migration peut arriver après le code sans rien casser                                           | Colonnes du prêt sur `gestion_bien` (`alter table`) ; dépenses dans l'état commun |
| G25 | **Sous-routeur `argent/`** monté d'une ligne dans `routes.ts`, avec son dépôt (`Dependances.argent`) et son propre `onError` : table absente → `503 DEPENSES_INDISPONIBLE`. `GET /argent` rend dépenses et prêts en une requête ; l'export ajoute `depenses` et `prets` **seulement si les tables existent**                                | Les pannes de la nouvelle table ne touchent jamais les routes de G1 ; le web charge Argent en un aller-retour                        | Élargir `DepotGestion` et `EtatGestion` (casserait `/etat` sans la migration)     |
| G26 | **Récurrence = une ligne** (`frequence`, `jusquAu` facultatif) ; `occurrencesDuMois(depense, periode)` rend la date de l'occurrence du mois (jour ramené au dernier jour d'un mois court) ou rien                                                                                                                                           | Modifier une récurrence change tout d'un coup ; aucune ligne à générer ni à purger                                                   | Une ligne par occurrence (écritures en masse, suppression partielle ambiguë)      |
| G27 | **Prêt calculé par le moteur** : `tableauDuPret` appelle `tableauAmortissement` de `@loupe/moteur` (capital en euros), arrondit au centime, assurance mensuelle fixe en plus ; première échéance = mois `debut` ; mensualité du mois et capital restant dû jamais stockés ; le prêt proposé vient de `calculerFinancement` sur l'instantané | Même amortissement que l'analyse et le simulateur, au centime ; `@loupe/gestion` dépend désormais de `@loupe/moteur` (pur, Zod seul) | Formule recopiée dans `@loupe/gestion` (deux calculs à maintenir)                 |
| G28 | **Cash-flow réel = encaissé − dépenses − mensualités**, sur la **date** des paiements (l'argent arrivé ce mois-là, pas le mois du loyer) ; les dépenses d'un bien supprimé ou d'une autre donnée incohérente sont ignorées ; un filtre par bien écarte les dépenses sans bien                                                               | « Réel » = trésorerie ; le suivi par mois de loyer reste dans Loyers                                                                 | Par période du loyer (un loyer payé en avance brouillerait le mois)               |

Catégorie `credit` : gardée dans la liste fixe des specs pour un crédit saisi comme dépense ; la page le range avec les dépenses, les mensualités du prêt du bien restent une ligne à part. Pas de double compte automatique : c'est au bailleur de choisir l'un ou l'autre (dit sous la carte du prêt).

## 4. Inventaire des fichiers

### `packages/gestion`

| Fichier                | Rôle                                                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `src/regles-argent.ts` | `CATEGORIES_DEPENSE`, `FREQUENCES` (pas en mois), `DEPENSES_MAX` 2 000, `CAPITAL_MAX_CENTIMES`, `TAUX_PRET_MAX`, `DUREE_PRET_MAX_MOIS` |
| `src/depenses.ts`      | `NouvelleDepenseSchema`, `DepenseSchema`, `PretBienSchema`, `PretEnregistreSchema`, `EtatArgentSchema`, `occurrencesDuMois`            |
| `src/pret.ts`          | `tableauDuPret`, `echeanceDuMois`, `capitalRestantDu`, `mensualiteDuPret`, `finDuPret` (via le moteur)                                 |
| `src/argent.ts`        | `argentDuMois`, `argentDeLAnnee`, `courbeDesMois`, `cashflowReel` : totaux, dépenses par catégorie, par bien                           |
| `package.json`         | dépendance `@loupe/moteur`                                                                                                             |

### `apps/comptes`

| Fichier                                    | Rôle                                                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `migrations/0007_gestion_depenses.sql`     | `gestion_depense`, `gestion_pret`, index `userId` et `bienId`                                                            |
| `scripts/migration.ts`                     | `MIGRATIONS` + 0007 ; dépôt `argent` dans `compilerMigration`                                                            |
| `src/gestion/argent/depot.ts`              | `DepotArgent`, `ErreurArgent` (`INTROUVABLE`, `LIMITE_ATTEINTE`), `estTableArgentAbsente`                                |
| `src/gestion/argent/depot-d1.ts`           | lectures et écritures : insertion conditionnelle (compte sous la limite, bien du compte), prêt en `insert … on conflict` |
| `src/gestion/argent/lignes.ts`             | lignes D1 → schémas                                                                                                      |
| `src/gestion/argent/routes.ts`             | `GET /argent`, `GET/POST /depenses`, `PATCH/DELETE /depenses/:id`, `GET/PUT/DELETE /biens/:id/pret`, `onError`           |
| `src/gestion/routes.ts`                    | une ligne de montage ; l'export ajoute dépenses et prêts s'ils sont disponibles                                          |
| `src/dependances.ts`, `src/erreurs.ts`     | `argent: DepotArgent` ; code `DEPENSES_INDISPONIBLE`                                                                     |
| `scripts/serveur-node.ts`, `tests/aide.ts` | dépôt branché                                                                                                            |

### `apps/web`

| Fichier                                                                   | Rôle                                                                                                                                                                   |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/gestion/argent/{types,reseau,memoire}.ts`                            | `ClientArgent`, codes, client réseau revalidé par Zod, client mémoire aux règles de l'API                                                                              |
| `src/gestion/argent/ArgentContext.tsx`                                    | `ArgentProvider`, `useArgent()` (statut `anonyme`, `chargement`, `pret`, `indisponible`, `erreur`)                                                                     |
| `src/gestion/argent/saisie-depense.ts`, `saisie-pret.ts`                  | textes du formulaire ↔ schémas, erreurs par champ                                                                                                                      |
| `src/gestion/argent/pret-analyse.ts`                                      | `pretDepuisAnalyse(bien)` : `ProjetSchema` puis `calculerFinancement`                                                                                                  |
| `src/gestion/argent/page.ts`                                              | périodes proposées, lignes du bilan, biens du filtre, prêts à enregistrer                                                                                              |
| `src/ecrans/gerer/argent/`                                                | `Argent.tsx`, `Courbe.tsx`, `Bilan.tsx`, `CarteArgent.tsx`, `CartePret.tsx`, `FormulaireDepense.tsx`, `NouvelleDepense.tsx`, `ModifierDepense.tsx`, `Indisponible.tsx` |
| `src/textes/gerer-argent.ts`                                              | textes, catégories, fréquences, phrases                                                                                                                                |
| `src/gestion/parcours.ts`                                                 | `CHEMIN_ARGENT`, `lienArgent`, `lienNouvelleDepense`, `lienDepense`                                                                                                    |
| `src/gestion/a-faire.ts`, `ecrans/gerer/{AFaire,LoyersDuMois}.tsx`        | action `pret` (« Enregistrer le prêt de … »)                                                                                                                           |
| `src/coque/SectionGerer.tsx`, `src/App.tsx`, `ecrans/gerer/FicheBien.tsx` | ligne « Argent » (icône `Wallet`), routes et fournisseur, carte Argent                                                                                                 |
| `e2e/ecrans-gerer.ts`, `e2e/reponses-gestion.ts`, `e2e/argent.spec.ts`    | écrans de référence, réponses simulées, parcours                                                                                                                       |

## 5. Flux

```
Fiche du bien ─ « Ajouter une dépense » ─▶ /gerer/depenses/nouvelle?bien=…&retour=/gerer/biens/…
  FormulaireDepense ─ lireDepense (saisie pure) ─▶ useArgent().ajouterDepense
    ─▶ POST /api/gestion/depenses ─ acces (session, Origin) ─ NouvelleDepenseSchema
       ─ depot : bien du compte ? (404) ─ insert … where count < 2000 (409 LIMITE_ATTEINTE)
    ◀─ Depense ─ contexte ajoute la dépense ─ navigate(retour validé)
Argent / CarteArgent ─ argentDuMois(donnees de gestion + dépenses + prêts, période, bien ?) ─ rendu
```

## 6. Codes

| Serveur                 | HTTP | Web            | Phrase                                                                    |
| ----------------------- | ---- | -------------- | ------------------------------------------------------------------------- |
| `DEPENSES_INDISPONIBLE` | 503  | `indisponible` | « Bientôt disponible : le suivi de l'argent arrive dans quelques jours. » |
| `LIMITE_ATTEINTE`       | 409  | `limite`       | « Tu as atteint 2 000 dépenses : supprime les plus anciennes. »           |
| `INTROUVABLE`           | 404  | `introuvable`  | « Cette dépense n'existe plus. »                                          |

## 7. Vérifications avant de coder

- [x] Migration additive seulement ; numéro 0007 réservé par la fiche de session.
- [x] Aucune route existante ne lit les nouvelles tables (l'export les lit dans un `try` dédié qui ne relance que « table absente »).
- [x] Cascade : suppression du compte et d'un bien → dépenses et prêt supprimés (testé).
- [x] Isolement : chaque requête filtre par `userId` ; bien d'un autre compte → 404 (testé pour chaque route).
- [x] Journaux : chemin seulement, jamais de montant ni de libellé.
- [x] Fichiers ≤ 300 lignes ; calcul pur à 100 % ; `@loupe/moteur` sans I/O.

## Auto-revue (checkpoints validés par Claude, Pierre dort)

- **Découverte** : périmètre de la fiche repris tel quel ; différés de prêt écartés (non demandés, le prêt proposé les ignore et le dit dans le rapport) ; « À faire » limité au prêt à enregistrer, seule chose qui manque vraiment au calcul.
- **Stories** : sept, dont les deux clics comptés (dépense depuis la fiche, depuis Argent ; prêt d'un clic) et la preuve « base à 0006 ».
- **Architecture** : tables latérales et sous-routeur = la règle de la nuit ; `GET /argent` ajouté aux routes proposées pour éviter N requêtes ; cash-flow sur la date d'encaissement (choix « réel » assumé, écrit dans la page) ; dépendance au moteur plutôt qu'une copie de formule.
