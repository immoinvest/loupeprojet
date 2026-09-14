# Architecture — marche-complet

Voir la discovery : `.product/features/marche-complet-discovery.md`.

## US-1 — worker : `/proxy/dpe`

`apps/worker/src/services/dpe.ts`, service du proxy existant (liste blanche, cache KV, contrat validé) :

- paramètres : `lat`, `lon`, `rayon` (10 à 100 m, 30 par défaut) ;
- amont : ADEME `dpe03existant/lines?geo_distance=lon,lat,rayon&size=50&select=…&sort=-date_etablissement_dpe` ;
- réponse Deklic : `{ dpe: [{ numero, date, finValidite, etiquetteDpe, etiquetteGes, typeBatiment, surface, etage, complement, cleBan, anneeConstruction, distanceMetres }] }`, triée par distance puis date ;
- TTL 7 jours.

## US-2 — worker : `/proxy/risques`

`apps/worker/src/services/risques.ts` :

- paramètres : `lat`, `lon` ;
- amont : Géorisques `resultats_rapport_risque?latlon=lon,lat` ;
- réponse : `{ url, risques: [{ code, famille: 'naturel'|'technologique', libelle, adresse: Niveau, commune: Niveau }] }`, où `Niveau` vaut `fort`, `moyen`, `faible`, `inconnu` ou `absent`. Seuls les risques `present` sont gardés ;
- `niveauDepuisStatut(libelle)` est une fonction pure : « important » → fort ; « modéré » / « Existant » / « Concerne » → moyen ; « faible » → faible ; « Inconnu » / « non Connu » → inconnu ; « non Concerne » / null → absent ;
- TTL 30 jours.

## US-3 — worker : communes voisines dans `/marche/adresse`

- `apps/worker/src/adresse/voisines.ts` :
  - `pointsAutour(point, 300)` : le bien et huit points (N, NE, E…) ;
  - `communesAutour(deps, point, codeInsee)` interroge API Géo (`type=arrondissement-municipal` quand le code est un arrondissement de Paris, Lyon ou Marseille), met chaque point en cache 30 jours et rend les codes distincts du code du bien, quatre au plus ;
  - panne : liste vide, journalisée.
- `route.ts` lit le CSV de chaque commune voisine (même millésime) et l'actualise avec sa propre série. `analyserAdresse` reçoit toutes les ventes ; `ventesCommune` compte celles de la commune du bien. La réponse ajoute `communesVoisines: [{ codeInsee, ventes }]`. Contrat de cache en version 3.

## US-4 — web : DPE, risques et loyer dans l'onglet Estimation

- Client : `dpe(lat, lon)`, `risques(lat, lon)` ; contrats Zod `ReponseDpeSchema`, `ReponseRisquesSchema`.
- `apps/web/src/enrichissement/dpe.ts` : `dpeProposes(liste, bien, cleBan)` classe les DPE et marque le meilleur ; `appliquerDpe(projet, dpe)` écrit `bien.dpe` et `bien.ges`, provenance `ademe`.
- `apps/web/src/enrichissement/risques.ts` : `risquesDuProjet(reponse)` convertit les risques présents à l'adresse en `marche.risques` (`{ type: code, niveau }`) ; `memesRisques(a, b)`.
- `apps/web/src/enrichissement/loyer.ts` : `loyerPourBien(loyerM2, surface, primeMeuble)` rend `{ referenceM2, nuMensuel, meubleMensuel, basMensuel, hautMensuel }`.
- Écran : `ecrans/adresse/Dpe.tsx`, `ecrans/adresse/Risques.tsx`, `ecrans/adresse/Loyer.tsx`.
  - Les appels partent en parallèle de l'analyse.
  - Les risques et le loyer de référence s'appliquent d'eux-mêmes quand ils diffèrent du projet (données publiques, provenance affichée).
  - Le DPE et le loyer visé s'appliquent sur clic.
- `AdresseBienSchema` gagne `codePostal` (optionnel, pour `/marche`).
- Textes : `textes/risques.ts` (libellés des niveaux, phrases), `textes/vigilance.ts` affiche le libellé du risque au lieu de son code.

## US-5 — web : « Estimer le loyer » au formulaire Vérifier

- Bouton à côté du loyer visé, actif quand code postal, ville et surface sont remplis.
- Géocodage de la ville, puis `/marche` (type, pièces), puis `loyerPourBien` selon le mode de location.
- Le champ se remplit avec la provenance « estime » et une phrase donne la fourchette ; échec : une phrase, le champ reste libre.

## Tests

- worker : paramètres et normalisation des deux services (réponses réelles abrégées), niveaux, points autour, communes voisines (arrondissements, pannes, cache), route avec une commune voisine.
- web : classement des DPE, conversion des risques, loyer, cartes de l'onglet (application sur clic et automatique), bouton du formulaire.
