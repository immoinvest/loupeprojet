# Architecture — `apps/worker` : extraction LLM (`POST /extract`)

```
src/extraction/
├── contrat.ts       RequeteExtractionSchema (texte 40–8 000 car.), NOMS_CHAMPS (20 champs), normaliserChamps (un schéma Zod par champ ; hors contrat → null + rejetes)
├── prompt.ts        VERSION_PROMPT, instructions (français, « n'invente rien, ne calcule rien »), normaliserTexte, messagesPour
├── fournisseur.ts   Extracteur (contrat), extracteurChat (POST « chat completions », json_object, température 0, délai 25 s), extraireJson, URL_OPENROUTER, MODELE_DEFAUT
├── extraire.ts      creerExtraction : validation → clé de cache (modèle + version + texte) → cache KV 30 j → fournisseur → normalisation → réponse
└── index.ts
src/http.ts          repondre, lireCache, ecrireCache, limiterDebit — partagés par le proxy et l'extraction
```

## Contrat HTTP

`POST /extract` — corps `{ "texte": "…" }` (40 à 8 000 caractères) → `200 { champs, rejetes, modele, obtenuLe }`, en-têtes `X-Loupe-Cache: HIT|MISS` et `Cache-Control: no-store`.

`champs` : `prix, surface, pieces, chambres, etage, ascenseur, dpe, ges, codePostal, ville, annee, chargesCoproMois, taxeFonciere, honorairesAgence, meuble, travaux, lotsCopro, coproEnProcedure, loyerActuel, chauffage` — chaque valeur est du type attendu ou `null`. `rejetes` : les noms des champs renvoyés par le modèle mais hors contrat (écartés).

Erreurs : `400 PARAMETRES_INVALIDES` (`details.champs` : `corps` ou `texte`), `503 EXTRACTION_INDISPONIBLE` (pas de clé, ou clé refusée par le fournisseur), `503 AMONT_SATURE` (quota du fournisseur), `502 AMONT_INDISPONIBLE`, `502 AMONT_INVALIDE` (réponse illisible ou hors contrat), `429 TROP_DE_REQUETES` (10 lectures/min/IP).

## Décisions

- **Un connecteur, plusieurs fournisseurs** : `LLM_URL` (défaut OpenRouter), `LLM_MODELE` (défaut `nvidia/nemotron-3-super-120b-a12b:free`), secret `OPENROUTER_API_KEY`. Sans clé, `dependancesDepuisEnv` met `extracteur` à `null` : la route répond 503 et `/health` affiche `extraction: null`.
- **Rien du texte ne sort du chemin requête → fournisseur** : ni cache en clair (la clé de cache est une empreinte), ni journal (noms de champs et statuts seulement), ni navigateur (`no-store`).
- **Tolérance de lecture** : `extraireJson` retire les blocs `<think>` et les clôtures de code, isole le premier objet JSON ; la normalisation champ par champ garde le bon et écarte le reste.
- **Cache 30 jours** : même texte normalisé, même modèle, même version de prompt → même réponse ; changer le prompt incrémente `VERSION_PROMPT`.

## Tests

`tests/extraction.test.ts` : contrat (coercition, rejets, non-objet), prompt, `extraireJson`, route (MISS/HIT/expiration, 400, 503, erreurs fournisseur, champs rejetés, limite dédiée, CORS POST), fournisseur (requête envoyée, en-têtes, statuts, journal sans secret ni texte), dépendances (clé absente/vide/présente, modèle réglé, URL invalide). Couverture 100 % sur `src/**`.
