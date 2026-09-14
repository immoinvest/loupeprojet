# Feature Discovery : Lecture d'une annonce par Deklic, sans extension (`lecture-serveur`)

## Demande d'origine

Pierre, 14/09/2026 :

1. « Explorer le scrapping côté serveurs » puis, après le test Bright Data concluant : « implémente cela comme alternative avec un loader qui arrive à faire patienter la personne ».
2. « Regarder toutes les données qu'il est possible d'extraire, par exemple le mode de chauffage, année de construction, étage, pas d'ascenseur, autant d'éléments que possible, ainsi que les photos, pour qu'on puisse les exploiter dans l'application directement. »

## Analyse

### Quoi

Aujourd'hui, coller le lien d'une annonce ne suffit que si l'extension Deklic est installée (ordinateur uniquement). Sans elle — téléphone, tablette, navigateur sans extension, extension en échec — il faut copier-coller le texte de l'annonce.

La feature ajoute un **second chemin de lecture** : le Worker de Deklic récupère la page de l'annonce (Bright Data Web Unlocker pour LeBonCoin, SeLoger, Logic-Immo, PAP ; requête directe pour Bien'ici), le navigateur applique **les mêmes règles** que l'extension, et le formulaire Vérifier se remplit. Pendant l'attente (5 à 75 s selon le portail), un écran d'attente guidé occupe la personne.

Elle élargit aussi **ce qui est lu** : photos, chauffage (collectif/individuel, énergie), état, extérieurs (balcon, terrasse, jardin), cave, parking, étages de l'immeuble, salles d'eau, honoraires et à qui ils incombent, budget énergie, consommation, quartier, vendeur pro ou particulier, etc. Ces données servent dans l'application : photos et fiche du bien dans le projet, et alimentation des hypothèses qui existent déjà (état, extérieur, honoraires).

### Pourquoi

- **Deux clics** (exigence n° 1 de Pierre) : coller le lien doit suffire partout, y compris sur téléphone où l'extension n'existe pas (ADR-007 : « la lecture automatique reste réservée à l'ordinateur »).
- **Moins de saisie** : chaque donnée lue est une case de moins à remplir ou à estimer ; les photos rendent le projet reconnaissable.

### Pour qui

Camille, premier investissement, sur téléphone ou sans extension.

### Où

- `apps/worker` : nouvelle route `POST /lecture`, connecteur Bright Data, lecture directe Bien'ici.
- `packages/capture` : schéma de capture enrichi, types de valeur liste et URL, mode `serveur`.
- `apps/extension/regles/*.json` : règles enrichies (partagées par l'extension, le favori et la lecture serveur).
- `apps/web` : client, lecture par le Worker, écran d'attente, fiche du bien et photos dans le projet.

## Test préalable (14/09/2026, compte gratuit Bright Data de Pierre)

| Portail    | Anti-robot        | Temps mesuré                                        | Règles Deklic sur le HTML reçu |
| ---------- | ----------------- | --------------------------------------------------- | ------------------------------ |
| LeBonCoin  | DataDome passé    | 17-18 s                                             | prix, surface, pièces, DPE ✓   |
| SeLoger    | DataDome passé    | 10-74 s ; **2 réponses vides (200, 0 octet) sur 6** | 12 champs ✓                    |
| Logic-Immo | DataDome passé    | 2,5-9 s                                             | 9 champs ✓                     |
| PAP        | Cloudflare passé  | 5-17 s                                              | 10 champs ✓                    |
| Bien'ici   | aucune protection | < 1 s (requête directe, sans Bright Data)           | données JSON complètes         |

## Inventaire des données exposées par les portails

Relevé sur une vraie annonce par portail, le 14/09/2026. ✓ = donnée structurée ; t = seulement dans le texte ; — = absent.

| Donnée                                | LeBonCoin (`__NEXT_DATA__`)            | SeLoger / Logic-Immo (`__UFRN…`)               | Bien'ici (`realEstateAd.json`)                                                | PAP (JSON-LD)                             | Déjà lue            |
| ------------------------------------- | -------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------- | ------------------- |
| Photos                                | ✓ `images.urls_large` (10)             | ✓ `sections.gallery.images[].url`              | ✓ `photos[].url`                                                              | ✓ `image[]` (12)                          | non                 |
| Chauffage : collectif / individuel    | ✓ `heating_type`                       | ✓ `energy.features[heatingSystem]`             | ✓ `heating` (texte)                                                           | t                                         | non                 |
| Chauffage : énergie                   | ✓ `heating_mode`                       | ✓ `energy.features[energySource]`              | ✓ `heating`                                                                   | t                                         | non                 |
| Année de construction                 | ✓ `building_year`                      | t                                              | ✓ `yearOfConstruction`                                                        | t                                         | oui (LBC, Bien'ici) |
| Étage / étages de l'immeuble          | ✓ `floor_number`, `nb_floors_building` | ✓ `features[floors]` « RDC/1 étages »          | ✓ `floor`, `floorQuantity`                                                    | t                                         | étage seul          |
| Ascenseur                             | ✓ `elevator`                           | ✓ `features[elevator]`                         | ✓ `hasElevator`                                                               | ✓ `additionalProperty[Ascenseur]`         | oui (sauf PAP)      |
| État du bien                          | ✓ `global_condition`                   | ✓ `energy.features[state]` (IA du portail)     | ✓ `workToDo`                                                                  | t                                         | non                 |
| Balcon / terrasse / jardin            | ✓ `outside_access`                     | ✓ `features[balcony]`, `[garden]`, `[terrace]` | ✓ `balconyQuantity`, `hasTerrace`                                             | ✓ `additionalProperty[Balcon / Terrasse]` | non                 |
| Cave                                  | ✓ `specificities` (cellar)             | ✓ `features[cellar]`                           | ✓ `hasCellar`                                                                 | t                                         | non                 |
| Parking                               | ✓ `specificities` / attributs          | ✓ `features[parking]`                          | ✓ `parkingPlacesQuantity`                                                     | t                                         | non                 |
| Salles d'eau / WC                     | ✓ `nb_shower_room`                     | ✓ `features`                                   | ✓ `showerRoomsQuantity`, `toiletQuantity`                                     | t                                         | non                 |
| Gardien, digicode, interphone         | ✓ `specificities` (intercom)           | ✓ `features[digital-lock]`                     | ✓ `hasCaretaker`                                                              | t                                         | non                 |
| Piscine, climatisation, cheminée, PMR | ✓ `specificities`                      | ✓ `features`                                   | ✓ `hasPool`, `hasAirConditioning`, `hasFirePlace`, `isDisabledPeopleFriendly` | t                                         | non                 |
| Meublé                                | ✓ `furnished`                          | ✓ `features[furnished]`                        | ✓ `isFurnished`                                                               | t                                         | oui                 |
| Charges de copropriété                | ✓ `annual_charges`                     | t                                              | ✓ `annualCondominiumFees`                                                     | t                                         | oui                 |
| Lots, procédure de copropriété        | t                                      | t                                              | ✓                                                                             | t                                         | oui (Bien'ici)      |
| Honoraires : montant, à la charge de  | ✓ `fees_at_the_expanse_of`             | ✓ `price.breakdown` (montant, %, acquéreur)    | ✓ `agencyFeePercentage`, `feesChargedTo`                                      | — (particulier)                           | non                 |
| Budget énergie annuel min / max       | ✓ `annual_energy_budget_min/max`       | —                                              | ✓ `minEnergyConsumption`, `maxEnergyConsumption`                              | —                                         | non                 |
| Consommation (kWh/m²/an), date du DPE | —                                      | ✓ `certificates`                               | ✓ `energyValue`, `energyPerformanceDiagnosticDate`                            | —                                         | non                 |
| Quartier                              | ✓ `location.district`                  | ✓ `address.district`                           | ✓ `district.libelle`                                                          | —                                         | non                 |
| Coordonnées (approchées)              | ✓ `location.lat/lng`                   | polygone du quartier                           | ✓ `blurInfo.position` (flouté 250 m)                                          | —                                         | non                 |
| Vendeur pro / particulier             | ✓ `owner.type`                         | ✓ `contactCard.isPrivateOwner`                 | ✓ `adCreatedByPro`                                                            | ✓ particulier                             | non                 |
| Date de publication                   | ✓ `first_publication_date`             | ✓ `metadata.creationDate`                      | — (masquée)                                                                   | —                                         | non                 |
| Fibre, transports proches             | —                                      | ✓ `transport.closestLines`                     | ✓ `opticalFiberStatus`                                                        | —                                         | non                 |

**Écartés volontairement** : nom, téléphone et adresse de l'agent ou du vendeur, identifiants internes, suivi publicitaire. Deklic ne collecte pas de données personnelles de tiers.

## Outcomes

1. Sans extension, coller le lien d'une annonce des cinq portails remplit le formulaire Vérifier dans plus de 9 cas sur 10 (mesuré sur les annonces témoins).
2. Aucune personne ne voit un écran figé : l'attente montre ce qui se passe, le temps écoulé, une estimation, et permet d'abandonner pour coller le texte.
3. Un projet créé depuis une annonce montre ses photos et sa fiche du bien ; l'état, l'extérieur et les honoraires lus alimentent le calcul sans saisie.
4. Coût d'exploitation : 0 € tant que le volume reste sous 5 000 lectures par mois (offre gratuite Bright Data, compte sans fonds déposés).

## Outputs

1. **Worker** `POST /lecture { url }` → `{ portail, url, html | donnees, obtenuLe }` ; codes `LECTURE_INDISPONIBLE` (sans clé), `PARAMETRES_INVALIDES`, `AMONT_INDISPONIBLE`, `AMONT_VIDE`, `TROP_DE_REQUETES`.
2. **Capture** : champs enrichis (photos, chauffage, état, extérieurs, équipements, honoraires, énergie, quartier, vendeur…), mode `serveur`, types de valeur liste.
3. **Règles** des cinq portails enrichies (version `<portail>-2026-09-14`).
4. **Web** : `lireParServeur`, écran d'attente guidé, bascule automatique extension absente ou en échec, fiche du bien avec photos dans le projet, champs mappés vers `etat`, `exterieur`, `honorairesAgence`.
5. **ADR-008** : lecture par le serveur en secours, amende l'ADR-002.

## Scope

### IN

- Lecture par le Worker pour les cinq portails, déclenchée automatiquement quand l'extension est absente ; proposée (« Lire sans l'extension ») quand l'extension échoue.
- Nouvelle tentative automatique quand la page reçue est vide ou sans données d'annonce (constaté sur SeLoger).
- Écran d'attente : étapes, temps écoulé, progression estimée par portail, astuces, bouton « Annuler et coller le texte ».
- Enrichissement du schéma de capture et des règles (extension, favori et serveur en profitent).
- Photos (adresses des images, pas les fichiers) et fiche du bien enregistrées avec le projet, affichées dans le projet.
- Mappage des données lues vers les hypothèses existantes : état, extérieur, honoraires, meublé.

### OUT

- Stocker les photos ou le HTML chez Deklic (cache R2/KV) : interdit par le principe 6.
- Nouveaux calculs à partir des nouvelles données (chauffage → budget énergie, cave/parking → estimation) : feature suivante.
- Alertes, recherches, suivi de prix : jamais côté serveur.
- Fonds sur le compte Bright Data, fournisseur de repli : décision de Pierre.
- Relevés de coordonnées exactes du bien.

## Contraintes

- **Principe 6 amendé** : la page est lue par le Worker **à la demande de la personne**, une annonce à la fois, rien n'est conservé (ni HTML, ni texte, ni cache), aucune liste d'annonces n'est constituée. À écrire dans l'ADR-008.
- **Clé Bright Data** : secret du Worker (`BRIGHTDATA_API_KEY`, `BRIGHTDATA_ZONE`), jamais dans le dépôt ni dans le navigateur. Sans clé : `503 LECTURE_INDISPONIBLE`, l'application retombe sur le texte collé.
- **Quotas** : KV gratuit = 1 000 écritures par jour → pas de compteur global en KV ; limite par IP par le binding Rate Limiting (3 lectures par minute) ; le compte sans fonds plafonne naturellement à 5 000 lectures gratuites par mois.
- **Durée** : jusqu'à ~75 s par tentative sur SeLoger ; délai côté navigateur 150 s ; les Workers n'ont pas de limite de durée tant que le client attend (seul le temps CPU compte).
- **Taille** : HTML de 70 Ko à 1,6 Mo, compressé à la volée par Cloudflare.
- **Workers sans DOM** : les règles s'appliquent dans le navigateur (`DOMParser`), pas dans le Worker.
- TypeScript strict, Zod à chaque frontière, couverture 100 % des modules de logique.

## Risques

| Risque                                                                                                                          | Gravité | Parade                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Juridique** : lecture côté serveur, contraire à l'ADR-002 ; affaire Jinka (Versailles, 14/04/2026, 200 000 € + 500 €/annonce) | élevée  | ADR-008 : à la demande, unitaire, rien stocké, pas de réutilisation ; avis d'un avocat recommandé avant d'ouvrir largement ; extension toujours proposée en premier |
| Photos affichées depuis les serveurs des portails (droit d'auteur des photographes, liens qui expirent)                         | moyenne | Adresses seulement, jamais de copie ; affichage réservé à la personne ; image manquante gérée                                                                       |
| Bright Data change de prix, bloque un portail ou répond vide                                                                    | moyenne | Tentative supplémentaire, code `AMONT_VIDE`, repli texte collé ; fournisseur derrière une interface `Lecteur`                                                       |
| Attente trop longue (SeLoger 74 s)                                                                                              | moyenne | Écran d'attente, abandon possible, extension proposée sur ordinateur                                                                                                |
| Les portails changent leur structure                                                                                            | moyenne | Règles versionnées, extracteurs de secours, tests sur pages enregistrées                                                                                            |
| Abus du point d'entrée (lecture de n'importe quelle page)                                                                       | élevée  | Seules les URL d'annonce des cinq portails reconnues par `resoudreAnnonce` ; limite par IP ; CORS limité aux origines Deklic                                        |

## Definition of Done

- [ ] `POST /lecture` : liste blanche d'URL, Bright Data avec nouvelle tentative, Bien'ici direct, erreurs en codes, rien stocké ni journalisé du contenu, couverture 100 %
- [ ] Capture enrichie et règles des cinq portails, testées sur pages enregistrées réelles (valeurs anonymisées)
- [ ] Sans extension, coller un lien lance la lecture serveur avec l'écran d'attente ; annulation possible ; échec → texte collé
- [ ] Photos et fiche du bien visibles dans le projet ; état, extérieur, honoraires préremplis avec la provenance « annonce »
- [ ] ADR-008 écrit ; README, CLAUDE.md, `.product/` à jour
- [ ] lint, typecheck, tests, build verts ; audit de sécurité ≥ 80
- [ ] Test en réel sur une annonce par portail avec le Worker déployé (après pose des secrets)
