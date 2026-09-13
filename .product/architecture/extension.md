# Architecture : Extension navigateur (`packages/capture`, `apps/extension`, lecture côté web, bouton-favori)

```
packages/capture/                     @loupe/capture : le contrat, partagé par l'extension, le bouton-favori et le web
├── src/portails.ts                   PortailSchema, PORTAILS, resoudreAnnonce (portail + id + URL canonique)
├── src/schema.ts                     ChampsCaptureSchema (tous optionnels, bornés), CaptureSchema (version 1, portail, url, captureLe, mode, regles)
├── src/encodage.ts                   encoderCapture / decoderCapture (base64url d'un JSON UTF-8, raison encodage/json/schema), urlDeCapture, captureDepuisHash
└── src/regles/                       schema (ReglesPortailSchema, extracteurs jsonld/json/meta/css), chemin (a.b[2].c, [cle=valeur]),
                                      sources (JSON-LD avec @graph, état applicatif, meta, CSS + texteVisible), convertir (montant, nombre, entier,
                                      etage, booleen, classe, codePostal, regex, diviser, valeur), appliquer (appliquerRegles, capturer), registre
tests/                                68 tests, couverture 100 % (jsdom : DOMParser sur des pages synthétiques)

apps/extension/                       @loupe/extension : WebExtension Manifest V3 (Chrome, Edge, Firefox)
├── manifest.json                     permissions activeTab + scripting, aucune host_permissions, aucun stockage
├── regles/<portail>.json             règles versionnées <portail>-AAAA-MM-JJ, exportées (`@loupe/extension/regles/*.json`)
├── src/regles.ts                     REGISTRE = creerRegistre([…]) : seul point d'entrée vers les règles (chargement R2 possible plus tard)
├── src/contenu.ts                    script injecté au clic : lirePage(document, location.href, REGISTRE) → globalThis.__loupeCapture
├── src/popup.ts + popup.html/css     état de l'onglet, injection, lecture du résultat, ouverture de BASE/projets/nouveau#capture=…
├── src/logique/                      lire-page (ResultatLectureSchema), popup (etatPourUrl, resumeCapture, messages) : sans chrome.*
├── src/config.ts                     baseUrl() : production, ou l'adresse injectée par le build --dev
├── scripts/build.ts, icones.ts       esbuild (IIFE, cible chrome120/firefox128) → dist/chrome, dist/firefox ; icône d'app Deklic dessinée au build
└── tests/                            33 tests (règles sur pages enregistrées, popup avec un faux `chrome`, script de contenu), couverture 100 %

apps/web/src/annonces/capture.ts     lireFragmentCapture(hash) → absente | illisible | lue ; champsDepuisCapture (structuré puis texte) ; annonceDepuisCapture
apps/web/src/annonces/resoudre.ts    ré-export de @loupe/capture (une seule source de vérité pour les règles d'URL)
apps/web/src/ecrans/NouveauProjet.tsx lit le fragment au premier rendu, pré-remplit Vérifier, efface le fragment de l'adresse
apps/web/src/bookmarklet/            lancer.ts (lancerCapture : règles importées de @loupe/extension, ouvre Deklic) ; capture.ts (point d'entrée)
apps/web/vite.bookmarklet.config.ts  construit public/capture.js (IIFE, règles incluses, adresse figée) avant chaque build et dev du web
apps/web/src/ecrans/Extension.tsx    page /extension : bouton à glisser dans la barre de favoris, guide de l'extension, ce qui reste chez l'utilisateur
```

## Flux

1. **Popup** : `chrome.tabs.query` → `etatPourUrl(url)` (annonce reconnue ou non). Au clic : `chrome.scripting.executeScript({ files: ['contenu.js'] })`.
2. **Script de contenu** : `resoudreAnnonce(location.href)` → règles du portail → `capturer(document, url, regles)` : pour chaque champ, le premier extracteur qui donne une valeur conforme au schéma (JSON-LD → état applicatif → meta → CSS). Résultat déposé dans `globalThis.__loupeCapture` ; la dernière expression du fichier (ajoutée par le build) en fait la valeur de complétion rendue par `executeScript`. Aucune requête, la page n'est pas modifiée.
3. **Popup** : `ResultatLectureSchema.safeParse(résultat)` ; si le navigateur n'a pas rendu de valeur, une seconde injection relit `globalThis.__loupeCapture`. Puis `urlDeCapture(baseUrl(), capture)` → `chrome.tabs.create`.
4. **Web** (`/projets/nouveau#capture=…`) : `lireFragmentCapture(location.hash)` au premier rendu → formulaire Vérifier pré-rempli (badges `annonce`), portail et identifiant affichés, `navigate(…, { replace: true })` efface le fragment de l'adresse et de l'historique. La description sert à `extraireChamps` (honoraires, année, meublé…) puis disparaît : rien du texte n'est conservé.
5. **Bouton-favori** : même chemin sans extension. `public/capture.js` embarque `@loupe/capture` et les cinq fichiers de règles ; la page `/extension` le récupère (`fetch`) et le pose en URL `javascript:` sur un lien à glisser dans la barre de favoris (`setAttribute`, car React bloque ces URL dans les props). Sur une annonce, le favori ouvre Deklic dans un nouvel onglet (ou navigue si l'ouverture est bloquée) ; ailleurs, une alerte explique.

## Patterns

- **Contrat versionné** : `CaptureSchema` porte `version: 1` ; un fragment d'une autre version est refusé proprement (`illisible`), l'écran propose le texte collé.
- **Règles déclaratives** : le code ne connaît aucun portail ; tout est dans `regles/<portail>.json`, validé par Zod au chargement (`creerRegistre` lève au démarrage plutôt qu'en silence sur une annonce). Corriger une maquette = éditer un JSON et sa fixture. Les listes de sélecteurs CSS sont parcourues dans l'ordre du document, pas dans l'ordre d'écriture : les regex portent la précision.
- **Logique sans `chrome.*`** : `src/logique/` est pur et testé ; `popup.ts` et `contenu.ts` sont des enveloppes fines, testées avec un faux `chrome` et un jsdom pointé sur l'URL d'une annonce.
- **Rien ne quitte le navigateur** : pas de `host_permissions`, pas de stockage, pas de réseau ; le fragment d'URL n'est jamais transmis au serveur (ni à Cloudflare Pages, ni au Worker).
- **Import d'espace de noms de Zod** (`import * as z from 'zod'`) dans `@loupe/capture` : les bundlers ne gardent que ce qui sert (script de contenu 116 Ko au lieu de 463 Ko avec les 40 locales). Le bouton-favori pèse 115 Ko (31 Ko gzip), soit 166 Ko en URL `javascript:` ; passer `@loupe/capture` à `zod/mini` le ramènerait vers 40 Ko, à décider si le favori devient le mode principal.

## ADR locaux

- **ADR-E1** : transport par fragment d'URL (`#capture=`) plutôt que par `chrome.storage` ou messagerie externe : aucune permission supplémentaire, fonctionne pour le bouton-favori, invisible du serveur, effacé dès la lecture.
- **ADR-E2** : règles JSON versionnées embarquées dans l'extension et dans le bouton-favori, servies par un registre unique ; le chargement distant (R2) est prévu par la structure, pas implémenté (aucun réseau depuis l'extension en v1).
- **ADR-E3** : pas de `content_scripts` déclarés dans le manifeste (ce qui exigerait des `host_permissions` sur chaque portail) : injection à la demande avec `activeTab`, seulement l'onglet courant, seulement après le clic.
- **ADR-E4** : `pap.html` est relevée sur une vraie annonce (13/09/2026, navigateur intégré) ; `leboncoin`, `seloger`, `bienici`, `logicimmo` sont construites d'après la structure connue des portails et marquées « à vérifier sur une vraie annonce ». Le moteur de règles est testé à 100 % indépendamment.
- **ADR-E5** : identité Deklic (ADR-005) appliquée aux textes, au popup et à l'icône ; noms techniques inchangés (`@loupe/capture`, `@loupe/extension`, `loupeprojet.pages.dev`, `__loupeCapture`).
