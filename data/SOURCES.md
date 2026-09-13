# Sources des référentiels Loupe

Chaque source est lue par `npm run referentiels -w data -- --source <nom> [--departement <code>]`, transformée en petits fichiers par département ou par commune dans `data/dist/`, puis publiée sur le bucket R2 `deklic-data` par la GitHub Action `.github/workflows/referentiels.yml` (cron mensuel, le 2 à 03:30 UTC, ou lancement manuel). Tous les fichiers publiés portent `genereLe` (date de génération), `millesime` (date ou période de la donnée source) et `source` (nom, URL, licence, mention imposée), validés par les schémas Zod de `data/src/schemas/`. L'application affichera la source et la licence de chaque donnée.

URL et formats vérifiés le 13 septembre 2026 par l'API data.gouv.fr (`https://www.data.gouv.fr/api/1/datasets/<slug>/`) et par lecture des fichiers.

## Vue d'ensemble

| Nom CLI         | Donnée                                    | Producteur                                               | Rythme source               | Fichiers publiés                                                                                                        |
| --------------- | ----------------------------------------- | -------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `dvf`           | Ventes de logements géolocalisées         | DGFiP, retraitement Etalab                               | semestriel (avril, octobre) | `dvf/<millesime>/<codeInsee>.csv`, `dvf/<millesime>/index/<dep>.json`, `dvf/<millesime>/index.json`, `dvf/courant.json` |
| `loyers`        | Loyers d'annonce par commune              | ANIL, DHUP (Groupe SeLoger, leboncoin)                   | annuel                      | `loyers/<millesime>/<dep>.json`, `loyers/courant.json`                                                                  |
| `taxe-fonciere` | Taux de taxe foncière (bâti)              | DGFiP (REI), rediffusion OFGL                            | annuel                      | `taxe-fonciere/<annee>/<dep>.json`, `taxe-fonciere/courant.json`                                                        |
| `zonage`        | Zonage A bis / A / B1 / B2 / C            | Ministère de la Transition écologique                    | à chaque arrêté             | `zonage/<dep>.json`                                                                                                     |
| `usure`         | Seuils de l'usure des crédits immobiliers | Banque de France (avis au Journal officiel)              | trimestriel                 | `usure/<trimestre>.json`, `usure/courant.json`                                                                          |
| `communes`      | Communes, codes postaux, population       | API Géo (Etalab) sur le code officiel géographique INSEE | continu                     | `communes/<dep>.json`                                                                                                   |

`<dep>` vaut `01` à `95`, `2A`, `2B`, `971` à `976` ; `<codeInsee>` est le code commune INSEE (arrondissement municipal pour Paris, Lyon et Marseille dans les DVF et les loyers ; commune entière pour la taxe foncière et le zonage, d'où `communeParente` dans le fichier communes).

## DVF géolocalisées

- **Jeu** : « Demandes de valeurs foncières géolocalisées », `https://www.data.gouv.fr/datasets/demandes-de-valeurs-foncieres-geolocalisees` (Etalab, à partir des DVF de la DGFiP).
- **Fichiers lus** : `https://files.data.gouv.fr/geo-dvf/latest/csv/<annee>/departements/<dep>.csv.gz` (redirection vers un stockage S3 à suivre). Trois dossiers annuels sont lus par département, du plus récent (détecté par une requête HEAD, ou imposé par `--millesime-dvf`) vers le passé, pour couvrir 24 mois : le dossier de l'année en cours n'apparaît qu'en octobre, avec le premier semestre.
- **Licence** : Licence Ouverte 2.0.
- **Millésime** : année du dossier le plus récent (par exemple `2025` après la livraison d'avril 2026 qui couvre l'année 2025). Publication semestrielle des DVF : avril et octobre.
- **Format d'origine** : CSV UTF-8, virgule, 40 colonnes, une ligne par local et par lot d'une mutation ; les lignes d'une mutation sont contiguës.
- **Transformations** :
  1. Regroupement des lignes par `id_mutation` (un identifiant qui réapparaît plus bas est écarté et compté comme `rupture`).
  2. Une mutation devient une vente de logement si : `nature_mutation` = « Vente » (les ventes en l'état futur d'achèvement, échanges, adjudications, expropriations et terrains à bâtir sont écartés : le comparable est le marché de l'ancien) ; une seule `valeur_fonciere` non nulle (plusieurs dispositions = prix ambigu) ; aucun local industriel ou commercial ; exactement un logement (maison ou appartement) après suppression des lignes répétées à l'identique, les dépendances étant ignorées ; surface réelle bâtie entre 9 et 1 000 m² ; prix au m² entre 300 et 40 000 €.
  3. Fenêtre de 24 mois se terminant à la dernière vente connue du département, bornes incluses.
  4. `dvf/<millesime>/<codeInsee>.csv` : `date,prix,surface,type,pieces,lat,lon` (type `appartement` ou `maison`, coordonnées WGS-84 du centre de la parcelle, vides quand la parcelle n'est pas géocodée : la vente compte alors pour la commune, pas pour un rayon), ventes triées par date.
  5. `dvf/<millesime>/index/<dep>.json` : par commune et par type, `ventes`, `medianeM2`, `q1M2`, `q3M2` (prix au m² arrondis à l'euro, quartiles par interpolation linéaire, méthode 7 de Hyndman et Fan) et la `fenetre` du département.
  6. `dvf/<millesime>/index.json` : fusion nationale des index, écrite seulement quand la passe couvre les 101 départements. `dvf/courant.json` : `{ genereLe, millesime }`, également écrit sur une passe complète.
- **Journal** : motifs d'exclusion comptés par département (`nature`, `prix`, `local_commercial`, `logements`, `surface`, `prix_m2`, `date`, `rupture`).

## Carte des loyers ANIL

- **Jeu** : « "Carte des loyers" - Indicateurs de loyers d'annonce par commune en 2025 », `https://www.data.gouv.fr/datasets/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2025` (Ministère de la Transition écologique, ANIL, DHUP).
- **Fichiers lus** (identifiants de ressource stables, redirigés vers la dernière version) : appartement `https://www.data.gouv.fr/fr/datasets/r/55b34088-0964-415f-9df7-d87dd98a09be`, appartement 1 ou 2 pièces `…/r/14a1fe11-b2d1-49b3-9f6b-83d12df9482c`, appartement 3 pièces ou plus `…/r/5e3b28a4-cf56-43a3-ae79-43cceeb27f8c`, maison `…/r/129f764d-b613-44e4-952c-5ff50a8c9b73`.
- **Licence** : réutilisation libre sous réserve de la mention « Estimations ANIL, à partir des données du Groupe SeLoger et de leboncoin » (champ `source.mention` de chaque fichier publié, à afficher).
- **Millésime** : `2025` (loyers au 3ᵉ trimestre 2025, géographie des communes au 1ᵉʳ janvier 2025). Un nouveau jeu paraît chaque fin d'année sous un nouveau slug : mettre à jour `MILLESIME_LOYERS` et les quatre URL dans `data/src/sources/loyers/constantes.ts`.
- **Format d'origine** : CSV Windows-1252, point-virgule, champs entre guillemets, virgule décimale ; colonnes `INSEE_C`, `DEP`, `loypredm2` (loyer prédit €/m² charges comprises), `lwr.IPm2` et `upr.IPm2` (intervalle de prédiction), `TYPPRED` (`commune` ou `maille`), `nbobs_com` (annonces observées dans la commune).
- **Transformations** : conversion des décimales, arrondi à 2 décimales, `maille: true` quand l'indicateur est emprunté à une maille plus large (aucune annonce dans la commune : confiance faible), `observations` = `nbobs_com`. Sortie `loyers/2025/<dep>.json` : par commune, `appartement`, `appartementT1T2`, `appartementT3Plus`, `maison`, chacun `{ loyerM2, basM2, hautM2, maille, observations }`. Les loyers sont charges comprises, pour des biens loués vides : l'application applique ses propres corrections (hors charges, meublé, colocation). Mayotte (976) est absente de la source.

## Taux de taxe foncière (REI)

- **Jeu** : « (REI) Fiscalité directe locale », rediffusion par l'Observatoire des finances et de la gestion publique locales du fichier de recensement des éléments d'imposition de la DGFiP : `https://data.ofgl.fr/explore/dataset/rei/` (API Opendatasoft `https://data.ofgl.fr/api/explore/v2.1/catalog/datasets/rei`). Jeu d'origine : `https://www.data.gouv.fr/datasets/impots-locaux-fichier-de-recensement-des-elements-dimposition-a-la-fiscalite-directe-locale-rei-4` (Ministères économiques et financiers).
- **Requête** : export CSV filtré par département, exercice, catégorie « Taux » et variables `E12` (commune), `E22` (syndicats et organismes assimilés), `E32` (intercommunalité), `E52gGEMAPI` (GEMAPI), `E52`, `E52A`, `E52TASA` (taxes spéciales d'équipement), `F22` (TEOM, taux plein). L'exercice le plus récent est lu sur la facette `annee`, ou imposé par `--annee-rei`.
- **Licence** : Licence Ouverte 2.0 (données DGFiP).
- **Millésime** : exercice REI (`2025` au 13/09/2026).
- **Format d'origine** : CSV UTF-8 avec BOM, point-virgule, format long (une ligne par variable et par commune), taux en pourcentage.
- **Transformations** : somme des variables par commune, conversion en décimal arrondi à 5 décimales (`44,54 %` → `0.4454`). Sortie `taxe-fonciere/<annee>/<dep>.json` : par commune `commune`, `syndicats`, `intercommunalite`, `gemapi`, `tse`, `total` (somme des cinq postes supportés par le propriétaire) et `teom` à part quand elle existe (récupérable sur le locataire, hors total). Paris, Lyon et Marseille sont publiés au niveau de la commune (`75056`, `69123`, `13055`).

## Zonage ABC

- **Jeu** : « Liste des communes selon le zonage ABC », `https://www.data.gouv.fr/datasets/liste-des-communes-selon-le-zonage-abc` (Ministère de la Transition écologique).
- **Fichier lu** : le CSV national « Liste ensemble des communes - Zonage ABC en vigueur … » le plus récent, retrouvé dans les métadonnées du jeu (`https://www.data.gouv.fr/api/1/datasets/liste-des-communes-selon-le-zonage-abc/`) car son identifiant change à chaque arrêté. Au 13/09/2026 : arrêté du 23 juin 2026, en vigueur le 26 juin 2026.
- **Licence** : Licence Ouverte 2.0.
- **Millésime** : date d'entrée en vigueur lue dans l'en-tête de la colonne de zone (« Zonage ABC en vigueur depuis le 26 juin 2026 » → `2026-06-26`) ; à défaut, date de génération avec avertissement.
- **Format d'origine** : CSV UTF-8, point-virgule, colonnes `CODGEO`, `DEP`, `LIBGEO`, zone.
- **Transformations** : zones normalisées (`A bis` → `Abis`), zones inconnues écartées et comptées. Sortie `zonage/<dep>.json` : par commune, `Abis`, `A`, `B1`, `B2` ou `C`.

## Seuils de l'usure

- **Situation** : aucune source ouverte exploitable automatiquement. Le jeu `seuil-de-lusure` de data.economie.gouv.fr est vide depuis 2018 ; le portail Webstat de la Banque de France n'expose que les métadonnées des séries sans clé d'API ; la page `https://www.banque-france.fr/fr/statistiques/taux-et-cours/taux-dusure-<aaaa>-q<n>` refuse les robots.
- **Procédé retenu** : saisie trimestrielle dans `data/sources/usure/<AAAA>-T<n>.json` (trimestre, date d'application, date de publication, source, taux effectifs moyens et seuils des crédits immobiliers aux particuliers : taux fixe de moins de 10 ans, de 10 à moins de 20 ans, de 20 ans et plus, taux variable, prêts relais), en décimal. Le script vérifie que le trimestre correspond à la date d'application et que chaque seuil vaut le taux effectif moyen augmenté d'un tiers, arrondi au centième de point (article L. 314-6 du code de la consommation).
- **Saisies présentes** : `2026-T2` (page BdF du 27 mars 2026, applicable au 1ᵉʳ avril 2026) et `2026-T3` (page du 29 juin 2026, applicable au 1ᵉʳ juillet 2026, seuil 5,29 % à 20 ans et plus), relevées le 13/09/2026.
- **Licence** : Banque de France, réutilisation libre avec mention de la source.
- **Sortie** : `usure/<trimestre>.json` pour chaque saisie et `usure/courant.json` = trimestre applicable le plus récent ; `perime: true` et un avertissement dans le journal quand le trimestre du jour n'est pas saisi (rappel : nouvelle saisie fin mars, fin juin, fin septembre, fin décembre). Évolution possible : l'API Webstat (clé gratuite) pour automatiser la relève.

## Communes

- **Source** : API Géo, `https://geo.api.gouv.fr/decoupage-administratif/communes` (Etalab, code officiel géographique INSEE en vigueur). Requêtes : `/departements/<dep>/communes?fields=nom,code,codesPostaux,population,codeEpci&format=json` et, pour Paris, Lyon et Marseille, `/communes?codeDepartement=<dep>&type=arrondissement-municipal&fields=nom,code,codesPostaux,population&format=json`.
- **Licence** : Licence Ouverte 2.0.
- **Millésime** : date de génération (l'API sert le code officiel géographique courant).
- **Transformations** : réponses validées par Zod ; population et EPCI omis quand l'API ne les donne pas ; arrondissements municipaux ajoutés avec `communeParente` (`75056`, `69123`, `13055`). Sortie `communes/<dep>.json` : par code INSEE `{ nom, codesPostaux, population?, epci?, communeParente? }`.

## Publication sur R2

`aws s3 sync data/dist/<prefixe>/ s3://deklic-data/<prefixe>/ --endpoint-url https://<compte>.r2.cloudflarestorage.com`, préfixe par préfixe, avec `--delete` seulement sur une passe France entière (une passe limitée à un département n'efface rien). Secrets GitHub attendus : `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (jeton R2 « Object Read & Write » sur le bucket) et `CLOUDFLARE_ACCOUNT_ID`. Sans ces secrets, l'Action génère les fichiers et s'arrête avec un avertissement. Le choix de l'API S3 plutôt que de `wrangler r2 object put` tient au volume : environ 34 000 fichiers de commune par millésime DVF, qu'une commande par objet mettrait plus de dix heures à publier.
