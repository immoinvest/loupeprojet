# Architecture — Enrichissement marché (Worker `GET /marche` + `apps/web/src/enrichissement`)

```
apps/worker/src/
├── donnees/lecteur.ts     LecteurDonnees { lireJson } : lecteurR2 (binding DONNEES), lecteurMemoire (tests)
└── marche/
    ├── fichiers.ts        schémas de lecture tolérants des fichiers publiés (communes, index DVF, loyers, zonage, courant),
    │                      departementDe, millesimesDvfCandidats
    ├── assembler.ts       pur : resoudreCommune (arrondissement par code postal), indicateurPour (loyer par taille),
    │                      assemblerMarche (arrondissement puis commune parente ; source citée seulement si une valeur en vient)
    ├── route.ts           GET /marche : validation, cache KV 24 h, lectures R2 en parallèle, panne → pas de cache
    └── index.ts

apps/web/src/
├── enrichissement/
│   ├── contrat.ts         schémas Zod des réponses du Worker (/extract, /proxy/geocodage, /marche)
│   ├── client.ts          ClientWorker (extraire, geocoder, marche), clientWorker(base, fetch), clientHorsLigne, urlWorker
│   ├── lecture.ts         lireAnnonce (IA puis règles), fusionnerChamps
│   ├── marche.ts          marcheDepuisReponse (→ bloc `marche` du moteur + provenance), enrichirSaisie (géocodage → marché)
│   └── index.ts
├── coque/ClientWorker.tsx contexte React : le client du Worker (hors ligne par défaut)
├── annonces/construire.ts construireProjet(saisie, id, enrichi?) : ajoute `marche` et sa provenance
├── ecrans/NouveauProjet.tsx « Lire le texte » → lireAnnonce ; création → enrichirSaisie puis construireProjet
└── App.tsx                App : client de production (`VITE_WORKER_URL` ou le Worker déployé) ; AppEnMemoire : hors ligne sauf `client`
```

## Contrat `GET /marche`

Paramètres : `codeInsee` (5 chiffres, ou 2A/2B + 3 chiffres), `codePostal` (facultatif, désigne l'arrondissement de Paris, Lyon, Marseille), `type` (`appartement` par défaut, ou `maison`), `pieces` (facultatif : T1-T2 ou T3 et plus pour le loyer).

Réponse `200` : `{ codeInsee, commune, departement, dvf, loyer, zone, sources, obtenuLe }`

- `dvf` : `{ ventes, medianeM2, q1M2, q3M2, type, fenetre: { debut, fin }, millesime, codeInsee }` ou `null` ;
- `loyer` : `{ loyerM2, basM2, hautM2, maille, observations, indicateur, millesime, chargesComprises: true }` ou `null` ;
- `zone` : `Abis`, `A`, `B1`, `B2`, `C` ou `null` ;
- `sources` : nom, URL, licence et mention des jeux dont une valeur est issue.

Erreurs : `400 PARAMETRES_INVALIDES`, `429 TROP_DE_REQUETES`. Un référentiel absent ne fait jamais échouer la route : la valeur vaut `null`.

## Décisions

- **Le Worker lit R2, pas le navigateur** : le bucket reste privé (juridiction UE) et une réponse assemblée pèse moins d'1 Ko au lieu de quatre fichiers de 15 à 55 Ko.
- **Schémas de lecture recopiés, pas importés** de `data/src/schemas` (imports `.ts` natifs incompatibles avec la configuration du Worker) et volontairement tolérants : un champ ajouté côté données ne casse rien, un champ attendu qui change fait tomber la valeur à `null` avec `donnees.invalides` au journal.
- **Maille** : arrondissement si le code postal le désigne, commune sinon, commune parente en repli (zonage publié à la commune seulement). Le rayon de 300 à 800 m viendra des CSV de ventes.
- **Millésime DVF** : `dvf/courant.json` quand il existe (passe France entière), sinon l'année en cours et les deux précédentes pour le département.
- **Cache** : 24 h par jeu de paramètres ; aucune mise en cache si une lecture R2 a échoué, pour ne pas figer une panne.
- **Web hors ligne par défaut** : `AppEnMemoire` et le contexte sans fournisseur utilisent `clientHorsLigne` ; les tests n'appellent jamais le réseau, et une panne du Worker ramène exactement le comportement d'avant (lecture par règles, projet sans marché).
- **Loyer de référence hors charges** = loyer d'annonce ANIL × 0,92 (spécification : −8 %) ; provenance `anil`. Médiane et quartiles DVF : provenance `dvf`.

## Tests

- Worker `tests/marche.test.ts` : route (Marseille par arrondissement, `courant.json`, maison sans loyer, rien de publié, paramètres, fichier hors contrat, panne R2, limite de débit), assemblage (résolution de commune, indicateurs, commune absente de l'index), lecteurs, binding de production. Couverture 100 %.
- Web `tests/enrichissement.test.ts` : adresse du Worker, client (requêtes envoyées, codes d'échec, hors ligne), lecture IA ou règles, conversion du marché, enrichissement et `construireProjet` ; `tests/nouveau-projet-enrichi.test.tsx` : parcours complet avec un faux Worker (lecture par l'IA, projet créé avec la médiane de l'arrondissement, titre « Le prix est bon »). Couverture 100 % sur `src/enrichissement` et `src/annonces`.
