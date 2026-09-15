# S10 — `liens-courts-domaine` (fiche 23)

Branche `feat/liens-courts-domaine` · **Prérequis : `feat/coque-menus`** · Règles : `_regles-nuit.md` · **PR sans fusion automatique**

## Objectif

Détail et propositions : `C:\Users\errei\Claude\loupe-backlog\.product\backlog\23-liens-courts-domaine.md`. Le code est préparé ; **la bascule reste à Pierre**.

1. **Une seule origine de production** : constante partagée `ORIGINE_PRODUCTION` (valeur de build ; défaut **toujours `https://loupeprojet.pages.dev`** tant que Pierre n'a pas branché le domaine) utilisée par l'extension, le bouton-favori, `og:image`, les tests ; comptes et Worker acceptent **aussi** `https://app.deklic.pro` ; l'extension reconnaît les deux domaines (sans changer l'identifiant Firefox).
2. **Transfert des projets locaux** : page `/transfert` (import d'un fragment compressé, validation Zod, pas d'écrasement d'un projet plus récent) et, côté ancien domaine, envoi vers le nouveau **désactivé par défaut** (drapeau de build `DEKLIC_TRANSFERT=1`) : aucune redirection active cette nuit.
3. **Liens courts** : migration D1 au **prochain numéro libre** de `apps/comptes/migrations/` (vérifier ce que l'épic Gérer a déjà pris), API `POST/GET/DELETE /api/partage`, route web `/p/:id`, `BoutonPartager` crée le lien court et retombe sur le lien long **compressé et allégé** si l'API échoue (base absente, hors ligne) ; anciens liens `#p=` toujours lus. ADR `.product/adr/NNN-liens-de-partage-courts.md`.
4. README : section « Passer sur app.deklic.pro » (étapes Pierre dans l'ordre : domaine Pages, Google, Apple, Resend, variables, migration, drapeaux).

## PR

Suis la procédure de file vide, puis `gh pr create` **sans** `gh pr merge --auto` : la migration D1 doit être appliquée en production par Pierre avant la fusion. Titre préfixé `[à fusionner après migration]`. Arrête-toi quand la CI est verte (ne pas attendre la fusion).

## Périmètre

`apps/web/src/stockage/partage.ts`, `coque/BoutonPartager.tsx`, `App.tsx` (routes `/p/:id`, `/transfert`), `ecrans/Partage.tsx`, nouveau `ecrans/Transfert.tsx`, `apps/comptes/` (migration, routes partage, origines), `apps/extension/` (correspondances, config), `apps/web/vite.bookmarklet.config.ts`, `index.html`, tests concernés, README.

## Hors périmètre

Réglages Cloudflare, DNS, OAuth, Resend (Pierre) ; menus et en-tête (S2) au-delà du bouton Partager.

## Fin

PR ouverte, CI verte, non fusionnée ; rapport `C:\Users\errei\Claude\rapports-nuit\liens-courts-domaine.md` avec la liste ordonnée des actions de Pierre.
