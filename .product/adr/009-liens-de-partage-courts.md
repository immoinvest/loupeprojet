# ADR-009 : liens de partage courts stockés sur le serveur

**Date** : 2026-09-15 · **Statut** : accepté (session de nuit, proposition de la fiche 23 appliquée ; à confirmer par Pierre avant fusion) · **Amende** : le principe « rien d'enregistré » du partage (feature `garder`)

## Contexte

Depuis la feature `garder`, un lien de partage contient tout le projet enregistré en base64url dans le fragment (`/partage#p=…`) : aucun stockage, mais plusieurs milliers de caractères, que des messageries tronquent ou affichent en pavé. Pierre demande des liens courts.

## Décision

1. **Lien court** `/p/<8 caractères base62>` : `POST /api/partage` (worker des comptes, même origine, sans compte) enregistre une copie du projet dans la table `partage` de la base D1 `deklic-comptes` et rend l'identifiant et un **jeton de suppression**.
2. **Contenu** : le projet enregistré validé par Zod, **sans la visite** (réponses et notes, souvent personnelles). Aucun texte d'annonce (le projet n'en contient pas), aucune identité : ni compte, ni e-mail. 64 Ko au plus.
3. **Durée** : 90 jours après la dernière ouverture ; un lien expiré ne s'ouvre plus et les liens expirés sont purgés à chaque création.
4. **Suppression** : « Arrêter le partage » envoie le jeton (gardé seulement sur l'appareil qui a partagé) ; le serveur n'en garde que l'empreinte SHA-256.
5. **Abus** : 10 créations par heure par adresse IP ; l'IP n'est gardée qu'en empreinte salée par le secret du worker, effacée au bout d'une heure.
6. **Repli sans serveur** : si la création échoue (migration absente, hors ligne), le bouton donne un lien long **compressé** (deflate) et allégé (sans la visite), `/partage#z=…`, jamais envoyé au serveur. Les liens `#p=…` restent lisibles.
7. L'identifiant (≈ 2,2 × 10¹⁴ possibilités, tiré par `crypto.getRandomValues`) n'est pas devinable ; il n'existe aucune route de liste.

## Conséquences

- Vie privée : une copie du projet (prix, apport, tranche d'imposition, adresse éventuelle) est hébergée par Cloudflare D1 le temps du partage, dans la base `deklic-comptes` créée en juridiction UE (14/09/2026) ; le texte de la boîte de partage le dit.
- Coût : une écriture par partage et une lecture par ouverture, dans le quota gratuit de D1.
- Mise en service : **la migration `0006_partage.sql` doit être appliquée en production avant la fusion** ; sans elle, l'API répond 503 et le bouton donne le lien long compressé.

## Écarté

- **Rester sans stockage** (compression + allègement seuls) : ≈ 1 000 caractères, encore trop long ; gardé comme repli.
- **Suppression par le propriétaire connecté** : demanderait de lier un partage anonyme à un compte ; le jeton de l'appareil suffit en v1.
- **KV pour la limite par IP** : le worker Pages des comptes n'a que D1 ; un comptage en D1 évite un binding de plus.
