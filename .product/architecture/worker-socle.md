# Architecture — `apps/worker` (socle)

```
src/
├── index.ts            point d'entrée Cloudflare : creerApp(dependancesDepuisEnv(env)), construit une fois par isolat
├── app.ts              Hono : cors, GET /health, limite de débit sur /proxy/*, GET /proxy/:service, notFound, onError
├── dependances.ts      Bindings (KV_CACHE, LIMITEUR, ENVIRONNEMENT, ORIGINES_AUTORISEES) → Dependances injectées ; variables validées par Zod
├── erreurs.ts          codes d'erreur (jamais de texte), reponseErreur(statut, code, details), ErreurConfiguration, ErreurAmontInvalide
├── journal.ts          journal structuré (une ligne JSON par événement) ; seul fichier autorisé à écrire sur la console
├── cors.ts             origines autorisées : production, previews *.loupeprojet.pages.dev, localhost, + ORIGINES_AUTORISEES
├── proxy/
│   ├── cache.ts        Cache (lire/ecrire/ttl), cacheKv, cacheMemoire, jsonCanonique, empreinte SHA-256, cleCache
│   ├── debit.ts        LimiteurDebit (contrat du binding Rate Limiting), limiteurMemoire (fenêtre fixe)
│   └── proxy.ts        creerProxy : validation → cache → appel amont (délai, statuts) → normalisation → mise en cache
└── services/
    ├── types.ts        Service (nom, ttl, délai, lireParametres, normaliser) ; definirService ferme les types
    ├── geocodage.ts    Géoplateforme : paramètres q/limit/codePostal, réponse GeoJSON validée, contrat Loupe
    └── index.ts        SERVICES : la liste blanche des services proxifiés
tests/                  aide.ts (banc avec doubles), app.test.ts (routes, CORS, débit, proxy), modules.test.ts
```

## Contrat HTTP

| Route                                        | Réponse                                                                                                                                                                                                                                            |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /health`                                | `{ ok: true, version, environnement }`                                                                                                                                                                                                             |
| `GET /proxy/geocodage?q=&limit=&codePostal=` | `{ service, obtenuLe, donnees: { resultats: [{ libelle, score, lat, lon, precision, cleBan, codeInsee, codePostal, commune }] } }` — en-têtes `X-Loupe-Cache` (`HIT` ou `MISS`), `Cache-Control: public, max-age=3600`                             |
| Erreurs                                      | `{ code, details? }` : 404 `INTROUVABLE` / `SERVICE_INCONNU`, 400 `PARAMETRES_INVALIDES` (`details.champs`), 429 `TROP_DE_REQUETES`, 502 `AMONT_INDISPONIBLE` (`details.statutAmont`) / `AMONT_INVALIDE`, 503 `AMONT_SATURE`, 500 `ERREUR_INTERNE` |

`precision` : `adresse` (numéro), `rue`, `lieu_dit`, `commune`, `inconnue` — pilote le rayon DVF (300 m / 800 m / commune).

## Décisions

- **Injection de dépendances** : `creerApp(deps)` reçoit cache, limiteur, fetcher, horloge, journal, services, origines. Production = `dependancesDepuisEnv(env)` ; tests = doubles en mémoire. Aucun module n'importe de global Cloudflare.
- **Cache** : KV avec `expirationTtl` = TTL du service (géocodage 24 h). Clé `service:sha256(JSON canonique des paramètres validés)` : deux requêtes équivalentes (ordre des paramètres, valeur par défaut) partagent l'entrée. L'enveloppe cachée conserve `obtenuLe`.
- **Limite de débit** : binding Cloudflare `[[ratelimits]]` (60 / 60 s), clé = `CF-Connecting-IP` (`inconnue` à défaut). `/health` et les préparations CORS ne sont pas comptées. Les erreurs du binding remontent en 500 (on préfère l'échec visible à un service sans garde-fou).
- **Amont** : délai `AbortSignal.timeout(delaiMs)`, en-tête `user-agent` identifiant Loupe ; seules les réponses 200 valides sont cachées.
- **Journal** : `console.log`/`console.error` de lignes JSON (Workers Logs, `[observability] enabled = true`). Pas d'IP, pas de paramètres de requête.
- **Ajouter un service** = un fichier dans `services/` avec `definirService({...})` et une entrée dans `SERVICES`. Le contrat Loupe de chaque service sera copié côté web (schéma Zod) dans `enrichissement-marche`.

## Tests

Vitest en environnement Node (`apps/worker/vitest.config.ts`) : `app.request()` de Hono, `Response`/`URL`/`crypto.subtle`/`AbortSignal.timeout` natifs de Node 22. Couverture 100 % lignes/branches/fonctions sur `src/**` (hors `index.ts`), seuil déclaré dans `vitest.config.ts` racine.

## Déploiement

Déployé le 13/09/2026 sur https://loupe-worker.erreip-gorguel.workers.dev (compte Cloudflare de Pierre, KV `KV_CACHE` créé par `wrangler kv namespace create`). Redéploiement : `npx wrangler login` (une fois) puis `npm run deploy -w apps/worker`. Variables : `ENVIRONNEMENT` (vars), `ORIGINES_AUTORISEES` (optionnelle). En local : `npm run dev -w apps/worker` (KV et limite simulés, `.dev.vars` d'après `.dev.vars.example`). Vérifié en ligne : `/health`, `/proxy/geocodage` (données réelles, `MISS` puis `HIT`), 400 et 404 en codes.
