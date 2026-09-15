# Discovery — `liens-courts-domaine` (fiche de backlog 23)

Date : 15/09/2026 (session de nuit S10) · Fiche : `.product/backlog/23-liens-courts-domaine.md`

## Demande

> Les liens de partage sont trop longs ; et il faut changer le domaine pour utiliser app.deklic.pro.

Cette nuit, **le code est préparé, la bascule reste à Pierre** : aucune redirection active, domaine de production inchangé (`https://loupeprojet.pages.dev`) tant que Pierre n'a pas branché `app.deklic.pro`.

## Résultats attendus (outcomes)

1. Un lien de partage tient en une ligne : `https://<site>/p/7fK2qA9x` (≈ 40 caractères).
2. Si le lien court ne peut pas être créé (base pas encore migrée, hors ligne), le bouton Partager donne quand même un lien, compressé et allégé (sans la visite), plusieurs fois plus court qu'aujourd'hui.
3. Les anciens liens `#p=…` s'ouvrent toujours.
4. Le jour de la bascule, les projets enregistrés sans compte sur `loupeprojet.pages.dev` suivent la personne sur `app.deklic.pro` (transfert automatique par fragment, jamais envoyé au serveur).
5. Une seule origine de production dans le code (constante partagée) ; comptes, Worker et extension acceptent déjà `https://app.deklic.pro`.

## Livrables (outputs)

- `@loupe/capture/origines` : `ORIGINE_HISTORIQUE`, `ORIGINE_DEKLIC`, `ORIGINES_SITE`, `origineProduction(valeur)`.
- Comptes (`apps/comptes`) : migration `0006_partage.sql`, routes `POST /api/partage`, `GET /api/partage/:id`, `DELETE /api/partage/:id`, origine `app.deklic.pro` connue.
- `@loupe/projets` : contrat du partage (projet allégé, réponses).
- Web : route `/p/:id`, lien long compressé `#z=`, `BoutonPartager` (lien court, mémoire, « Arrêter le partage »), page `/transfert`, envoi depuis l'ancienne adresse derrière `DEKLIC_TRANSFERT=1`, `og:image` et bouton-favori par `DEKLIC_ORIGINE`.
- Extension 0.4.0 : pont sur `app.deklic.pro` en plus, identifiant Firefox inchangé.
- Worker : CORS `app.deklic.pro` (effectif au prochain déploiement).
- ADR-009 « Liens de partage courts », README « Passer sur app.deklic.pro ».

## Périmètre

Dans : fichiers listés par la fiche de session (partage, bouton, routes, écrans Partage et Transfert, comptes, extension, bouton-favori, `index.html`, tests, README) ; changement minimal de `apps/worker/src/cors.ts` (origine) et de `stockage/ProjetsContext.tsx` (import des projets transférés, pour que la synchronisation voie l'écriture).

Hors : réglages Cloudflare, DNS, Google, Apple, Resend ; menus et en-tête (S2) ; suppression d'un lien par le propriétaire connecté (le jeton de l'appareil suffit en v1) ; redirection 301 côté Cloudflare.

## Contraintes

- Principes n° 6 (aucun texte d'annonce stocké) et n° 8 (vie privée) : le lien court stocke une copie du projet **sans la visite**, sans identité, 90 jours après la dernière ouverture ; l'adresse IP n'est gardée qu'en empreinte salée, effacée après une heure.
- Tout doit fonctionner **sans** la migration D1 : API → `503 PARTAGE_INDISPONIBLE`, bouton → lien long compressé.
- Tests : `apps/comptes/src` et `packages/*` à 100 % ; `apps/web/src/stockage` et `application` à 100 %.

## Décisions prises à la place de Pierre (questions ouvertes de la fiche)

| #   | Question                    | Choix appliqué (proposition de la fiche)                                            |
| --- | --------------------------- | ----------------------------------------------------------------------------------- |
| 1   | Domaine acheté ?            | Inconnu : code prêt, défaut `loupeprojet.pages.dev`, bascule par variables de build |
| 2   | Liens courts stockés ?      | Oui (option 3), repli options 1 + 2                                                 |
| 3   | Durée de vie                | 90 jours sans ouverture                                                             |
| 4   | Contenu partagé             | Sans la visite (réponses et notes)                                                  |
| 5   | Transfert automatique       | Oui, derrière `DEKLIC_TRANSFERT=1` (désactivé cette nuit)                           |
| 6   | Worker sur `api.deklic.pro` | Non (inchangé)                                                                      |

## Risques

- Perte des projets locaux à la bascule → transfert testé, désactivé par défaut.
- Connexion Google / Apple cassée si les URI ne sont pas ajoutées avant la bascule → liste ordonnée dans le README.
- Abus de création de liens → 10 par heure par IP, 64 Ko par projet, purge des liens expirés à chaque création.

## Auto-revue critique

- Le « propriétaire connecté » qui supprime un lien est écarté : il demanderait une colonne `userId` et une session sur une route anonyme, pour un gain faible (le jeton est gardé par l'appareil qui a partagé). Noté dans le rapport.
- Stocker une empreinte d'IP est le minimum pour limiter le débit sans KV dans le worker Pages ; l'effacer après une heure le rend acceptable.
- Le transfert automatique ne peut pas être prouvé en production cette nuit (domaine absent) : il est prouvé par tests unitaires de la décision et un parcours Playwright de la page `/transfert`. Validé.
