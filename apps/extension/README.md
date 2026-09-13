# Extension navigateur Loupe (`@loupe/extension`)

Un clic sur l'icône Loupe, sur une annonce LeBonCoin, SeLoger, Bien'ici, PAP ou Logic-Immo, lit la page **dans votre navigateur** et ouvre Loupe avec le formulaire « Vérifier » pré-rempli. La page n'est jamais lue par nos serveurs (ADR-002) ; le texte de l'annonce sert à l'extraction puis disparaît : seuls les champs lus sont conservés.

## Construire

```bash
npm run build -w apps/extension       # production : ouvre https://loupeprojet.pages.dev
npm run build:dev -w apps/extension   # développement : ouvre http://localhost:5173
npm run dev -w apps/extension         # développement + reconstruction à chaque modification
```

Sortie : `apps/extension/dist/chrome/` (Chrome, Edge, Brave) et `apps/extension/dist/firefox/` (même contenu, manifeste complété pour Firefox). Les icônes sont générées au build, rien de binaire n'est versionné.

## Charger l'extension non empaquetée

**Chrome, Edge, Brave** : ouvrir `chrome://extensions` (ou `edge://extensions`), activer le **mode développeur**, cliquer **Charger l'extension non empaquetée** et choisir le dossier `apps/extension/dist/chrome`. Épingler l'icône Loupe dans la barre d'outils.

**Firefox** : ouvrir `about:debugging#/runtime/this-firefox`, cliquer **Charger un module complémentaire temporaire…** et choisir `apps/extension/dist/firefox/manifest.json`. L'extension disparaît à la fermeture de Firefox : c'est le fonctionnement des modules temporaires.

La publication sur les stores (Chrome Web Store, Add-ons Mozilla) demande un compte et des frais : décision à prendre plus tard. En attendant, le bouton-favori de la page `/extension` de Loupe fonctionne sans installation.

## Utiliser

1. Ouvrir une annonce sur l'un des cinq portails.
2. Cliquer sur l'icône Loupe : le popup indique « Annonce leboncoin.fr reconnue ».
3. Cliquer **Analyser dans Loupe** : un onglet Loupe s'ouvre sur `/projets/nouveau`, le formulaire est pré-rempli avec ce que la page dit (badges `annonce`), le reste est à vous.

Sur toute autre page, le bouton est inactif et le popup explique quoi ouvrir.

## Comment ça marche

- `src/popup.ts` : reconnaît l'onglet actif (`chrome.tabs.query`), injecte le script de contenu au clic (`chrome.scripting.executeScript`, permission `activeTab` : seulement l'onglet courant, seulement après le clic), reçoit la capture et ouvre `BASE/projets/nouveau#capture=<capture encodée>`. Le fragment d'URL n'est jamais envoyé au serveur.
- `src/contenu.ts` : applique les règles du portail à la page (`@loupe/capture`) et dépose le résultat dans son monde isolé ; aucune requête réseau, aucune modification de la page.
- `regles/<portail>.json` : les règles de lecture, un fichier par portail, versionnées `<portail>-AAAA-MM-JJ`. Pour chaque champ, une liste d'extracteurs essayés dans l'ordre : `jsonld` (schema.org), `json` (état applicatif, ex. `__NEXT_DATA__`), `meta` (`og:`…), `css` (sélecteur + regex). Le premier qui donne une valeur valide gagne. La structure est prévue pour être servie un jour depuis R2 sans republier l'extension.
- Permissions : `activeTab` et `scripting`, rien d'autre. Pas de `host_permissions`, pas de stockage, pas de réseau.

## Corriger un portail qui a changé de maquette

1. Ouvrir une annonce du portail, relever le nouveau sélecteur (ou le chemin JSON-LD).
2. Modifier `regles/<portail>.json` et dater la `version`.
3. Mettre à jour `tests/fixtures/<portail>.html` avec la nouvelle structure (données fictives, jamais de coordonnées réelles) et lancer `npm run test -w apps/extension`.
4. Reconstruire l'extension.

État des fixtures : `pap.html` reproduit la structure relevée sur une vraie annonce le 13/09/2026 ; `leboncoin.html`, `seloger.html`, `bienici.html` et `logicimmo.html` sont construites d'après la structure connue des portails et restent **à vérifier sur une vraie annonce**.
