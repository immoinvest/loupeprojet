# Marque Deklic

Identité de marque du produit, décidée le 13 septembre 2026 (ADR-005 : `.product/adr/005-identite-marque.md`). Ce dossier est la **source de vérité** des éléments visuels : l'application (`apps/web`) en reprend des copies (favicon, icônes, composant React).

## Le nom

**Deklic** : le déclic, l'instant où l'annonce devient une décision. Écrit avec un K pour être une marque et non un mot du dictionnaire. Prononcé « dé-klik ». Toujours avec une majuscule dans le texte (« Deklic »), toujours en minuscules dans le logotype (« deklic »).

## Les fichiers

| Fichier                                | Usage                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `logo/deklic-logotype.svg`             | Logo principal : icône + mot, couleurs. Barre latérale, en-têtes, documents, présentations.       |
| `logo/deklic-logotype-mono.svg`        | Même logo en une couleur (encre). Impression noir et blanc, filigranes, tampons.                  |
| `logo/deklic-logotype-blanc.svg`       | Même logo en blanc. Sur fond bleu, photo sombre, vidéo.                                           |
| `logo/deklic-icone.svg`                | Icône seule (maison + éclats), fond transparent. Favicon, avatars, puces.                         |
| `logo/deklic-icone-mono.svg`           | Icône en une couleur (encre).                                                                     |
| `logo/deklic-icone-blanc.svg`          | Icône en blanc.                                                                                   |
| `logo/deklic-icone-app.svg`            | Icône d'app : maison blanche et éclats orange sur carré bleu arrondi. Source des PNG ci-dessous.  |
| `logo/deklic-mot.svg`                  | Le mot seul, en tracés (pas de police à installer). Quand l'icône est déjà présente ailleurs.     |
| `logo/deklic-mot-mono.svg`             | Le mot seul, en une couleur.                                                                      |
| `favicon/favicon.svg`                  | Favicon vectoriel (copie de l'icône). Copié dans `apps/web/public/`.                              |
| `favicon/icon-192.png`, `icon-512.png` | Icônes du manifeste web (écran d'accueil Android, PWA). Copiées dans `apps/web/public/`.          |
| `favicon/apple-touch-icon.png`         | Icône iOS 180 × 180, fond opaque. Copiée dans `apps/web/public/`.                                 |
| `partage/og-image.png`                 | Image de partage 1200 × 630 (liens sur les réseaux, messageries). Copiée dans `apps/web/public/`. |
| `couleurs.json`                        | La palette en un fichier lisible par un script.                                                   |

Le mot est converti en **tracés** à partir de la police Sora Bold (licence SIL Open Font License, Google Fonts), interlettrage −5 %. Il n'y a donc aucune police à charger pour afficher le logo, et il s'affiche pareil partout.

## Le logo

L'icône est dessinée sur une grille de 64 × 64 : une **maison** (bleu) et **trois éclats** au sommet (orange), le déclic. Dans le logotype, le mot est placé à 14 unités de l'icône, ligne de base à 56, ascendantes à 10 ; ratio du logotype 399 / 64.

Règles :

- Hauteur minimale du logotype : 20 px à l'écran, 8 mm imprimé. En dessous, utiliser l'icône seule.
- Espace libre autour du logo : au moins la hauteur de la maison (36 unités sur 64).
- Ne pas changer les couleurs, ne pas étirer, ne pas incliner, ne pas ajouter d'ombre ni de contour.
- Sur fond bleu ou sombre : version blanche. Sur photo claire : version couleurs ou mono.
- Le « i » orange du mot reprend l'éclat de l'icône : c'est le seul endroit où l'orange touche le texte.

## Les couleurs

| Rôle              | Nom              | Hex                   | Usage                                                                                                                                                                      |
| ----------------- | ---------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Principale        | Bleu électrique  | `#2B4BF2`             | Maison du logo, boutons d'action, liens, focus. Contraste 6,3 : 1 sur blanc (AA texte).                                                                                    |
| Principale foncée | Bleu pressé      | `#1F38C4`             | Survol des boutons et liens.                                                                                                                                               |
| Éclat             | Orange flash     | `#FF7A1A`             | Les trois éclats et le « i » du logo, les moments de célébration (projet créé, feu vert). Jamais un état sémantique : « à surveiller » garde son orange à lui (`#D98A1E`). |
| Fonds bleus       | Bleu doux / fond | `#E8ECFF` / `#F5F7FF` | Sélection active, encarts, fond du logotype blanc en aperçu.                                                                                                               |
| Bordure bleue     | Bleu bordure     | `#D9DFFF`             | Cartes mises en avant.                                                                                                                                                     |
| Fond flash        | Orange pâle      | `#FFF1E6`             | Fond des messages de célébration.                                                                                                                                          |
| Papier            | Blanc chaud      | `#FFFDF9`             | Fond de l'application (inchangé, ADR-004).                                                                                                                                 |
| Encre             | Encre            | `#23272F`             | Texte (inchangé, ADR-004). L'encre profonde du logo mono est `#12173A`.                                                                                                    |

Les tokens correspondants vivent dans `apps/web/src/index.css` (`--color-accent`, `--color-accent-fonce`, `--color-accent-doux`, `--color-accent-fond`, `--color-accent-bordure`, `--color-flash`, `--color-flash-fond`).

## Les typographies

- **Logotype** : Sora Bold, en tracés. Ne jamais recomposer le mot avec une autre police.
- **Interface** : Outfit (titres) et Nunito Sans (texte), inchangées depuis l'ADR-004. Le logo a sa propre police, l'interface garde la sienne : c'est voulu, comme chez la plupart des marques.

## Le ton

Deux registres, une marque : **fun** là où on découvre (accueil, états vides, chargement, feux), **calme** là où on décide (rapport, fiscalité, quittance). Les boutons parlent à la première personne : « Analyser mon annonce », « Voir mon cash-flow ». L'ennemi désigné est le tableur bricolé.

## Domaines et marque

Au 13 septembre 2026 : `deklic.fr` est pris ; `deklic.io`, `deklic.ai`, `mondeklic.fr` et `deklic-app.fr` étaient libres. Recherche INPI à faire avant tout achat (homonymes connus : le média Deklic.eco, des sociétés de conseil « Deklic », des agences « Déclic »). L'image de partage pointe pour l'instant sur `https://loupeprojet.pages.dev/og-image.png` : à changer quand le domaine sera choisi.

## Refaire les fichiers

Les SVG sont générés par des scripts Node (fontkit, Sora Bold) qui ont servi le 13 septembre 2026 ; les PNG sont des captures d'Edge sans fenêtre des SVG. Pour modifier le logo : éditer les SVG de `logo/` à la main (ils sont courts et lisibles), puis régénérer les PNG et le composant `apps/web/src/marque/Logo.tsx`, qui reprend les mêmes tracés.
