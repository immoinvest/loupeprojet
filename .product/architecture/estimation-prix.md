# Architecture — estimation-prix

Voir la discovery : `.product/features/estimation-prix-discovery.md`.

## Vue d'ensemble

```
data (GitHub Action)            worker /marche/adresse               moteur (navigateur)                web
DVF 2021-2025 ──▶ tendance/<dep>.json ──▶ prix actualisés, tendance ──▶ marche.dvf actualisé ──▶ estimerPrix ──▶ onglet Estimation, Rapport, Méthode
                 (médiane par semestre)   (coefficient par vente)      (+ bien.etat, exterieur)   (état, corrections,
                                                                                                    fourchette, confiance)
```

Le calcul de l'estimation vit dans le moteur : il est pur, testé à 100 %, et se recalcule à chaque modification du bien, sans réseau. Le Worker ne fait que remettre les ventes à la date du jour.

## US-1 — data : tendance DVF par semestre

- `ANNEES_LUES` passe de 3 à 5 : 2021 à 2025. La fenêtre des CSV publiés reste de 24 mois.
- `data/src/sources/dvf/tendance.ts` :
  - `semestreDe(date)` renvoie `AAAA-S1` ou `AAAA-S2` ;
  - `serieDesVentes(ventes, seuil)` renvoie les points `{ periode, ventes, medianeM2 }` des semestres qui comptent au moins `seuil` ventes, triés ;
  - `tendanceDepartement(ventesParCommune)` produit la série du département et celle de chaque commune ayant au moins 2 points, par type de logement.
- Seuil : 20 ventes par semestre (`SEUIL_VENTES_SEMESTRE`).
- Sortie : `dvf/<millésime>/tendance/<département>.json`, schéma `TendanceDvfDepartementSchema` (meta, département, seuil, `departement: { appartement?, maison? }`, `communes: record`).

## US-2 — worker : prix actualisés

- `apps/worker/src/adresse/tendance.ts` :
  - `lireTendance(passe, millesime, codeInsee)` lit le JSON (département déduit du code INSEE : `2A`/`2B`, `97x`, sinon 2 chiffres), validé par Zod ; `null` si absent ;
  - `serieRetenue(tendance, codeInsee, type)` retient la série de la commune si elle finit au même semestre que celle du département, sinon celle du département ;
  - `indiceLisse(points)` calcule une moyenne mobile sur trois semestres, pondérée par le nombre de ventes ;
  - `coefficientPour(indices, date)` : indice du dernier semestre ÷ indice du semestre de la vente. Un semestre manquant prend le plus proche avant, sinon après. Une vente postérieure au dernier point garde 1 ;
  - `resumeTendance(serie)` : zone, période de référence, évolution sur 1 an et sur 2 ans, points avec indice.
- `analyserAdresse(ventes, bien, actualiser?)` : le prix au m² de chaque vente est multiplié par son coefficient avant les statistiques. `VenteProche` gagne `prixM2Actualise` et `coefficient`.
- Réponse `/marche/adresse` : `tendance` (ou `null`) et `VERSION_CONTRAT` = 2.

## US-3 — moteur : estimation

Schéma :

- `bien.etat` : `a_renover | a_rafraichir | bon_etat | renove` (optionnel, bon état supposé).
- `bien.exterieur` : booléen, balcon ou terrasse.
- `marche.dvf.actualiseAu` : `AAAA-S1|S2` (optionnel).
- `projet.estimation.correctionsIgnorees` : codes de corrections désactivées (défaut vide).

Règles `estimation` (2026-09), toutes avec source dans la page Méthode :

- `positionsEtat` : 0,25 / 0,375 / 0,5 / 0,75 ;
- `dpe.appartement` : A .16, B .12, C .06, D 0, E −.04, F −.12, G −.12 ;
- `dpe.maison` : F −.25, G −.25, autres `null` (non publié) ;
- `etage.avecAscenseur` : rdc −.099, 4e et plus +.04 ; `etage.sansAscenseur` : rdc −.096, 3e et plus −.009 ;
- `exterieur` : +.088 ;
- `charges` : repère 26 €/m²/an, borne ±15 % ;
- `margesConfiance` : élevée ±5 %, moyenne ±8 %, faible ±12 % ;
- chemins `aConfirmer` : `estimation.dpe`, `estimation.etage`, `estimation.exterieur`, `estimation.charges`.

`packages/moteur/src/estimation/` :

- `prixSelonPosition(dvf, position)` : interpolation linéaire entre (0,25 ; q1), (0,5 ; médiane), (0,75 ; q3). Sans quartiles, la médiane.
- `corrections(projet, regles)` : liste `{ code: 'dpe'|'etage'|'exterieur', taux }`, puis la charge capitalisée `{ code: 'charges', taux, montant }`, hors corrections ignorées. Les charges ne jouent pas quand elles sont estimées par défaut (provenance `estime`). Le rendement brut local vient du loyer ANIL rapporté à la médiane, sinon du loyer du projet rapporté à son prix.
- `confiance(dvf)` : élevée si au moins 10 ventes à 300 m ou moins, moyenne si au moins 5 ventes à 1 000 m ou moins, faible sinon.
- `estimerPrix(projet, regles)` renvoie `null` sans `marche.dvf`, sinon :
  `{ etat, etatSuppose, prixM2Base, corrections, prixM2Estime, centre, bas, haut, selonEtat{4 états}, confiance, marge, actualiseAu, ecartPrix }`.
- `feuPrix` compare le prix au m² au `prixM2Estime` quand l'estimation existe.
- `Resultats.estimation` est ajouté au schéma de sortie.

## US-4 — web : onglet Estimation

- L'onglet « Adresse » devient « Estimation » ; le chemin `adresse` ne change pas.
- `ecrans/adresse/Estimation.tsx` affiche :
  - la fourchette par état (à rénover → rénové) et le choix de l'état, écrit dans `bien.etat` ;
  - les corrections, avec interrupteur par ligne et source ;
  - le prix estimé, la marge et la confiance ;
  - l'écart au prix affiché.
- `ecrans/adresse/Tendance.tsx` : barres SVG par semestre (aucune dépendance), phrase d'évolution, zone.
- Le tableau des ventes montre le prix brut et le prix actualisé.
- `marcheDepuisReference` ajoute `actualiseAu`.
- Rapport, carte prix : le prix estimé, la fourchette et la confiance ; la jauge montre « à rénover » et « rénové ».
- Hypothèses, groupe « Le bien » : ajout de « État » et « Balcon ou terrasse ».
- Méthode : section « L'estimation du prix », constantes lues dans les règles.

## US-5 — lecture de l'annonce : état et extérieur

- Web `extraireChamps` :
  - `etat` par mots-clés (« à rénover », « travaux à prévoir » ; « à rafraîchir » ; « bon état » ; « rénové », « refait à neuf ») ;
  - `exterieur` (« balcon », « terrasse », « loggia »).
- Worker `/extract` : champs `etat` et `exterieur` au contrat, `VERSION_PROMPT` = 2. Le web les accepte en optionnel.
- Vérifier et `construireProjet` : `etat` et `exterieur` passés au bien avec leur provenance.

## Tests

- data : semestres, séries, seuils, tendance publiée dans la passe DVF.
- worker : lissage, coefficients (manquants, bornes), choix de série, route avec et sans tendance.
- moteur : chaque correction et ses bornes, confiance, positions, feu prix, schéma de sortie. Couverture 100 %.
- web : textes, écran Estimation (état, interrupteurs), Rapport, extraction, Hypothèses.
