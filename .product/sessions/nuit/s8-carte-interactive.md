# S8 — `carte-interactive` (fiche 15)

Branche `feat/carte-interactive` · **Prérequis : `feat/estimation-ventes`** · Règles : `_regles-nuit.md`

## Objectif

Carte des ventes interactive. Détail et propositions : `C:\Users\errei\Claude\loupe-backlog\.product\backlog\15-carte-interactive.md`.

- Gestes : Ctrl + molette, deux doigts au téléphone (un doigt fait défiler la page), plein écran (Échap pour fermer), « Recentrer sur le bien ».
- Clic sur une vente : bulle construite en DOM (fonction pure `ficheVente`), « Voir dans le tableau » ; clic sur une ligne du tableau (livré par S7) : la carte centre et ouvre la bulle ; sélection partagée remontée dans `Adresse.tsx`.
- Regroupement des ventes au même point (maison d'abord ; `leaflet.markercluster` seulement si nécessaire).
- Couleur des pastilles : prix au m² / ancienneté / DPE ; fonds Plan IGN, photo aérienne, parcelles cadastrales ; clic sur un cercle filtre le tableau.
- `role="region"` au lieu de `role="img"` ; impression inchangée.

## Périmètre

`apps/web/src/ecrans/adresse/{CarteQuartier,CarteVentes}.tsx`, `enrichissement/carte*.ts`, `textes/carte.ts`, branchement minimal dans `Adresse.tsx` et le tableau des ventes (sélection partagée), `index.css` (styles de carte), tests Vitest et un e2e au format téléphone avec `page.route`.

## Hors périmètre

Worker, données, tri et filtres du tableau (déjà livrés), placement du bien par clic sur la carte (hors fiche).

## Fin

PR fusionnée ; rapport `C:\Users\errei\Claude\rapports-nuit\carte-interactive.md`.
