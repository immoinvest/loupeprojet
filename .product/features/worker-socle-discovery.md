# Feature Discovery + Specs : Socle du Worker (`apps/worker`)

## Demande

« Ok, let's go » (Pierre, 13/09/2026) après l'explication du rôle du serveur Hono : aller chercher les données publiques avec un cache partagé, porter la clé du LLM (session suivante), se protéger des abus.

## Analyse

- Le navigateur ne peut pas appeler directement la plupart des API publiques (CORS) et ne doit pas les marteler : le Worker les proxifie, valide leurs réponses et les garde en cache KV 24 h, partagé entre tous les utilisateurs.
- Le premier service proxifié est le **géocodage** (Géoplateforme IGN, successeur de api-adresse.data.gouv.fr) : c'est l'étape 5 du pipeline (Résoudre → … → Géocoder → Enrichir), préalable à tout enrichissement marché.
- Le Worker expose **son propre contrat** par service (réponse normalisée, validée par Zod) : le navigateur ne voit jamais les formats amont, et un changement d'API amont ne casse que le Worker.
- Le LLM (`/extract`) n'est pas dans ce socle : il demande une clé Mistral (dépense, décision de Pierre) et arrive avec `extraction-llm`.
- Tests sans workerd : l'application Hono est exercée par `app.request()` avec des doubles (cache mémoire, limiteur mémoire, amont simulé, horloge pilotée). Les bindings réels (KV, Rate Limiting) ne sont exercés qu'au déploiement — écart assumé par rapport à `@cloudflare/vitest-pool-workers`, plus lourd et plus lent en CI.

## Stories

| Story | Titre                        | Gherkin (résumé)                                                                                                                                                                                                                                       |
| ----- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| US-1  | Socle Hono                   | `GET /health` → `{ ok, version, environnement }` ; 404 et 500 en JSON avec un code ; CORS limité à la production, aux previews Pages et à localhost ; journal structuré (JSON, une ligne par événement)                                                |
| US-2  | Cache et limite de débit     | clé = service + SHA-256 des paramètres validés (JSON canonique) ; KV `expirationTtl` ; en-tête `X-Loupe-Cache` ; 60 requêtes/min/IP via le binding Rate Limiting, `429 TROP_DE_REQUETES` ; un cache en panne n'empêche pas de répondre                 |
| US-3  | Services et proxy            | `definirService` (paramètres Zod → URL amont → réponse amont Zod → normalisation) ; `GET /proxy/:service` : `SERVICE_INCONNU`, `PARAMETRES_INVALIDES` (champs), délai d'appel, `AMONT_INDISPONIBLE` / `AMONT_SATURE` / `AMONT_INVALIDE`, mise en cache |
| US-4  | Géocodage                    | `/proxy/geocodage?q=…&limit=…&codePostal=…` → `{ resultats: [{ libelle, score, lat, lon, precision, cleBan, codeInsee, codePostal, commune }] }`                                                                                                       |
| US-5  | Configuration et déploiement | `wrangler.toml` (KV, Rate Limiting, observabilité), `.dev.vars.example`, `npm run build` = `wrangler deploy --dry-run`, marche à suivre de déploiement                                                                                                 |

## Périmètre

- **IN** : ce qui précède ; `apps/worker` comme workspace avec ses gates (lint, typecheck, tests 100 %, build).
- **OUT** : `/extract` (extraction-llm), les autres services amont (DVF, ADEME, Géorisques, ANIL : enrichissement-marche, une fois les référentiels publiés), l'appel du Worker depuis le web, Sentry (compte à créer), le déploiement lui-même (compte Cloudflare de Pierre).

## Auto-validation critique

- La limite de débit repose sur un binding en bêta ouverte chez Cloudflare (`[[ratelimits]]`) ; `wrangler deploy --dry-run` l'accepte et `wrangler dev` la simule. Si elle disparaissait, `LimiteurDebit` est une interface : une version KV ou Durable Object la remplacerait sans toucher au reste.
- Le cache KV est « à cohérence différée » : deux requêtes simultanées peuvent appeler l'amont deux fois. Acceptable (et sans coût) pour des données publiques.
- Aucune adresse IP n'est journalisée ; les paramètres de requête (adresses saisies) ne le sont pas non plus — seule la clé de cache (empreinte) l'est en cas de panne du cache.
