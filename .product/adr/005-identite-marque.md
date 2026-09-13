# ADR-005 : Identité de marque « Deklic »

**Date** : 2026-09-13 · **Statut** : accepté · **Décideur** : Pierre, sur deux tournées de propositions et un benchmark

## Contexte

« Loupe » était le nom de travail. Il dit l'analyse (la loupe sur l'annonce) mais reste muet sur la suite du produit : location, locataires, quittances, baux. Le benchmark de onze marques (Jinka, MoteurImmo, Horiz.io, Beanstock, Ouiker, BailFacile, Manda, Matera, LyBox, Pretto, Alan) a montré que les proptech qui ont grandi ont toutes dû se renommer (Rendement Locatif → Horiz.io, LouerAgile → Jinka, illiCopro → Matera) parce que leur nom ne disait qu'une fonction. Pierre voulait une marque **fun** et **simple**, un nom **cool** et **mémorable** plutôt que littéral ; il a écarté « Proprio » (trop terre à terre) après une première tournée.

Trois documents ont servi à décider (canevas privés) :

- première tournée : https://claude.ai/code/artifact/22c76c40-ee65-4d28-bfc6-be526bc3056c (Proprio, Palier, Brique, Carré, Piaule, Loyo) ;
- benchmark : https://claude.ai/code/artifact/b85b849b-0b43-410f-b9c5-5cb1dd7d8e0e ;
- deuxième tournée : https://claude.ai/code/artifact/af03b0ad-4328-438d-b5dd-cb538f4a7ec6 (Kabane, Lucarne, Deklic, Pousse, Pactole, Toity).

## Décision

**Deklic** : le déclic, l'instant où l'annonce devient une décision. Écrit avec un K pour être une marque. Le nom parle du produit (l'analyse qui fait tilt) sans parler d'immobilier, donc il tiendra tout ce que le SaaS ajoutera (gestion locative, quittances, fiscalité).

| Élément       | Décision                                                                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Icône         | Une maison et trois éclats au sommet, sur une grille de 64 × 64. Lisible à 16 px, en une couleur, en blanc.                                                                                |
| Logotype      | Icône + mot « deklic » en minuscules, Sora Bold converti en tracés (interlettrage −5 %), le « i » en orange. Ratio 399 / 64.                                                               |
| Couleurs      | Bleu électrique `#2B4BF2` (principale, actions), orange flash `#FF7A1A` (éclats et célébrations, jamais sémantique), blanc chaud et encre de l'ADR-004 conservés.                          |
| Typographies  | Logotype en Sora (tracés). Interface inchangée : Outfit + Nunito Sans (ADR-004).                                                                                                           |
| Ton           | Deux registres : fun là où on découvre, calme là où on décide. Boutons à la première personne. Ennemi désigné : le tableur bricolé.                                                        |
| Fichiers      | Dossier `marque/` à la racine (logos SVG, favicon, icônes 192 / 512 / 180, image de partage 1200 × 630, palette JSON, guide `README.md`).                                                  |
| Application   | `apps/web` : favicon, manifeste web, `theme-color`, balises de partage, tokens `--color-accent*` et `--color-flash*`, composant `LogotypeDeklic` dans la barre latérale, textes.           |
| Noms internes | Inchangés : dépôt `loupeprojet`, paquet `@loupe/moteur`, clé de stockage local `loupe.projets.v1`, projet Cloudflare Pages `loupeprojet`. Un renommage technique est une décision séparée. |

## Conséquences

- L'accent passe de l'indigo `#4F55D8` à `#2B4BF2` : boutons, liens, focus, sélection active changent de bleu dans toute l'app, sans autre modification de maquette.
- L'orange flash est une couleur de marque, pas un état : les feux « à surveiller » gardent leur orange `#D98A1E`.
- Le logo ne dépend d'aucune police chargée : rendu identique dans l'app, un PDF, un mail.
- L'image de partage pointe sur `https://loupeprojet.pages.dev/og-image.png` jusqu'au choix du domaine.

## Reste à faire (décisions de Pierre)

- Recherche INPI sur « Deklic » (classes 36 et 42). Homonymes connus : le média Deklic.eco, des sociétés de conseil « Deklic », des agences immobilières « Déclic ».
- Domaine : au 13/09/2026, `deklic.fr` pris ; `deklic.io`, `deklic.ai`, `mondeklic.fr`, `deklic-app.fr` libres. Achat et choix de l'extension.
- Renommage technique éventuel (dépôt, paquet, projet Pages) : coût non nul, aucun bénéfice utilisateur, à décider plus tard.

## Écarté

- Première tournée : Proprio (recommandé puis écarté par Pierre : trop littéral), Palier, Brique (Bricks.co), Carré (mot saturé), Piaule (ton), Loyo.
- Deuxième tournée : Kabane (homonymes, argot « en cabane »), Lucarne (seul le .ai libre), Pousse (mot doux), Pactole (ton), Toity (mignon plus que cool), Poulpi (marque déposée FR4590400).
- Tous les mots simples testés (Zinc, Sésame, Cabane, Igloo, Coucou, Tipi, Pénates, Murmure…) sont pris en .fr, .io et .ai.
