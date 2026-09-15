# Architecture : carte-interactive

Specs : `../specs/carte-interactive-specs.md`. Web seul, aucun changement du Worker, du contrat ni du moteur.

## Flux

```
Adresse.tsx
  └─ useLiaisonVentes(analyse) = useReducer(liaisonVentes) : { selection, afficher, demande, filtres, rayon }
       ├─ CarteQuartier(analyse, adresse, liaison)
       │    ├─ donneesCarte(analyse) → points avec `cle` et `vente` (rapprochée de ventesProches)
       │    ├─ pointsVisibles(points, filtres, rayon) · niveauPoint(mode) · grouperPoints
       │    ├─ BarreCarte : couleur, fond, parcelles, recentrer, plein écran
       │    ├─ gestes : onWheelCapture / onTouchStartCapture → messageGeste → message + stopPropagation
       │    └─ CarteVentes (Leaflet, lazy) : fond, parcelles, cercles cliquables, pastilles, éventail, bulle DOM
       └─ TableauVentes(analyse, liaison) : filtres et rayon contrôlés, ligne sélectionnée, « Voir sur la carte »
```

## Fichiers

| Fichier                                               | Rôle                                                                                                                                                                                                                         |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enrichissement/carte.ts`                             | + `FONDS_CARTE` (plan, photo : URL, attribution, zoom max), `COUCHE_PARCELLES`, `urlTuilesIgn(couche, style, format)`, `cleVente`, points avec `cle` et `vente: VenteProcheAdresse \| null`                                   |
| `enrichissement/carte-couleurs.ts` (nouveau, pur)     | `ModeCouleur`, `NiveauPoint`, `niveauPoint(point, mode, contexte)`, `modesCouleur(points)`, seuils d'ancienneté (365 / 1 095 jours)                                                                                           |
| `enrichissement/carte-groupes.ts` (nouveau, pur)      | `grouperPoints(points)` par coordonnées identiques, `eventail(n, rayonPx)` décalages en pixels                                                                                                                              |
| `enrichissement/carte-liaison.ts` (nouveau, pur)      | `EtatLiaison`, `ETAT_LIAISON_INITIAL`, `liaisonVentes(etat, action)`, `dansLeRayon`, `ventesVisibles`, `pageDeLaVente`                                                                                                      |
| `enrichissement/carte-gestes.ts` (nouveau, pur)       | `messageGeste(geste)` → `'ctrl' \| 'doigts' \| null`, `DUREE_MESSAGE_MS`                                                                                                                                                    |
| `textes/carte.ts`                                     | + `ficheVente(point)` (titre + lignes libellé / valeur), `legendeCouleurs(mode, repere)`, `PHRASES_CARTE` (boutons, fonds, couleurs, messages), `libelleCercle`                                                              |
| `ecrans/adresse/useLiaisonVentes.ts` (nouveau)        | réducteur + remise à zéro quand l'analyse change                                                                                                                                                                             |
| `ecrans/adresse/CarteQuartier.tsx`                    | état local couleur / fond / parcelles / plein écran / recentrage / message ; gestes ; Échap ; `role="region"` sur le cadre ; défilement vers la carte quand `afficher = 'carte'`                                             |
| `ecrans/adresse/BarreCarte.tsx` (nouveau)             | boutons radio couleur et fond, case parcelles, « Recentrer sur le bien », « Plein écran » / « Fermer la carte » ; légende                                                                                                   |
| `ecrans/adresse/CarteVentes.tsx`                      | carte créée une fois par centre ; effets séparés : fond, parcelles, pleinEcran (glisser, `invalidateSize`), recentrage, calque des points (reconstruit sur points, niveaux, sélection, zoom), bulle ; callbacks par `useRef` |
| `ecrans/adresse/bulle-vente.ts` (nouveau)             | `elementBulle(fiche, onVoirTableau)` : DOM par `document.createElement` / `textContent`, jamais de HTML en chaîne                                                                                                            |
| `ecrans/adresse/TableauVentes.tsx`                    | reçoit `liaison` ; filtres et rayon contrôlés, boutons de rayon, ligne `data-selectionnee`, bouton « Voir sur la carte », effet page + défilement + focus sur `afficher = 'tableau'`                                          |
| `ecrans/Adresse.tsx`                                  | `useLiaisonVentes` et deux props                                                                                                                                                                                             |
| `index.css`                                           | `.carte-vente-inconnu`, `.carte-vente-selectionnee`, `.carte-groupe`, `.carte-cercle-cible`, gestes (`touch-action`), message, plein écran                                                                                  |

## Décisions

- **Clé de vente** : `date|prix|surface|distanceMetres` (mêmes arrondis côté Worker pour `ventesCarte` et `ventesProches`). Une vente de carte sans ligne correspondante garde `vente: null` : pas de DPE, pas de « Voir dans le tableau », visible seulement sans filtre.
- **Gestes sans greffon** : React `onWheelCapture` sur le cadre arrête la propagation vers Leaflet sans Ctrl/⌘ hors plein écran (la page défile, défaut non empêché) ; `scrollWheelZoom` reste actif. Au doigt (`pointer: coarse`), `dragging` coupé hors plein écran : Leaflet pose alors `touch-action: pan-x pan-y` (classe `leaflet-touch-zoom` sans `leaflet-touch-drag`), un doigt fait défiler la page, deux doigts zooment et déplacent (TouchZoom). `onTouchStartCapture` à un doigt → message.
- **Plein écran** : surcouche `fixed inset-0 z-[70]` sur le cadre (pas d'API Fullscreen). Focus sur « Fermer la carte », rendu au bouton d'ouverture. Échap : ferme d'abord la bulle, puis le plein écran.
- **Barre hors Leaflet** : contrôles React (radios natives, cibles 44 px) plutôt que `L.control.layers` : accessibles, testables sous jsdom, même style que l'app.
- **Cercles cliquables** : un tracé invisible épais (`weight 16`, `pointer-events: stroke`) par cercle, info-bulle « Filtrer à moins de N m » ; le rayon filtre sur `distanceMetres ≤ N`.
- **Éventail** : un seul groupe ouvert ; décalages en pixels convertis à chaque zoom ; la vente choisie dans le tableau ouvre son groupe.
- **Bulle** : un seul `L.popup` réutilisé ; la fermeture par la personne remet la sélection à `null` ; « Voir dans le tableau » absent si la vente n'est pas dans le tableau.
- **Ancienneté** : par rapport au jour de l'affichage (passé en paramètre, fonction pure).
- **Tuiles** : `ORTHOIMAGERY.ORTHOPHOTOS` (`image/jpeg`, style `normal`) et `CADASTRALPARCELS.PARCELLAIRE_EXPRESS` (`image/png`, style `PCI vecteur`) sur `data.geopf.fr/wmts`, `TILEMATRIXSET=PM`, vérifiées en réel le 15/09/2026.

## Implémentation (ordre, un commit par story)

1. US-2 + US-3 logique pure (fonds, couleurs, groupes, fiche) → commit.
2. US-4 liaison pure + hook + tableau contrôlé → commit.
3. US-1, US-3, US-5 composants carte (barre, gestes, plein écran, Leaflet, bulle) → commit.
4. e2e (données simulées liées, parcours ordinateur et téléphone) → commit.

## Auto-revue critique

- Fichiers : `CarteVentes.tsx` risque de dépasser 300 lignes → bulle en `bulle-vente.ts`, calque des points en fonction interne ; à surveiller au refactor.
- Sécurité : aucun `innerHTML` ; textes des ventes (adresse DVF) posés par `textContent` ; aucune donnée envoyée hors tuiles IGN (zone affichée seulement).
- Performance : ≤ 300 points, calque reconstruit au plus à chaque sélection ou zoom : négligeable.
- Tableau de S7 : changement limité aux filtres contrôlés, au rayon, à la ligne sélectionnée ; ses tests existants doivent rester verts sans modification de leurs attentes.
- Validé : on implémente.
