# Feature Discovery + Specs : Analyse DVF à l'adresse

## Demande

Pierre, 13/09/2026 : « une analyse DVF détaillée qui va jusqu'à l'adresse du bien si l'adresse est renseignée, par exemple dans une deuxième étape par l'utilisateur, pour avoir quelque chose de très précis et comprendre par exemple, en fonction du cadastre, les parcelles qui sont à côté versus celles qui sont de l'autre côté de la rue ; un moteur sans LLM, ou avec un LLM peu coûteux ; une fois que la personne connaît l'adresse exacte (agence, diagnostics…). »

## Analyse

- **Sans LLM.** Tout est géométrie et arithmétique : égalité de parcelle, contact entre contours cadastraux, parité des numéros, distances. Un modèle n'apporterait rien, coûterait et ne serait pas vérifiable.
- **Données vérifiées le 13/09/2026 :**
  - le CSV des ventes publié sur R2 ne gardait que date, prix, surface, type, pièces et coordonnées ; la source DVF géolocalisée (Etalab) contient `id_parcelle`, `adresse_numero`, `adresse_suffixe`, `adresse_nom_voie`, `adresse_code_voie`, les surfaces Carrez des lots ;
  - l'identifiant de parcelle DVF (`132058200E0318`) a le même format que l'`idu` du cadastre IGN (`132018050D0129`) : « même immeuble » = égalité stricte ;
  - le code de voie DVF (`6659`, rue de l'Olivier ; `4613`, rue d'Isoard) est celui de la clé BAN renvoyée par le géocodage (`13205_6659_00144`) : « même rue » = égalité stricte ;
  - l'API Carto cadastre de l'IGN renvoie la parcelle sous un point ; interrogée avec le contour de la parcelle, elle ne renvoie que la parcelle elle-même ; interrogée avec une boîte élargie d'une dizaine de mètres, elle renvoie les candidates (8 parcelles, 5 Ko) : la mitoyenneté se décide ensuite par un calcul de distance entre contours.
- **Côté de la rue** : numérotation française, pairs d'un côté, impairs de l'autre.

## Stories

| Story | Titre                          | Gherkin (résumé)                                                                                                                                                                                                                                                                                                                                                        |
| ----- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-1  | Données : ventes adressées     | `dvf/<millésime>/<codeInsee>.csv` gagne `idParcelle, numero, suffixe, codeVoie, voie, carrez` (colonnes ajoutées en fin de ligne, anciens lecteurs intacts) ; noms de voie nettoyés pour un CSV sans échappement                                                                                                                                                        |
| US-2  | Moteur d'analyse (Worker, pur) | ventes classées en même immeuble, parcelles voisines, même côté, en face, cercles 100/200/300 m ; comparables = même type, surface à ±40 % ; statistiques par groupe (médiane, quartiles, min, max) ; repère = premier groupe à ≥ 5 comparables dans l'ordre immeuble → voisines → même côté → 100 m → en face → 200 m → 300 m ; 20 ventes comparables les plus proches |
| US-3  | Cadastre et route              | `voisinageDe` : parcelle au point, candidates dans une boîte élargie, voisines = contour à moins de 3 m ; `GET /marche/adresse` : validation, cache 24 h, cadastre en cache 30 jours, commune non publiée ou cadastre en panne → analyse partielle jamais mise en cache                                                                                                 |
| US-4  | Onglet « Adresse »             | saisie de l'adresse, géocodage exigeant le numéro, adresse mémorisée dans le projet, groupes et ventes proches, écart du bien au repère, « Utiliser ce repère pour le verdict » écrit `marche.dvf` (avec `rayonMetres`) et sa provenance ; l'adresse mémorisée est réanalysée à l'ouverture                                                                             |
| US-5  | Publication et documentation   | republication DVF des Bouches-du-Rhône au nouveau format, déploiement du Worker, docs                                                                                                                                                                                                                                                                                   |

## Périmètre

- **IN** : ce qui précède.
- **OUT** : carte ; ventes d'une commune limitrophe situées à moins de 300 m (seul le CSV de la commune du bien est lu) ; actualisation des prix dans le temps (fenêtre de 24 mois brute) ; type de bien et nombre de lots de la copropriété ; recalage automatique du repère sans clic.

## Auto-validation critique

- La règle de parité a des exceptions (numérotation métrique en zone rurale, places, numérotation continue) : « même côté » et « en face » restent indicatifs, et c'est pour cela que les cercles sont toujours affichés à côté.
- Les coordonnées DVF sont le centre de la parcelle, pas le bâtiment : un grand ensemble peut être à 0 m de lui-même et à 60 m de son entrée. Le groupe « même immeuble » (parcelle) est plus fiable que la distance.
- Une vente dans un immeuble en copropriété sur plusieurs parcelles peut échapper au groupe « même immeuble » ; elle reste dans les parcelles voisines ou les cercles.
- L'API Carto n'annonce pas de quota public : le voisinage d'un point est gardé 30 jours en cache, et une panne n'empêche pas l'analyse (groupes immeuble et voisines vides, signalé à l'écran).
- Le repère ne remplace la médiane de la commune que sur un clic explicite de l'utilisateur, qui voit le nombre de ventes et la fourchette avant.
