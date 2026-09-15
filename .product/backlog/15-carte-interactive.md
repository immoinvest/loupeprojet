# 15 — Carte des ventes interactive

Statut : `idée` · Notée le 14/09/2026 · Dépend de : 14 (tableau des ventes triable, DPE des ventes) pour la liaison carte ↔ tableau · Taille : une session (web seul)

## La demande de Pierre

> Je veux que la carte soit plus interactive : je peux facilement zoomer, cliquer, voir les transactions. Rends-la plus interactive.

## Ce qui existe aujourd'hui

- `apps/web/src/ecrans/adresse/CarteQuartier.tsx` (carte, légende, chargement à la demande) et `CarteVentes.tsx` (Leaflet 1.9, fond Plan IGN) dans l'onglet Estimation.
- Réglages actuels, choisis pour ne pas gêner le défilement de la page : **molette désactivée** (`scrollWheelZoom: false`), **déplacement désactivé au doigt** (`dragging: !auDoigt`), zoom seulement par les boutons + et −.
- Chaque vente = une pastille colorée selon son prix au m² (bas / milieu / haut) avec une **infobulle au survol** (`libelleVenteCarte`) ; **aucun clic** : pas de fiche de la vente, pas de lien avec le tableau.
- Cercles 100 / 200 / 300 m non cliquables ; le bien au centre ; cadrage fixe sur 300 m + 40 m ; `role="img"` (la carte n'est pas utilisable au clavier, les tableaux servent d'alternative).
- Points : `donneesCarte(analyse)` (`enrichissement/`) à partir des 20 `ventesProches` géolocalisées.

## Ce que ça changerait pour l'utilisateur

1. **Zoomer et se déplacer facilement, sans piéger la page** :
   - ordinateur : molette **quand la souris est sur la carte avec Ctrl** (message « Ctrl + molette pour zoomer » au premier essai), glisser pour déplacer, double-clic pour zoomer ;
   - téléphone : **deux doigts** pour déplacer et zoomer (un doigt fait toujours défiler la page, avec le message « Utilisez deux doigts ») ;
   - bouton **« Plein écran »** : la carte prend tout l'écran, tous les gestes libres, Échap ou « Fermer » pour revenir ;
   - bouton **« Recentrer sur le bien »**.
2. **Cliquer une vente** ouvre sa fiche dans une bulle : date, prix, surface, pièces, prix au m² brut et d'aujourd'hui, distance, place (même immeuble, même côté…), DPE et dépendances si connus (fiche 14), bouton « Voir dans le tableau ».
3. **Carte et tableau liés** : cliquer une ligne du tableau des ventes centre la carte sur la vente et ouvre sa bulle ; la vente sélectionnée est mise en avant des deux côtés ; les filtres et le tri du tableau (fiche 14) s'appliquent aux pastilles.
4. **Plusieurs ventes au même endroit** (même immeuble) : une pastille avec le nombre (« 4 ») qui s'ouvre en éventail au clic.
5. **Choisir la couleur des pastilles** : prix au m² (défaut), ancienneté de la vente, DPE.
6. **Fonds de carte** : Plan IGN (défaut), photo aérienne IGN, et une couche « parcelles cadastrales » pour voir l'immeuble et ses voisines (celles de l'analyse « même immeuble / parcelles voisines »).
7. Cliquer un cercle (100, 200, 300 m) filtre le tableau sur ce rayon.

## Proposition de réalisation

- **Gestes** : réglage maison plutôt qu'un greffon : Leaflet expose `scrollWheelZoom`, `dragging`, `touchZoom` ; on les active selon `ctrlKey` (événement `wheel`) et le nombre de doigts (`touchstart`), avec une surcouche de message qui s'efface. Alternative : greffon `leaflet-gesture-handling` (MIT) si le code maison dépasse ~80 lignes.
- **Plein écran** : l'API Fullscreen du navigateur sur le conteneur, repli en `fixed inset-0` (iOS Safari n'autorise pas le plein écran sur un `div`) ; `carte.invalidateSize()` après bascule.
- **Bulles** : `bindPopup` avec un contenu construit en DOM (pas de HTML en chaîne, règle « pas d'injection ») à partir d'une fonction pure `ficheVente(vente)` → lignes libellé / valeur, testée.
- **Regroupement** : `leaflet.markercluster` (MIT, ~40 Ko, chargé avec la carte) avec `spiderfyOnMaxZoom`, ou regroupement maison par coordonnées identiques (plus léger, suffit pour « même immeuble »). Proposition : maison d'abord, greffon si la fiche 14 affiche 300 ventes.
- **Sélection partagée** : état `venteSelectionnee` remonté dans `Adresse.tsx`, passé à `CarteQuartier` et au tableau ; identifiant stable d'une vente (date + prix + parcelle).
- **Fonds IGN** : Géoplateforme WMTS, couches `GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2` (déjà), `ORTHOIMAGERY.ORTHOPHOTOS` et `CADASTRALPARCELS.PARCELLAIRE_EXPRESS` ; gratuites, sans clé, même attribution IGN. Contrôle `L.control.layers`.
- **Accessibilité** : la carte reste doublée par le tableau (qui a les mêmes informations et le tri) ; boutons des contrôles nommés ; la bulle se ferme à Échap ; `role="img"` remplacé par `role="region"` + `aria-label` puisque la carte devient interactive.
- **Impression** : inchangée (carte masquée, tableaux imprimés).

## Questions ouvertes

1. **Gestes par défaut** : Ctrl + molette et deux doigts (proposition, comme Google Maps intégré), ou tout libre dès qu'on clique dans la carte ?
2. **Plein écran** : bouton seulement (proposition) ou ouverture automatique au premier toucher sur téléphone ?
3. **Photo aérienne et cadastre** : utiles tout de suite (proposition : oui, trois fonds dans un sélecteur), ou plan seul pour rester simple ?
4. **Couleur des pastilles** : le sélecteur prix / date / DPE, ou seulement le prix ?
5. Montrer aussi sur la carte **les DPE du quartier** (`CarteDpe`, ADEME à 30 m) ? Proposition : non, hors sujet de la carte des ventes.

## Tests à mettre à jour

- Vitest : `tests/carte.test.tsx` (déjà présent sur master : points, légende) ; nouveaux : `ficheVente` (champs manquants, DPE absent), regroupement par coordonnées, sélection partagée carte ↔ tableau (clic ligne → vente sélectionnée), message des gestes. Leaflet sous jsdom : garder la logique dans des fonctions pures et tester le composant avec un Leaflet simulé, comme aujourd'hui.
- Playwright : l'e2e n'a pas de Worker → carte absente ; un parcours avec réponse `/marche/adresse` simulée (`page.route`) pour : clic sur une pastille → bulle ; clic « Voir dans le tableau » → ligne mise en avant ; plein écran ouvert puis fermé à Échap ; au format téléphone, un doigt fait défiler la page.

## Coût et risques

- Aucun appel à nos serveurs ; tuiles IGN supplémentaires (photo, cadastre) chargées seulement si on change de fond, gratuites.
- Poids : +0 à 40 Ko selon le choix du regroupement, chargés avec la carte (déjà à la demande).
- Risque : gestes mal réglés qui bloquent le défilement sur téléphone → test e2e au format téléphone obligatoire.
