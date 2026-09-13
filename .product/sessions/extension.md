# Fiche de session — `extension` : lire l'annonce dans le navigateur

Tronc commun : `.product/sessions/_commun.md` (contexte, autorisations, règles de travail en parallèle, gates).

## Objectif

Camille est sur une annonce LeBonCoin, SeLoger, Bien'ici, PAP ou Logic-Immo. Un clic sur l'extension Loupe lit la page **dans son navigateur** (jamais par nos serveurs, ADR-002 `.product/adr/002-capture-navigateur.md`) et ouvre Loupe avec le formulaire « Vérifier » pré-rempli. Le texte de l'annonce n'est jamais stocké côté Loupe : seuls les champs lus le sont.

## Ce qui existe déjà

- `apps/web/src/annonces/` : `resoudreAnnonce` (reconnaît le portail et l'identifiant depuis l'URL), `extraireChamps` (lit un texte collé par règles), `construireProjet(saisie, id)` (fabrique un `Projet` du moteur avec des défauts sourcés et la provenance de chaque valeur). Lis ces fichiers pour aligner les noms de champs.
- `apps/web/src/ecrans/NouveauProjet.tsx` + `FormulaireProjet.tsx` : l'écran cible (lien collé → texte collé → formulaire Vérifier).
- Le moteur (`packages/moteur`) : `ProjetSchema`, `SourceAnnonceSchema` (portail, id, URL).

## Périmètre

1. **`packages/capture`** (`@loupe/capture`) : le contrat de capture, partagé par l'extension et le web. Schéma Zod `CaptureSchema` (`version: 1`, `portail`, `url`, `id?`, `prix?`, `surface?`, `pieces?`, `chambres?`, `ville?`, `codePostal?`, `adresse?`, `etage?`, `ascenseur?`, `dpe?`, `ges?`, `chargesCopro?`, `taxeFonciere?`, `anneeConstruction?`, `meuble?`, `description` ≤ 4 000 caractères, `captureLe`) + `encoderCapture`/`decoderCapture` (base64url d'un JSON, pour passer dans un fragment d'URL). Tests 100 %.
2. **`apps/extension`** : WebExtension **MV3** (Chrome, Edge, Firefox), build Vite ou esbuild vers `apps/extension/dist/`, `manifest.json` avec permissions minimales (`activeTab`, `scripting`), un content script qui applique des **règles par portail** (`apps/extension/regles/<portail>.json` : d'abord JSON-LD `schema.org` et balises `og:`, puis sélecteurs CSS en repli), un popup minimal avec un bouton « Analyser dans Loupe » qui ouvre `https://loupeprojet.pages.dev/projets/nouveau#capture=<capture encodée>` (en dev : `http://localhost:5173`). Le fragment n'est jamais envoyé au serveur.
3. **Côté web, minimal** : `apps/web/src/annonces/capture.ts` (lit `location.hash`, décode, valide, transforme en saisie du formulaire) et l'appel dans `NouveauProjet.tsx` au montage. Rien d'autre dans `apps/web`.
4. **Bookmarklet** (dernière story, optionnelle) : `apps/web/public/capture.js` + un bouton « glisser dans la barre de favoris » sur la page `/extension` du web.
5. Tests : règles appliquées à des pages HTML enregistrées (`apps/extension/tests/fixtures/<portail>.html`, jsdom). Si Pierre peut fournir le HTML enregistré d'une vraie annonce par portail, demande-le en début de session ; sinon construis des fixtures d'après la structure connue des portails et marque-les « à vérifier sur une vraie annonce » dans la PR.

## Hors périmètre (ne pas toucher)

`apps/worker`, `packages/moteur`, tous les écrans de `apps/web` sauf `NouveauProjet.tsx`, la publication sur les stores (Chrome Web Store = compte + frais : décision de Pierre plus tard). Fournis les instructions « charger l'extension non empaquetée » dans `apps/extension/README.md`.

## Points d'attention

- Les portails changent de maquette : privilégier JSON-LD et métadonnées, garder les sélecteurs CSS en repli, et versionner les règles pour qu'un jour elles se chargent depuis R2 (structure des fichiers JSON pensée pour ça, sans implémenter le chargement distant).
- Aucune requête réseau depuis le content script vers nos serveurs ; aucune donnée personnelle du visiteur.
- Le web reste utilisable sans extension (lien + texte collé + saisie manuelle).
