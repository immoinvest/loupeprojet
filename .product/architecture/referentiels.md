# Architecture : Référentiels (`data/`, `@loupe/data`)

Scripts de pré-agrégation des données publiques, exécutés par la GitHub Action `referentiels.yml` (mensuelle ou manuelle) puis publiés sur le bucket R2 `loupe-data`. Le navigateur les lira via le Worker `/proxy` (feature `enrichissement-marche`). Sources, licences et formats : `data/SOURCES.md`.

```
data/
├── package.json               @loupe/data ; scripts referentiels (node --experimental-strip-types src/cli.ts), typecheck, test, test:coverage
├── tsconfig.json              étend tsconfig.base ; noEmit ; allowImportingTsExtensions (imports en .ts, exigés par Node)
├── vitest.config.ts           projet « data », tests/**/*.test.ts, couverture 100 % sur src/ (sauf cli.ts et index.ts)
├── SOURCES.md                 fiche de chaque source : URL, licence, millésime, transformations
├── sources/usure/<AAAA>-T<n>.json   saisies trimestrielles des seuils de l'usure (Banque de France)
└── src/
    ├── cli.ts                 point d'entrée : arguments → contexte réel → exécution des sources, codes 0/1/2
    ├── cli/arguments.ts       parseArgs ; --source (ou tout), --departement (répétable), --sortie, --millesime-dvf, --annee-rei, --aide
    ├── commun/
    │   ├── contexte.ts        Contexte { recuperer (fetch), pause, horloge, journal, dossierSortie } injecté partout
    │   ├── csv.ts             AnalyseurCsv incrémental (RFC 4180, BOM, CRLF), lireCsv (flux → enregistrements), champ
    │   ├── flux.ts            decoderTexte (UTF-8 / Windows-1252 en continu), depuisMorceaux, collecter
    │   ├── telechargement.ts  ouvrir (3 tentatives, 5xx et erreurs réseau), texte / JSON / flux gzip, existe (HEAD)
    │   ├── journal.ts         une ligne JSON par événement sur stderr, annotations ::warning:: / ::error:: sous GitHub
    │   ├── fichiers.ts        ecrireTexte, ecrireJson (compact), lireJson, listerFichiers
    │   ├── statistiques.ts    quantile (méthode 7), quartiles, arrondir
    │   ├── dates.ts           dateIso, ajouterJours, decalerMois, debutFenetre, trimestreDe, debutTrimestre, trimestreSuivant
    │   ├── departements.ts    les 101 codes, estDepartement, departementDeCommune
    │   └── listes.ts          elementA (indexation sûre), objetTrie (clés triées)
    ├── schemas/               Zod : meta (Source, Meta, MillesimeCourant, codes), dvf, loyers, taxe-fonciere, zonage, usure, communes
    └── sources/
        ├── executer.ts        EXECUTEURS (adaptation des arguments à chaque source), executerSources
        ├── courant.ts         écrit <prefixe>/courant.json { genereLe, millesime }
        ├── dvf/               constantes (URL, filtres, fenêtre 24 mois, 3 dossiers annuels), mutations (regroupement contigu),
        │                      vente (règles d'exclusion), fenetre, statistiques (index), csv-sortie, source (orchestration)
        ├── loyers/            constantes (4 ressources data.gouv, millésime 2025), transformer (décimales, maille), source
        ├── taxe-fonciere/     constantes (API OFGL, variables E12…F22), annee (facette), transformer (somme, décimal), source
        ├── zonage/            constantes, ressource (CSV national le plus récent via l'API data.gouv), transformer, source
        ├── usure/             constantes (dossier des saisies), transformer (contrôles, publication, perime), source
        └── communes/          constantes (API Géo, arrondissements 75/69/13), transformer, source
tests/
├── aides/faux-contexte.ts     faux fetch (répondeur URL → Response, 404 par défaut), pause instantanée, horloge fixe, journal capturé
├── fixtures/                  extraits réels : dvf/2A-2023..2025.csv, loyers/*.csv (Windows-1252), taxe-fonciere/rei-2A-extrait.csv (BOM),
│                              zonage/*.csv + jeu-data-gouv.json, communes/*.json
└── commun/, schemas/, sources/<source>/, cli/     un test par module ; 130 tests, couverture 100 %
```

## Flux d'une passe

`cli.ts` → `analyserArguments` → `contexteReel(dossierSortie)` → `executerSources` → pour chaque source : téléchargement en flux (`telechargerTexteEnFlux` gzip / encodage) → `lireCsv` → transformation pure (module `transformer.ts` ou `vente.ts`) → validation Zod du fichier publié → `ecrireJson` / `ecrireTexte` dans `data/dist/<prefixe>/…` → journal. L'Action synchronise ensuite `data/dist/<prefixe>/` vers `s3://loupe-data/<prefixe>/`.

## Patterns

- **Contexte injecté** : tout ce qui touche au réseau, au temps ou au disque de sortie passe par `Contexte`. Les tests fournissent un faux `fetch` nourri par des fixtures ; aucune requête réseau, aucun `Date.now()` caché. Pas de paramètre par défaut sur ces dépendances : les branches « valeur par défaut » seraient impossibles à couvrir.
- **Transformation pure séparée de l'orchestration** : `vente.ts`, `statistiques.ts`, `transformer.ts` ne connaissent ni fichiers ni réseau ; `source.ts` enchaîne téléchargement, transformation, validation et écriture.
- **Flux de bout en bout pour les gros fichiers** : octets → texte décodé → lignes CSV → mutations → ventes, sans jamais charger un CSV DVF en mémoire ; seules les ventes retenues (quelques dizaines de milliers par département) sont conservées avant l'écriture.
- **Zod à la sortie** : chaque fichier publié est `parse`é par son schéma avant écriture ; un format qui dérive casse la génération, pas l'application.
- **Indexation sûre** : `elementA` remplace `liste[i] ?? repli` pour éviter des branches de repli jamais exécutées (couverture 100 % des branches exigée).
- **Journal structuré** : jamais `console` ; une ligne JSON par événement, annotations GitHub pour les avertissements (trimestre d'usure manquant, dossier DVF absent, département sans données).

## Décisions locales

- **ADR-D1 : exécution TypeScript native.** `node --experimental-strip-types src/cli.ts`, sans étape de build ni dépendance (`tsx`) ; imports relatifs avec extension `.ts`, pas de syntaxe non effaçable (enums, paramètres-propriétés). Fonctionne sur Node 22.6+ et 24.
- **ADR-D2 : publication par l'API S3 de R2** (`aws s3 sync`, préinstallé sur les runners) plutôt que `wrangler r2 object put` : environ 34 000 fichiers de commune par millésime DVF, soit plus de dix heures à une commande par objet. `--delete` seulement sur une passe France entière. Secrets : `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_ACCOUNT_ID`.
- **ADR-D3 : seuils de l'usure saisis à la main** dans `data/sources/usure/`, faute de source ouverte automatisable ; contrôle arithmétique (seuil = taux moyen + un tiers) et drapeau `perime`.
- **ADR-D4 : fenêtre DVF par département** (24 mois jusqu'à la dernière vente connue du département) et millésime = dossier annuel le plus récent, détecté une fois par passe ; les ventes sans coordonnées restent dans le CSV (colonnes vides).
- **ADR-D5 : pointeurs `courant.json`** pour DVF, loyers et taxe foncière : l'application lit le millésime au lieu de le deviner ; le fichier DVF n'est écrit que sur une passe complète.
