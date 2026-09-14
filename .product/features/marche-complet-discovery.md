# Discovery — marche-complet

Date : 2026-09-14. Demande de Pierre : « Marché complet », la prochaine étape annoncée après `estimation-prix`.

## Ce que l'utilisateur obtient

Dans l'onglet « Estimation », une fois l'adresse analysée, et au formulaire Vérifier :

- **Le DPE de son logement, retrouvé** : la base ADEME liste les diagnostics enregistrés à l'adresse (étiquette énergie et climat, date, surface, étage, complément « 1er étage »…). Deklic met en avant celui qui ressemble le plus au bien. Un clic l'applique au projet, et l'estimation se recalcule.
- **Les risques de l'adresse** : le rapport Géorisques officiel (inondation, argiles, séisme, radon, pollution des sols, installations classées…), avec le niveau à l'adresse et dans la commune, et le lien vers le rapport. Les risques présents à l'adresse alimentent le feu « risques » du verdict.
- **Le loyer de marché** : le loyer d'annonce ANIL de la commune, ramené hors charges et à la surface du bien, en location nue et en meublé. Il devient le loyer de référence du projet ; un clic en fait le loyer visé.
- **Des ventes au-delà de la limite de commune** : un bien près d'une limite d'arrondissement ou de commune voit aussi les ventes de la commune voisine dans les cercles de 100 à 300 m.
- **Un loyer proposé dès la création** : « Estimer le loyer » dans le formulaire Vérifier, à partir du code postal, de la ville et de la surface.
- **L'actualisation d'un projet existant** : relancer l'analyse de l'adresse rafraîchit ventes, tendance, DPE, risques et loyer.

## Sources vérifiées le 14/09/2026

| Donnée                      | Accès                                                                                                    | Constat                                                                                                                                                                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DPE des logements existants | `https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines?geo_distance=lon,lat,30`            | 34 DPE autour du 144 rue de l'Olivier ; champs `etiquette_dpe`, `etiquette_ges`, `identifiant_ban`, `surface_habitable_logement`, `numero_etage_appartement`, `complement_adresse_logement`, `date_etablissement_dpe`, `date_fin_validite_dpe`, `type_batiment` |
| Risques                     | `https://georisques.gouv.fr/api/v1/resultats_rapport_risque?latlon=lon,lat`                              | 12 risques naturels, 6 technologiques ; statut à l'adresse et dans la commune : « Risque Existant - faible / modéré / important », « Risque Existant », « Risque Inconnu », « Risque non Connu », « Risque Concerne », « Risque non Concerne »                  |
| Communes autour d'un point  | `https://geo.api.gouv.fr/communes?lat&lon` (et `type=arrondissement-municipal` à Paris, Lyon, Marseille) | La commune ou l'arrondissement qui contient chaque point                                                                                                                                                                                                        |
| Loyers                      | `loyers/<millésime>/<dep>.json` sur R2 (ANIL), déjà lu par `/marche`                                     | Loyer d'annonce charges comprises, fourchette basse et haute                                                                                                                                                                                                    |

## Règles

- **Niveau d'un risque** : « important » = fort, « modéré » ou « Existant » sans niveau ou « Concerne » = moyen, « faible » = faible. Seuls les risques présents **à l'adresse** vont au verdict ; ceux de la commune sont affichés à part.
- **DPE proposé** : même clé BAN quand on la connaît, puis surface la plus proche (à 15 % près), puis même étage quand on le connaît, puis le plus récent ; les DPE expirés sont signalés. Jamais appliqué sans clic : plusieurs logements partagent une adresse.
- **Loyer** : ANIL charges comprises − 8 % (déjà la règle de Deklic) × surface ; meublé = + prime meublé des règles (15 %).
- **Communes voisines** : neuf points (le bien et huit points à 300 m) ; au plus quatre communes voisines lues.

## Hors périmètre

- Aucun modèle de langage.
- Pas de récupération des DPE « neufs » (`dpe02neuf`) ni des anciens DPE d'avant juillet 2021.
- Pas de synchronisation des projets entre appareils.

## Risques et coûts

- Trois services publics gratuits de plus, appelés depuis le Worker, en cache (DPE 7 jours, risques 30 jours, communes 30 jours) et soumis à la limite de débit générale.
- Géorisques et l'ADEME peuvent être lents ou indisponibles : chaque carte l'annonce, le reste de l'analyse s'affiche.
