# Fiche de session — `referentiels` : les données publiques pré-agrégées

Tronc commun : `.product/sessions/_commun.md` (contexte, autorisations, règles de travail en parallèle, gates).

## Objectif

Les données publiques qui n'ont pas d'API exploitable en direct sont **pré-agrégées chaque mois** par une GitHub Action et publiées sur Cloudflare R2 en petits fichiers par département ou par commune, que le navigateur lira directement (via le Worker `/proxy` plus tard). Sources listées dans `.product/functional-spec.md` (section sources) : DVF géolocalisées, carte des loyers ANIL, taux de taxe foncière (REI / OFGL), zonage A/B/C, taux de l'usure (Banque de France), communes (geo.api.gouv.fr).

## Périmètre

1. **Workspace `data/`** (`@loupe/data`, TypeScript, Node 22) : un script par source, exécutables par `npm run referentiels -w data -- --source <nom> [--departement 13]`, sortie dans `data/dist/` (ignoré par git). Traitement **en flux** (les CSV DVF font plusieurs centaines de Mo) ; jamais tout en mémoire.
2. **Formats Loupe validés par Zod** (`data/src/schemas/`), pensés pour le navigateur :
   - `dvf/<annee>/<codeInsee>.csv` : ventes de logements des 24 derniers mois (date, prix, surface, type appartement/maison, pièces, lat, lon) et `dvf/<annee>/index.json` (médiane €/m², Q1, Q3, nombre de ventes par commune et par type).
   - `loyers/<millesime>/<departement>.json` : par commune INSEE, loyer €/m² appartement et maison (ANIL).
   - `taxe-fonciere/<annee>/<departement>.json` : par commune, taux TFPB commune + intercommunalité + syndicats + taxe GEMAPI le cas échéant.
   - `zonage/<departement>.json` : zone A bis / A / B1 / B2 / C par commune.
   - `usure/courant.json` et `usure/<trimestre>.json` : seuils de l'usure par durée de prêt.
   - `communes/<departement>.json` : nom, codes postaux, population.
3. **`data/SOURCES.md`** : pour chaque source, l'URL exacte du jeu de données (vérifie-la sur data.gouv.fr avec l'API `https://www.data.gouv.fr/api/1/datasets/<slug>/` plutôt que de la deviner), la licence, la date de millésime, le format d'origine et les transformations appliquées.
4. **GitHub Action `.github/workflows/referentiels.yml`** : `workflow_dispatch` + cron mensuel ; exécute les scripts puis publie sur R2 avec `wrangler r2 object put` (bucket `loupe-data`), secrets `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID`. Le bucket et les secrets sont à créer par Pierre : écris-lui la marche à suivre exacte dans le rapport final (c'est une action sur son compte, tu ne peux pas la faire).
5. Tests 100 % sur la logique de transformation avec de **petits CSV de fixtures** (`data/tests/fixtures/`) ; aucune requête réseau dans les tests.

## Hors périmètre (ne pas toucher)

`apps/*`, `packages/moteur`, `.github/workflows/ci.yml` (ajoute un nouveau workflow, ne modifie pas celui-ci). Le chargement de ces fichiers par l'application (feature `enrichissement-marche`) n'est pas dans cette session : documente seulement les chemins et les formats.

## Points d'attention

- Volume : DVF géolocalisées = un CSV par département et par année (data.gouv « Demandes de valeurs foncières géolocalisées ») ; filtrer ventes de logements (appartement, maison), une mutation = une ligne par lot → regrouper par mutation avant de calculer le prix au m².
- Les runners GitHub ont 7 Go de RAM et ~14 Go de disque : traiter département par département, supprimer les fichiers temporaires.
- Chaque fichier publié porte la date de génération et le millésime de la source (`genereLe`, `millesime`).
- La licence de chaque source (Licence Ouverte 2.0 en général) doit apparaître dans `SOURCES.md` et sera affichée dans l'application.
