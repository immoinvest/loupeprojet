# Architecture — Analyse DVF à l'adresse

```
data/src/
├── schemas/dvf.ts               VenteSchema + idParcelle, numero, suffixe, codeVoie, voie, carrez ; EN_TETE_VENTES (colonnes ajoutées en fin)
└── sources/dvf/
    ├── vente.ts                 lecture des colonnes d'adresse et de parcelle, Carrez = somme des lots de la ligne du logement
    └── csv-sortie.ts            nom de voie sans virgule ni guillemet (CSV lisible sans échappement)

apps/worker/src/
├── donnees/
│   ├── lecteur.ts               LecteurDonnees { lireJson, lireTexte } : R2 et mémoire
│   └── passe.ts                 Passe (panne ⇒ pas de cache), lireJsonValide, lireTexte — partagés par /marche et /marche/adresse
├── marche/millesime.ts          millesimesDvfAEssayer : dvf/courant.json ou les trois dernières années
└── adresse/
    ├── ventes.ts                lireVentes : CSV de la commune → ventes (ancien format toléré, lignes illisibles ignorées)
    ├── geometrie.ts             distanceMetres (haversine), distancePointSegment, distanceAnneaux (projection locale en mètres)
    ├── analyse.ts               pur : groupesDe, estComparable, statistiquesPrix (quantiles méthode 7), analyserAdresse (groupes, repère, ventes proches)
    ├── cadastre.ts              API Carto IGN : parcelle au point, candidates dans une boîte élargie, voisines à moins de 3 m
    ├── route.ts                 GET /marche/adresse : validation, cache 24 h, voisinage en cache 30 jours, réponse
    └── index.ts

apps/web/src/
├── enrichissement/
│   ├── contrat.ts               ReponseAdresseSchema, CodeGroupeSchema ; cleBan dans le géocodage
│   ├── client.ts                analyserAdresse ; geocoder sans code postal
│   └── adresse.ts               lireCleBan (code de voie, numéro), marcheDepuisReference, ecartAuRepere
├── textes/adresse.ts            libellés des groupes, phrases (précision, repère, pannes)
├── stockage/projets.ts          AdresseBienSchema, ProjetEnregistre.adresse (facultatif)
├── stockage/ProjetsContext.tsx  mettreAJour(id, projet, { adresse }) : une seule écriture
└── ecrans/Adresse.tsx (+ adresse/Tableaux.tsx)   onglet « Adresse » du projet
```

## Contrat `GET /marche/adresse`

Paramètres : `codeInsee`, `lat`, `lon` (adresse géocodée au numéro), `numero` et `codeVoie` (depuis la clé BAN, facultatifs), `type` (`appartement` par défaut), `surface` (facultative).

Réponse `200` : `{ codeInsee, millesime, parcelle, parcellesVoisines, cadastre: 'ok' | 'indisponible', ventesCommune, groupes, reference, ventesProches, sources, obtenuLe }`

- `groupes` : sept entrées `{ code, ventes, comparables, statistiques: { ventes, medianeM2, q1M2, q3M2, minM2, maxM2 } | null, distanceMaxMetres }` — `meme_parcelle`, `parcelles_voisines`, `meme_cote`, `en_face`, `rayon_100`, `rayon_200`, `rayon_300` ;
- `reference` : `{ code, rayonMetres, statistiques }` ou `null` ;
- `ventesProches` : jusqu'à 20 ventes comparables `{ date, prix, surface, prixM2, pieces, type, adresse, distanceMetres, groupes }`, de la plus proche à la plus lointaine (sans coordonnées en dernier).

Erreurs : `400 PARAMETRES_INVALIDES`, `429 TROP_DE_REQUETES`.

## Décisions

- **Aucun modèle de langage** : égalités (parcelle, voie), parité, distances ; le résultat est reproductible et testé à la main.
- **Voisinage cadastral** : l'API Carto ne renvoie pas les parcelles qui touchent un contour ; on interroge une boîte élargie de 0,00015° (12 à 17 m) et on garde les contours à moins de 3 m du bien (plus courte distance sommet-segment dans les deux sens, en projection locale).
- **Repère** : premier groupe à au moins 5 comparables, dans l'ordre immeuble, voisines, même côté, 100 m, en face, 200 m, 300 m ; `rayonMetres` = distance maximale de ses comparables (10 m au minimum), écrit dans `marche.dvf.rayonMetres`.
- **Caches** : analyse 24 h par jeu de paramètres ; voisinage 30 jours par point arrondi au millionième ; rien n'est mis en cache si le cadastre ou R2 a échoué.
- **Web** : l'adresse est mémorisée avec le projet (jamais le résultat de l'analyse, recalculé à l'ouverture de l'onglet) ; le repère n'est appliqué au verdict que sur clic.

## Tests

- Données : vente adressée (parcelle, voie, Carrez, numéro absent), CSV publié au nouveau format. Couverture 100 %.
- Worker `tests/adresse.test.ts` et `tests/adresse-sans-voie.test.ts` : lecture CSV (nouveau et ancien format), géométrie, statistiques, classement, repère (même côté, repli, sans coordonnées), cadastre (voisines mitoyennes, pannes), route (cache, cadastre en cache illisible, panne, commune absente, débit, sans numéro). Couverture 100 %.
- Web `tests/adresse.test.ts` (clé BAN, repère, textes, client) et `tests/adresse-ecran.test.tsx` (parcours complet avec faux Worker, réouverture, six cas d'échec).
