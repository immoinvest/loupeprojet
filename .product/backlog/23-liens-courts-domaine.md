# 23 — Liens de partage courts et domaine app.deklic.pro

Statut : `livrée` (code prêt, bascule à faire par Pierre) · Notée le 14/09/2026 · Livrée le 15/09/2026 (session de nuit S10, feature `liens-courts-domaine`) · Discovery : [`.product/features/liens-courts-domaine-discovery.md`](../features/liens-courts-domaine-discovery.md) · Specs : [`.product/specs/liens-courts-domaine-specs.md`](../specs/liens-courts-domaine-specs.md) · Architecture : [`.product/architecture/liens-courts-domaine.md`](../architecture/liens-courts-domaine.md) · ADR : [`009-liens-de-partage-courts.md`](../adr/009-liens-de-partage-courts.md)

Dépend de : l'achat de `deklic.pro` et sa zone DNS chez Cloudflare (**Pierre**) ; la migration D1 `0006_partage.sql` appliquée en production **avant la fusion** (Pierre).

## Décisions appliquées (questions ouvertes, proposition de la fiche)

1. Domaine : code prêt, adresse par défaut inchangée (`loupeprojet.pages.dev`) ; bascule par `DEKLIC_ORIGINE` et `DEKLIC_TRANSFERT=1` au build.
2. Liens courts stockés (option 3), repli compressé et allégé (options 1 + 2).
3. Durée de vie : 90 jours sans ouverture.
4. Contenu partagé : sans les notes et réponses de visite.
5. Transfert automatique des projets locaux (désactivé tant que le drapeau n'est pas levé).
6. Worker : pas de `api.deklic.pro` (adresse inchangée, CORS `app.deklic.pro` ajouté).

Écart relevé : le lien de repli compressé est environ **deux fois** plus court que l'ancien lien complet (≈ 1 350 caractères pour un projet complet), pas cinq fois ; le lien court reste la réponse à la demande.

## La demande de Pierre

> Les liens de partage sont trop longs ; et il faut changer le domaine pour utiliser app.deklic.pro.

## Ce qui existait

### Liens de partage

- `apps/web/src/stockage/partage.ts` : `lienPartage(origine, enregistre)` = `https://loupeprojet.pages.dev/partage#p=<ProjetEnregistre entier en JSON, en base64url>`. **Tout le projet** est dans l'adresse : hypothèses, provenance de chaque champ, adresse, réponses et notes de visite… → plusieurs milliers de caractères, que certaines messageries tronquent ou affichent en pavé illisible.
- Choix d'origine (feature `garder`, principe « rien d'enregistré ») : le fragment `#` n'est jamais envoyé au serveur ; aucun stockage.
- Bouton `coque/BoutonPartager.tsx` (partage natif sur téléphone, copie sinon).

### Domaine

- Production : `https://loupeprojet.pages.dev` (Cloudflare Pages) ; Worker `loupe-worker.erreip-gorguel.workers.dev`.
- Domaine écrit en dur (hors docs) : comptes, manifeste et configuration de l'extension, bouton-favori, `og:image`, une dizaine de tests. Hors dépôt : URI de redirection Google et Apple, domaine d'envoi Resend, `ORIGINES_AUTORISEES`, Cloudflare Web Analytics, Sentry.

## Ce qui change pour l'utilisateur

1. Un lien partagé ressemble à **`<site>/p/7fK2qA9x`** ; on l'ouvre sans compte, on voit le projet, « Ajouter à mes projets » comme avant. « Arrêter le partage » l'éteint.
2. Hors ligne ou sans la base migrée : lien long compressé `#z=`, sans la visite. Les anciens liens `#p=` s'ouvrent toujours.
3. Le jour de la bascule : l'application s'ouvre sur **https://app.deklic.pro**, l'ancienne adresse y envoie une fois les projets de l'appareil (`/transfert#d=…`) puis redirige.

## Réalisation

Voir l'architecture. Étapes de Pierre dans l'ordre : README, section « Passer sur app.deklic.pro ».

## Coût et risques

- Coût : domaine `.pro` (≈ 10-20 €/an, à Pierre) ; D1 et Workers dans les quotas gratuits (une écriture par partage, une lecture par ouverture).
- Perte des projets locaux au changement de domaine → transfert testé, rien n'est supprimé sur l'ancienne adresse.
- Connexion Google / Apple cassée si les URI de redirection ne sont pas ajoutées avant la bascule → liste de contrôle dans le README, anciennes URI gardées.
- Extension non mise à jour : elle garde `*.loupeprojet.pages.dev` dans ses correspondances.
- Vie privée : les liens courts stockent une copie du projet côté serveur → ADR-009, expiration, suppression, contenu allégé, IP en empreinte effacée après une heure.
