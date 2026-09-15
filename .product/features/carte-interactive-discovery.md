# Discovery : carte-interactive (fiche de backlog 15)

Session de nuit S8 du 15/09/2026. Fiche : `../backlog/15-carte-interactive.md`. Prérequis livré : `estimation-ventes` (PR #87 : tableau des ventes triable, filtré, paginé, DPE des ventes, contrat `/marche/adresse` v7).

## La demande

> Je veux que la carte soit plus interactive : je peux facilement zoomer, cliquer, voir les transactions.

## Ce qui existe (master af2476e6)

- `ecrans/adresse/CarteQuartier.tsx` : titre, phrase, légende prix (bas / milieu / haut), `CarteVentes` chargée à la demande.
- `ecrans/adresse/CarteVentes.tsx` : Leaflet 1.9, Plan IGN, molette coupée, glisser coupé au doigt, cercles 100/200/300 m non cliquables, pastilles avec infobulle au survol, cadrage fixe, `role="img"`.
- `enrichissement/carte.ts` : `donneesCarte(analyse)` sur `ventesCarte` (jusqu'à 300 ventes géolocalisées : lat, lon, date, prix, surface, prix corrigé, distance, groupes).
- `ecrans/adresse/TableauVentes.tsx` (S7) : `ventesProches` (jusqu'à 300, carrez, parcelle, DPE probable, dépendances…), tri, filtres et page **en état local**.
- **Aucun identifiant commun** entre `ventesCarte` et `ventesProches` ; le Worker est hors périmètre. Les deux listes viennent des mêmes ventes situées, avec les mêmes arrondis (`date`, `prix`, `surface`, `Math.round(distance)`) : la clé `date|prix|surface|distance` les rapproche sans toucher au Worker.

## Résultats attendus (outcomes)

1. Zoomer et se déplacer sans piéger le défilement de la page (ordinateur et téléphone).
2. Voir le détail d'une vente d'un clic, et passer de la carte au tableau et inversement.
3. Lire les ventes superposées (même immeuble).
4. Choisir ce que disent les couleurs et le fond de carte.

## Livrables (outputs)

- Gestes : Ctrl (ou ⌘) + molette, deux doigts au téléphone, message « Ctrl + molette pour zoomer » / « Utilisez deux doigts pour déplacer la carte » qui s'efface ; plein écran (bouton, Échap ou « Fermer ») où tout est libre ; « Recentrer sur le bien ».
- Bulle d'une vente construite en DOM depuis la fonction pure `ficheVente`, bouton « Voir dans le tableau » ; bouton « Voir sur la carte » dans chaque ligne du tableau ; vente sélectionnée mise en avant des deux côtés ; filtres du tableau appliqués aux pastilles.
- Regroupement maison des ventes au même point (pastille chiffrée, éventail au clic).
- Couleur : prix au m² (défaut), ancienneté, DPE (si des DPE sont connus) ; fonds Plan IGN, photo aérienne IGN, surcouche parcelles cadastrales.
- Clic sur un cercle = filtre « À moins de N m » du tableau (aussi en boutons dans les filtres du tableau).
- `role="region"` + `aria-label` ; impression inchangée (carte masquée).

## Périmètre

Web seul : `ecrans/adresse/{CarteQuartier,CarteVentes}.tsx` et nouveaux fichiers de la carte dans `ecrans/adresse/`, `enrichissement/carte*.ts`, `textes/carte.ts`, branchement dans `Adresse.tsx` et `TableauVentes.tsx`, `index.css`, tests Vitest, e2e `carte.spec.ts` et réponses simulées.

## Hors périmètre

Worker et contrat, données, tri et filtres existants du tableau (seulement rendus « contrôlés » et complétés du rayon), placement du bien par clic, DPE du quartier sur la carte.

## Décisions sur les questions ouvertes (propositions de la fiche)

1. Gestes : Ctrl + molette et deux doigts (comme Google Maps intégré).
2. Plein écran : bouton seulement. Réalisé en **surcouche `fixed inset-0`** plutôt que par l'API Fullscreen : même comportement partout (iOS Safari refuse le plein écran d'un `div`), Échap géré par l'écran, rien à autoriser.
3. Photo aérienne et cadastre : oui, sélecteur de fond + case « Parcelles cadastrales ».
4. Couleur : sélecteur prix / ancienneté / DPE (DPE proposé seulement si au moins une vente en a un).
5. DPE du quartier sur la carte : non.
6. Regroupement : maison (coordonnées identiques), pas de `leaflet.markercluster` (0 Ko ajouté).

## Contraintes

- Leaflet absent de jsdom : toute la logique en fonctions pures (`enrichissement/`, couverture 100 %), composant Leaflet mince prouvé par Playwright.
- Pas de HTML en chaîne (bulles et pastilles chiffrées construites en DOM).
- Mobile d'abord, cibles de 44 px au doigt, `print:hidden`, écran déjà dans `ecransDeReference`.
- Aucun appel à nos serveurs ; tuiles IGN gratuites sans clé, chargées seulement si on change de fond.

## Risques

- Gestes mal réglés qui bloquent le défilement au téléphone → e2e au format téléphone (un doigt fait défiler la page).
- Clé de rapprochement ambiguë (deux ventes identiques au même endroit le même jour) → première trouvée, sans effet grave (mêmes chiffres).
- Réponses simulées de l'e2e modifiées (24 ventes liées) → la spec des formats doit rester verte.

## Auto-revue critique

- La fiche S8 cite « `leaflet.markercluster` seulement si nécessaire » : le Worker plafonne à 300 points, le regroupement par coordonnées identiques suffit pour « même immeuble ». Validé.
- Le rapprochement par clé évite un redéploiement du Worker cette nuit ; un identifiant fourni par le Worker serait plus propre : noté comme amélioration possible dans le rapport.
- Filtres remontés dans `Adresse.tsx` : changement minimal du tableau de S7 (état contrôlé), nécessaire pour « les filtres s'appliquent aux pastilles ». Validé, on passe aux specs.
