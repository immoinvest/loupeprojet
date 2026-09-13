# Feature Discovery + Specs : Extension navigateur (`apps/extension`, `packages/capture`)

## Demande

Fiche `extension` (Pierre, 13/09/2026) : « Camille est sur une annonce LeBonCoin, SeLoger, Bien'ici, PAP ou Logic-Immo. Un clic sur l'extension Loupe lit la page dans son navigateur (jamais par nos serveurs, ADR-002) et ouvre Loupe avec le formulaire Vérifier pré-rempli. Le texte de l'annonce n'est jamais stocké côté Loupe : seuls les champs lus le sont. »

## Analyse

- **Quoi** : l'étape « Capturer » du pipeline (functional-spec, étape 2). Aujourd'hui l'écran Nouveau projet demande de coller le texte de l'annonce ; l'extension remplace ce copier-coller par un clic. Elle lit la page ouverte dans l'onglet de l'utilisateur : d'abord les données structurées (JSON-LD schema.org, état applicatif de la page, balises `og:`), puis des sélecteurs CSS en repli, puis la description. Elle encode le résultat dans le fragment d'une URL Loupe (`/projets/nouveau#capture=…`) et l'ouvre. Le fragment ne quitte jamais le navigateur (un fragment n'est pas envoyé au serveur), la page Loupe le lit, le valide (Zod), pré-remplit le formulaire et l'efface de l'adresse.
- **Pourquoi** : c'est la promesse d'entrée du produit (« colle le lien, on s'occupe du reste ») et la seule voie légale de lecture des annonces (ADR-002 : jamais côté serveur). Sans elle, la première analyse coûte un copier-coller.
- **Où** : trois briques.
  1. `packages/capture` (`@loupe/capture`) : le **contrat** partagé par l'extension, le bouton-favori et le web : schéma `CaptureSchema`, encodage/décodage base64url, résolution du portail depuis l'URL, moteur d'application des règles de capture.
  2. `apps/extension` : la WebExtension MV3 (Chrome, Edge, Firefox) : règles par portail en JSON versionné, content script, popup « Analyser dans Loupe », build esbuild vers `dist/`.
  3. `apps/web` : `src/annonces/capture.ts` (lecture du fragment) branché dans `NouveauProjet.tsx` ; en dernière story, le bouton-favori (`public/capture.js`) et la page `/extension`.

## Ce que la capture apporte par rapport au texte collé

| Étape                  | Texte collé (aujourd'hui)       | Extension / bouton-favori                                                                                       |
| ---------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Résoudre (portail, id) | depuis le lien collé            | depuis l'URL de l'onglet, même règles (`resoudreAnnonce` déplacé dans `@loupe/capture`)                         |
| Capturer               | Ctrl+A, Ctrl+C, Ctrl+V          | un clic ; champs structurés (prix, surface, pièces, DPE, ville, CP…) + description ≤ 4 000 caractères           |
| Extraire               | règles regex sur le texte collé | champs structurés d'abord ; les mêmes règles regex sur la description pour les trous (honoraires, étage, année) |
| Ce qui est conservé    | les champs lus, jamais le texte | idem : la description sert à l'extraction puis disparaît avec le fragment                                       |
| Ce qui part vers Loupe | rien (tout est local)           | rien : le fragment d'URL n'est jamais transmis au serveur ; aucune requête depuis le content script             |

## Contrat de capture (`CaptureSchema`, version 1)

`version: 1`, `portail` (leboncoin, seloger, bienici, pap, logicimmo), `url`, `id?`, `prix?`, `surface?`, `pieces?`, `chambres?`, `ville?`, `codePostal?`, `adresse?`, `etage?`, `ascenseur?`, `dpe?`, `ges?`, `chargesCopro?` (€/mois), `taxeFonciere?` (€/an), `anneeConstruction?`, `meuble?`, `description?` (≤ 4 000 caractères), `captureLe` (ISO 8601), `mode?` (extension, bookmarklet), `regles?` (version du fichier de règles appliqué, ex. `leboncoin-2026-09-13`). Les deux derniers champs reprennent `source.capture.{mode, regles, date}` du modèle de données de la spec.

Encodage : JSON → UTF-8 → base64url sans `=`, placé dans `#capture=…`. Décodage : `decoderCapture` rend soit la capture validée, soit une raison (`encodage`, `json`, `schema`) sans jamais lever.

## Règles de capture par portail (`apps/extension/regles/<portail>.json`)

Un fichier par portail, validé par `ReglesPortailSchema` : `version` (`<portail>-AAAA-MM-JJ`), `portail`, `champs` = pour chaque champ de la capture une liste ordonnée d'extracteurs ; le premier qui donne une valeur valide gagne. Sources : `jsonld` (chemin dans les blocs `application/ld+json`, filtre `@type` optionnel), `json` (script d'état applicatif, ex. `__NEXT_DATA__`, chemin avec recherche `[cle=valeur]` dans les tableaux), `meta` (`og:`, `product:`…), `css` (sélecteur, attribut, regex optionnels). Conversions : `montant`, `nombre`, `entier`, `texte`, `booleen`, `classe` (A à G), `codePostal`, avec `diviser` optionnel (charges annuelles → mensuelles). La structure est pensée pour un chargement distant (R2) plus tard : le registre `reglesDuPortail(portail)` est le seul point d'entrée, les fichiers sont versionnés, aucun chargement réseau n'est implémenté ici.

## Stories

| Story | Titre                       | Gherkin (résumé)                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-1  | `@loupe/capture` : contrat  | `CaptureSchema` accepte une capture minimale (portail, url, captureLe) et refuse une description > 4 000 caractères, un DPE « H », un CP à 4 chiffres ; `encoderCapture` puis `decoderCapture` rendent la capture à l'identique (accents, apostrophes) ; texte corrompu → raison `encodage`, JSON invalide → `json`, objet hors schéma → `schema` ; `resoudreAnnonce` sur les cinq portails ; `urlDeCapture(base, capture)` et `captureDepuisHash('#capture=…')` |
| US-2  | `@loupe/capture` : règles   | `appliquerRegles(document, regles)` lit JSON-LD (dont `@graph`), état applicatif (`[key=square].value`), `meta`, CSS (+ attribut, + regex) ; conversions ; un extracteur qui échoue passe au suivant ; une valeur hors schéma est ignorée ; `capturer(document, url, regles, mode)` assemble une capture validée avec description tronquée                                                                                                                       |
| US-3  | Règles des cinq portails    | Chaque `regles/<portail>.json` valide `ReglesPortailSchema` ; appliqué à `tests/fixtures/<portail>.html`, il rend au moins prix, surface, ville, code postal et description ; le JSON-LD est préféré aux sélecteurs CSS ; une page dont la maquette a changé rend une capture sans champs plutôt qu'une erreur                                                                                                                                                   |
| US-4  | WebExtension MV3            | manifest v3, permissions `activeTab` + `scripting` uniquement, aucune `host_permissions` ; popup : sur une annonce reconnue le bouton « Analyser dans Loupe » injecte le content script, reçoit la capture, ouvre `BASE/projets/nouveau#capture=…` ; ailleurs, message « Ouvrez une annonce… » ; build esbuild vers `dist/` (icônes générées) ; README « charger l'extension non empaquetée »                                                                    |
| US-5  | Web : lecture du fragment   | `/projets/nouveau#capture=…` valide → formulaire Vérifier pré-rempli (badges `annonce`), portail et identifiant affichés, description lue par `extraireChamps` pour les champs manquants, fragment effacé de l'adresse ; fragment illisible → message et parcours texte collé intact ; sans fragment → écran inchangé                                                                                                                                            |
| US-6  | Bouton-favori (optionnelle) | `public/capture.js` construit par Vite (IIFE, règles incluses) ; page `/extension` : bouton à glisser dans la barre de favoris (`javascript:` posé hors React, qui bloque ces URL) + instructions pour l'extension ; sur une page qui n'est pas une annonce, le favori l'explique                                                                                                                                                                                |

## Périmètre

- **IN** : ce qui précède ; `apps/web/src/annonces/resoudre.ts` devient un ré-export de `@loupe/capture` (une seule source de vérité pour les règles d'URL, comportement identique, tests web inchangés) ; ESLint : dérogation `explicit-function-return-type` pour les scripts `*.mjs` de build.
- **OUT** : `apps/worker`, `packages/moteur`, les autres écrans du web, publication sur les stores (compte + frais : décision de Pierre), chargement des règles depuis R2, historique de prix, photos, Safari.

## Auto-validation critique

- **Fixtures** : Pierre n'a pas fourni de HTML enregistré. Les fixtures sont construites d'après la structure connue des portails (JSON-LD `Product`/`Offer`, `__NEXT_DATA__` de LeBonCoin, balises `og:`) et marquées « à vérifier sur une vraie annonce » dans la PR. Le moteur de règles, lui, est testé à 100 % sur des cas synthétiques ; corriger un portail se fera en éditant un JSON, sans toucher au code.
- **Vie privée** : le content script ne fait aucune requête ; la capture voyage dans un fragment (jamais envoyé au serveur, ni au Worker) ; le web n'enregistre que les champs et l'adresse de l'annonce, la description est jetée après extraction ; le fragment est retiré de l'adresse dès la lecture pour ne pas rester dans l'historique.
- **Robustesse** : une maquette qui change ne casse rien : la capture arrive avec moins de champs, le formulaire reste éditable, le texte collé reste possible. Le message le dit.
- **Surface d'attaque** : un fragment forgé ne peut qu'injecter des chaînes bornées (Zod : longueurs, enums, nombres finis) dans un formulaire que l'utilisateur vérifie ; aucun HTML n'est interprété ; la longueur du fragment est bornée (description ≤ 4 000) et le décodage ne lève jamais.
- **Ce qui reste manuel** : charger l'extension « non empaquetée » demande le mode développeur du navigateur ; le bouton-favori est la voie sans installation pour tout le monde en attendant les stores.
- **Après coup** : la fiche parle de « Loupe » ; l'identité Deklic (ADR-005) a été fusionnée sur master pendant la session et appliquée aux textes, au popup et à l'icône, sans toucher aux noms techniques. La page PAP a pu être relevée sur une vraie annonce avec le navigateur intégré (JSON-LD `Product` avec `offers`, `additionalProperty`, `address` ; `.energy-indice li.active`) ; les autres portails bloquent ou ne rendent pas dans ce navigateur, leurs fixtures restent construites.
