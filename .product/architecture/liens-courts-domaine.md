# Architecture — `liens-courts-domaine` (fiche 23)

Specs : `.product/specs/liens-courts-domaine-specs.md` · ADR : `.product/adr/009-liens-de-partage-courts.md`

## Vue d'ensemble

```
BoutonPartager ──creer──▶ ClientPartage (réseau) ──POST /api/partage──▶ apps/comptes/partage ──▶ D1 table partage
      │ échec                                                                         ▲
      └──▶ lienPartageCompresse → /partage#z=…                                        │
/p/:id ──lire──▶ ClientPartage ──GET /api/partage/:id─────────────────────────────────┘
/partage#p=… | #z=… ──décodage local──▶ VueProjetPartage
Ancienne adresse (DEKLIC_TRANSFERT=1) ──decisionBascule──▶ <nouvelle>/transfert#d=… ──▶ importer (ProjetsContext)
```

## Fichiers

| Fichier                                                               | Rôle                                                                                                                                                                                                      |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/capture/src/origines.ts`                                    | `ORIGINE_HISTORIQUE`, `ORIGINE_DEKLIC`, `MOTIF_APERCUS`, `ORIGINES_SITE`, `origineProduction(valeur)` (https, origine seule, sinon défaut), export `@loupe/capture/origines`                              |
| `packages/projets/src/partage.ts`                                     | `alleger` (sans visite), `ProjetPartageSchema`, `ID_PARTAGE`, `TAILLE_MAX_PARTAGE` (64 Ko), `DUREE_PARTAGE_JOURS` (90), `LIMITE_PARTAGES_PAR_HEURE` (10), `CreationPartageSchema`, `LecturePartageSchema` |
| `apps/comptes/migrations/0006_partage.sql`                            | table `partage(id, contenu, creeLe, expireLe, jetonHash, ipHash)`, index `expireLe` et `(ipHash, creeLe)`                                                                                                 |
| `apps/comptes/src/partage/jetons.ts`                                  | `nouvelIdentifiant` (base62 sans biais), `nouveauJeton`, `empreinte` (SHA-256 hex), `egalConstant`                                                                                                        |
| `apps/comptes/src/partage/depot.ts` / `depot-d1.ts`                   | `DepotPartages` : `creer`, `lire` (prolonge), `supprimer` ; purge et limite ; `estTablePartageAbsente`                                                                                                    |
| `apps/comptes/src/partage/routes.ts`                                  | Hono : origine, `bodyLimit`, Zod, codes, `no-store`                                                                                                                                                       |
| `apps/comptes/src/dependances.ts`                                     | `partages`, `ORIGINES_SITE` depuis `@loupe/capture/origines`                                                                                                                                              |
| `apps/worker/src/cors.ts`                                             | `ORIGINE_DEKLIC` dans `ORIGINES_DEFAUT`                                                                                                                                                                   |
| `apps/extension/manifest.json`, `src/config.ts`, `scripts/build.ts`   | pont sur `https://app.deklic.pro/*`, version 0.4.0, `DEKLIC_ORIGINE` au build, identifiant Firefox inchangé                                                                                               |
| `apps/web/src/application/origine.ts`                                 | `ORIGINE_PRODUCTION` (build), `remplacerOrigine(html, origine)` pour `index.html`                                                                                                                         |
| `apps/web/src/application/bascule.ts`                                 | `decisionBascule(...)` : rester, transférer ou rediriger                                                                                                                                                  |
| `apps/web/src/stockage/compression.ts`                                | `compresserJson` / `decompresserJson` (deflate-raw + base64url, 2 Mo au plus décompressés)                                                                                                                |
| `apps/web/src/stockage/partage.ts`                                    | + `lienPartageCourt`, `lienPartageCompresse`, `decoderPartageCompresse`, `lireFragmentPartage`                                                                                                            |
| `apps/web/src/stockage/partage-client.ts`                             | `ClientPartage` : réseau (Zod), mémoire, indisponible                                                                                                                                                     |
| `apps/web/src/stockage/liens-partage.ts`                              | mémoire `deklic.partages.v1` : liens créés par projet (id, jeton, modifieLe, expireLe)                                                                                                                    |
| `apps/web/src/stockage/transfert.ts`                                  | `encoderTransfert`, `decoderTransfert`, `fusionnerTransfert`, `lienTransfert`, marqueur `deklic.transfert.v1`                                                                                             |
| `apps/web/src/stockage/ProjetsContext.tsx`                            | `importer(recus)` : fusion + journal de synchronisation                                                                                                                                                   |
| `apps/web/src/stockage/PartageContext.tsx`                            | fournisseur du `ClientPartage`                                                                                                                                                                            |
| `apps/web/src/ecrans/Partage.tsx`                                     | `#p=`, `#z=`, et `PartageCourt` (`/p/:id`), vue commune                                                                                                                                                   |
| `apps/web/src/ecrans/Transfert.tsx`                                   | import et bilan                                                                                                                                                                                           |
| `apps/web/src/coque/BoutonPartager.tsx`                               | lien court, repli, « Arrêter le partage »                                                                                                                                                                 |
| `apps/web/src/coque/Bascule.tsx`                                      | exécute `decisionBascule` au chargement                                                                                                                                                                   |
| `apps/web/vite.config.ts`, `vite.bookmarklet.config.ts`, `index.html` | `DEKLIC_ORIGINE`, `DEKLIC_TRANSFERT`                                                                                                                                                                      |

## Contrats

- `POST /api/partage` `{ projet: ProjetEnregistre }` → `201 { id, jeton, expireLe }`.
- `GET /api/partage/:id` → `200 { projet, expireLe }`.
- `DELETE /api/partage/:id` `{ jeton }` → `204`.
- Erreurs `{ code }` : `INTROUVABLE` 404, `ORIGINE_INCONNUE` 403, `CHAMPS_INVALIDES` 400, `CORPS_TROP_GROS` 413, `LIMITE_ATTEINTE` 429, `PARTAGE_INDISPONIBLE` 503.

## Choix

- Les routes du partage ne passent pas par la garde de session (`acces`) : partage anonyme ; même contrôle d'hôte et d'`Origin` pour les écritures.
- Le contenu stocké est la sérialisation d'un projet validé : relu par Zod côté web (jamais de confiance aveugle), pas côté serveur.
- La lecture prolonge l'expiration par un `update … returning` unique.
- Le transfert passe par `ProjetsContext.importer` (règle : toute écriture de projet passe par `useProjets()`), sinon la synchronisation ne verrait pas les projets importés.
- Compression native `CompressionStream('deflate-raw')` : aucune dépendance ; lecture bornée à 2 Mo contre une bombe de décompression.

## Revue de sécurité (auto-audit)

- **Injection** : requêtes D1 préparées et liées ; le contenu stocké est `JSON.stringify` d'un projet validé par Zod, réémis tel quel en `application/json` (jamais en HTML) ; identifiant filtré par `ID_PARTAGE` avant toute requête.
- **Accès** : aucune route de liste ; identifiant de 8 caractères base62 tiré sans biais par `crypto.getRandomValues` ; suppression par jeton de 256 bits dont seule l'empreinte est stockée ; mauvais jeton = 404 (rien ne dit que le lien existe).
- **CSRF / origine** : hôte connu exigé sur les trois routes, en-tête `Origin` connu pour POST et DELETE ; `app.deklic.pro.pirate.example` et `http://app.deklic.pro` refusés (tests).
- **Abus** : corps ≤ 64 Ko (413), 10 créations par heure par IP comptées dans la même instruction que l'insertion, purge des expirés à chaque création ; décompression côté web bornée à 2 Mo.
- **Vie privée** : pas de visite, pas d'identité, IP en empreinte salée effacée après une heure, `Cache-Control: no-store`, rien dans les journaux hors chemin et code d'erreur.
- **Web** : un projet reçu (lien court, `#z=`, `#p=`, `/transfert`) est toujours revalidé par Zod ; photos et liens d'annonce restent soumis à `surUnPortail` (règle existante de `CarteBien`) ; la bascule ne s'exécute que sur l'origine historique exacte avec le drapeau de build.
- Score estimé : 92/100 (base D1 en juridiction UE ; réserve : une copie du projet est stockée côté serveur, choix assumé par l'ADR-009).

## Auto-revue critique

- `ProjetsContext.tsx` et `cors.ts` sont hors de la liste de la fiche de session : changements minimaux, signalés dans la PR.
- Les écrans (`ecrans/`, `coque/`) ne sont pas sous le seuil de 100 % : leur comportement est prouvé par des tests de rendu et un parcours Playwright.
- Ordre d'implémentation respectant les dépendances : origines → contrat projets → migration et API → web (compression, client, écrans, bouton) → transfert → docs. Validé.
