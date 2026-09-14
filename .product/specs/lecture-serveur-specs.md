# Specs : Lecture d'une annonce par Deklic, sans extension (`lecture-serveur`)

Source : `.product/features/lecture-serveur-discovery.md` (14/09/2026).

## Epics

| Epic                                    | Contenu                                                                                                                                 | Stories          |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| **E1 — Tout ce que l'annonce dit**      | Capture enrichie (photos, chauffage, état, extérieurs, équipements, honoraires, énergie, quartier, vendeur) et règles des cinq portails | US-1, US-2       |
| **E2 — Coller le lien suffit, partout** | Route `POST /lecture` du Worker, lecture par le Worker dans le navigateur, bascule extension ↔ serveur, écran d'attente                 | US-3, US-4, US-5 |
| **E3 — Le projet garde l'annonce**      | Données lues vers les hypothèses existantes, photos et fiche du bien enregistrées et affichées                                          | US-6, US-7       |

---

## E1 — Tout ce que l'annonce dit

### US-1 : Une capture qui porte toutes les données utiles de l'annonce

En tant que Camille,
je veux que Deklic retienne tout ce que l'annonce indique (photos, chauffage, état, extérieurs, équipements, honoraires, énergie),
afin de ne rien ressaisir et de retrouver mon bien d'un coup d'œil.

Priorité : P0 · Effort : M

**Nouveaux champs optionnels de `ChampsCaptureSchema`** (version de capture inchangée : champs ajoutés, aucun sens modifié) :

| Champ                                                                                                                                           | Type       | Contrainte                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------- |
| `photos`                                                                                                                                        | `string[]` | URL `https:` uniquement, dédoublonnées, 30 au plus, 500 caractères chacune             |
| `chauffageCollectif`                                                                                                                            | booléen    | collectif = `true`, individuel = `false`                                               |
| `chauffageEnergie`                                                                                                                              | enum       | `electricite`, `gaz`, `fioul`, `bois`, `pompe_a_chaleur`, `reseau_de_chaleur`, `autre` |
| `etat`                                                                                                                                          | enum       | `a_renover`, `a_rafraichir`, `bon_etat`, `renove` (mêmes valeurs que le moteur)        |
| `etagesImmeuble`                                                                                                                                | entier     | 0 à 100                                                                                |
| `balcon`, `terrasse`, `jardin`, `cave`, `parking`, `gardien`, `digicode`, `interphone`, `piscine`, `climatisation`, `cheminee`, `accessiblePmr` | booléen    |                                                                                        |
| `sallesEau`                                                                                                                                     | entier     | 0 à 20 (salles de bain et salles d'eau)                                                |
| `honoraires`                                                                                                                                    | montant    | euros TTC, positif                                                                     |
| `honorairesACharge`                                                                                                                             | enum       | `acquereur`, `vendeur`                                                                 |
| `budgetEnergieMin`, `budgetEnergieMax`                                                                                                          | montant    | euros par an                                                                           |
| `consommationEnergie`                                                                                                                           | entier     | kWh/m²/an, 0 à 2 000                                                                   |
| `dateDpe`                                                                                                                                       | date       | `AAAA-MM-JJ`                                                                           |
| `quartier`                                                                                                                                      | texte      | 80 caractères                                                                          |
| `vendeur`                                                                                                                                       | enum       | `pro`, `particulier`                                                                   |
| `publieeLe`                                                                                                                                     | date       | `AAAA-MM-JJ`                                                                           |

**Moteur de règles** :

- chemin `[*]` qui projette un tableau (`photos[*].url`) ;
- tableau de valeurs simples lu comme un texte joint par des virgules, pour qu'une regex y cherche une valeur (`specificities.values` → « cellar, intercom ») ;
- nouveaux types de valeur `urls` (liste d'URL https) et `date` ;
- mode de capture `serveur`.

```gherkin
Scenario: Photos d'une annonce LeBonCoin
  Given une page dont __NEXT_DATA__ porte ad.images.urls_large avec 10 adresses
  When les règles LeBonCoin s'appliquent
  Then la capture porte 10 photos, dans l'ordre de la page

Scenario: Adresse d'image refusée
  Given une liste contenant "javascript:alert(1)", "http://exemple.fr/a.jpg" et deux fois la même adresse https
  When le type urls convertit la liste
  Then seule l'adresse https reste, une seule fois

Scenario: Plus de 30 photos
  Given 45 adresses https
  When le type urls convertit la liste
  Then les 30 premières sont gardées

Scenario: Caractéristique dans un tableau
  Given l'attribut specificities de valeurs ["cellar", "intercom"]
  When l'extracteur de cave cherche "cellar" avec la valeur constante true
  Then cave vaut true et interphone vaut true

Scenario: Date lue en français ou en ISO
  Given "2026-08-28 20:32:49" ou "2026-06-29T08:59:00Z"
  When le type date convertit
  Then la valeur est "2026-08-28" ou "2026-06-29" ; "hier" ne donne rien

Scenario: Ancienne capture sans nouveaux champs
  Given un fragment #capture=… produit par l'extension 0.2.0
  When le web le décode
  Then il est accepté tel quel
```

### US-2 : Les règles des cinq portails lisent tout ce qu'elles peuvent

En tant que Camille,
je veux que chaque portail donne le plus de données possible, par l'extension comme par la lecture serveur,
afin d'avoir la même fiche quel que soit le chemin.

Priorité : P0 · Effort : L · Dépend de : US-1

Règles `<portail>-2026-09-14` d'après l'inventaire de la discovery (LeBonCoin : attributs `heating_type`, `heating_mode`, `global_condition`, `outside_access`, `specificities`, `nb_floors_building`, `nb_shower_room`, `fees_at_the_expanse_of`, `annual_energy_budget_*`, `owner.type`, `location.district`, `first_publication_date` ; SeLoger et Logic-Immo : `sections.gallery.images`, `energy.features`, `features.details`, `price.breakdown`, `isPrivateOwner` ; Bien'ici : `photos`, `heating`, `has*`, `*Quantity`, `energyValue`, `energyPerformanceDiagnosticDate`, `district.libelle`, `adCreatedByPro` ; PAP : JSON-LD `image`, `additionalProperty[Ascenseur]`, `[Balcon / Terrasse]`, vendeur particulier).

```gherkin
Scenario: Fiche complète LeBonCoin
  Given la page LeBonCoin enregistrée (valeurs anonymisées) d'un T4 de 67 m²
  When les règles s'appliquent
  Then chauffageCollectif = true, chauffageEnergie = electricite, etat = bon_etat, etagesImmeuble = 7,
       balcon = true, cave = true, interphone = true, sallesEau = 1, honorairesACharge = vendeur,
       budgetEnergieMin = 941, budgetEnergieMax = 1273, vendeur = pro, quartier = "Saint-Roch", 10 photos

Scenario: Logic-Immo / SeLoger
  Given la page Logic-Immo enregistrée
  When les règles s'appliquent
  Then chauffageEnergie = gaz, etat = renove, jardin = true, balcon = false, digicode = true,
       meuble = true, honoraires = 6000, honorairesACharge = acquereur, vendeur = pro, 10 photos

Scenario: Une donnée absente reste absente
  Given une annonce sans chauffage indiqué
  When les règles s'appliquent
  Then chauffageEnergie est absent, jamais "autre" par défaut

Scenario: Champs déjà lus inchangés
  Given les pages enregistrées des tests existants
  When les nouvelles règles s'appliquent
  Then tous les champs d'avant gardent leur valeur (non-régression)
```

---

## E2 — Coller le lien suffit, partout

### US-3 : Le Worker récupère la page d'une annonce à la demande

En tant que Camille sans extension,
je veux que Deklic aille chercher l'annonce pour moi,
afin de ne pas copier-coller son texte.

Priorité : P0 · Effort : L

**Contrat**

```yaml
POST /lecture
  Request (JSON, 2 Ko au plus):
    url: string (required) — lien d'une annonce reconnu par resoudreAnnonce (5 portails)
  Response 200 (Cache-Control: no-store):
    portail: leboncoin | seloger | logicimmo | pap | bienici
    url: string — URL canonique
    page:
      type: "html"      → html: string (3 Mo au plus)    # LeBonCoin, SeLoger, Logic-Immo, PAP
      type: "donnees"   → donnees: object               # Bien'ici, /realEstateAd.json
    tentatives: 1 | 2
    obtenuLe: ISO 8601
  Response 400 PARAMETRES_INVALIDES   { details.champs: ["url"] } — corps illisible ou lien non reconnu
  Response 404 ANNONCE_INTROUVABLE    — le portail répond 404 ou 410
  Response 429 TROP_DE_REQUETES       — 5 lectures par minute et par IP
  Response 502 AMONT_INDISPONIBLE     — fournisseur en erreur ou délai dépassé
  Response 502 AMONT_VIDE             — page vide ou sans données d'annonce après 2 tentatives
  Response 502 AMONT_INVALIDE         — page de plus de 3 Mo, JSON Bien'ici illisible
  Response 503 LECTURE_INDISPONIBLE   — pas de clé Bright Data (sauf Bien'ici, lu sans clé)
```

- Secrets `BRIGHTDATA_API_KEY` ; variable `BRIGHTDATA_ZONE` (défaut `deklic_unlocker`).
- Rien n'est mis en cache ni journalisé du contenu : le journal note portail, statut, durée, tentatives, taille.
- Seules les URL reconnues comme annonces des cinq portails sont transmises ; l'URL envoyée au fournisseur est l'URL canonique reconstruite, jamais la chaîne reçue.

```gherkin
Scenario: Annonce LeBonCoin lue par Bright Data
  Given une clé Bright Data et un fournisseur qui rend une page avec __NEXT_DATA__
  When POST /lecture { url: "https://www.leboncoin.fr/ad/ventes_immobilieres/3194683132?utm=x" }
  Then 200, portail leboncoin, url sans paramètre, page.type html, tentatives 1
  And le fournisseur a reçu l'URL canonique, la zone et le pays fr

Scenario: Page vide puis pleine (SeLoger)
  Given un fournisseur qui rend 0 octet puis la page
  When POST /lecture d'une annonce SeLoger
  Then 200 avec tentatives 2

Scenario: Page vide deux fois
  Given un fournisseur qui rend deux fois une page sans marqueur de données
  When POST /lecture
  Then 502 AMONT_VIDE

Scenario: Bien'ici sans Bright Data
  Given aucune clé Bright Data
  When POST /lecture d'une annonce Bien'ici
  Then le Worker appelle https://www.bienici.com/realEstateAd.json?id=<id> et rend page.type donnees

Scenario: Lien qui n'est pas une annonce
  When POST /lecture { url: "https://evil.example/ad/1" } ou { url: "https://www.leboncoin.fr/recherche?x" }
  Then 400 PARAMETRES_INVALIDES et aucun appel sortant

Scenario: Sans clé
  Given aucune clé Bright Data
  When POST /lecture d'une annonce PAP
  Then 503 LECTURE_INDISPONIBLE

Scenario: Annonce retirée
  Given le fournisseur signale le statut 404 du portail
  Then 404 ANNONCE_INTROUVABLE, sans nouvelle tentative

Scenario: Trop de lectures
  Given 5 lectures dans la minute depuis la même IP
  When une 6e arrive
  Then 429 TROP_DE_REQUETES
```

### US-4 : Coller le lien lance la lecture par Deklic quand l'extension n'est pas là

En tant que Camille sur mon téléphone,
je veux coller le lien et voir le formulaire se remplir,
afin de créer mon projet en deux gestes.

Priorité : P0 · Effort : M · Dépend de : US-1, US-3

- `ClientWorker.lirePage(url, signal)` valide la réponse par Zod ; échecs en codes.
- `lireParServeur` : `DOMParser` sur le HTML (ou document vide + données Bien'ici), mêmes règles que le favori, mode `serveur`, puis `completerAvecIa` comme aujourd'hui ; le HTML et le texte ne sont gardés qu'en mémoire.
- Bascule : extension absente → lecture serveur automatique après la pause de collage ; extension en échec (`chargement`, `vide`) → lecture serveur automatique ; autre échec → bouton « Lire sans l'extension ».
- Échec serveur : une phrase par cas, « Réessayer », texte collé toujours disponible.

```gherkin
Scenario: Sans extension, lien PAP
  Given l'extension absente et le Worker qui rend la page PAP
  When je colle le lien
  Then l'écran d'attente s'affiche, puis le formulaire Vérifier avec prix, surface, DPE
  And le badge indique « lue par Deklic »

Scenario: Extension présente
  Given l'extension répond au ping
  When je colle un lien
  Then c'est l'extension qui lit, aucune requête /lecture

Scenario: Extension en échec de chargement
  Given l'extension répond { ok: false, raison: chargement }
  When je colle un lien
  Then la lecture par Deklic démarre d'elle-même

Scenario: Lecture serveur indisponible
  Given le Worker répond 503 LECTURE_INDISPONIBLE ou le réseau est coupé
  Then l'écran propose de coller le texte (et d'installer l'extension sur ordinateur), sans écran d'attente bloqué

Scenario: Réponse forgée
  Given une réponse 200 dont page.type est inconnu
  Then le résultat est REPONSE_INVALIDE et rien n'est prérempli
```

### US-5 : Un écran d'attente qui fait patienter

En tant que Camille,
je veux voir que la lecture avance et savoir combien de temps attendre,
afin de ne pas croire que l'application est figée.

Priorité : P0 · Effort : M · Dépend de : US-4

- Étapes successives : contacter le portail → passer sa vérification → lire prix, surface, DPE → rassembler photos et détails ; au-delà de 1,5 × la durée habituelle : « C'est plus long que d'habitude, on insiste ».
- Barre de progression **estimée** d'après la durée habituelle du portail (Bien'ici 3 s, Logic-Immo 10 s, PAP 15 s, LeBonCoin 20 s, SeLoger 45 s), qui ralentit et ne dépasse jamais 95 % avant la fin.
- Temps écoulé ; une astuce sur Deklic toutes les 7 s ; bouton « Annuler et coller le texte » qui interrompt la requête.
- Accessibilité : `role="progressbar"` avec valeur, annonce des changements d'étape seulement (`aria-live="polite"`), animations coupées si `prefers-reduced-motion`.

```gherkin
Scenario: Progression d'une lecture SeLoger
  Given une lecture SeLoger commencée depuis 45 s
  When l'écran se met à jour
  Then la progression est entre 60 et 90 %, l'étape est « On rassemble les photos et les détails »

Scenario: Lecture très longue
  Given une lecture LeBonCoin depuis 40 s
  Then le message « C'est plus long que d'habitude, on insiste » apparaît et la barre reste sous 95 %

Scenario: Annulation
  Given une lecture en cours
  When je clique sur « Annuler et coller le texte »
  Then la requête est interrompue, la zone de texte est proposée, aucun résultat tardif ne remplit le formulaire

Scenario: Mouvement réduit
  Given prefers-reduced-motion
  Then aucune animation, la barre et les textes restent mis à jour
```

---

## E3 — Le projet garde l'annonce

### US-6 : Les données lues remplissent les hypothèses et restent avec le projet

En tant que Camille,
je veux que l'état, l'extérieur, les honoraires et le meublé lus soient repris, et que la fiche soit gardée,
afin que le calcul parte de l'annonce et que je retrouve ses détails plus tard.

Priorité : P0 · Effort : M · Dépend de : US-1

- `champsStructures` : `etat` ; `exterieur` = balcon, terrasse ou jardin (vrai si l'un est vrai, faux si tous sont indiqués faux) ; `honorairesAgence` = `honoraires` seulement si `honorairesACharge = acquereur`.
- `ProjetEnregistre.annonce` (optionnel) : `photos` (30 au plus), `fiche` (champs descriptifs de US-1 hors photos), `lueLe`. Validé par Zod, voyage dans le lien de partage, absent des projets existants.
- Jamais enregistrés : description, HTML, données du vendeur.

```gherkin
Scenario: Honoraires à la charge de l'acquéreur
  Given une capture honoraires 6000, honorairesACharge acquereur
  Then le formulaire propose 6 000 € d'honoraires, provenance annonce

Scenario: Honoraires à la charge du vendeur
  Given honorairesACharge vendeur
  Then les honoraires ne sont pas préremplis

Scenario: Projet créé depuis une lecture
  Given une capture avec 10 photos et une fiche
  When je crée le projet
  Then le projet enregistré porte annonce.photos (10), annonce.fiche, annonce.lueLe

Scenario: Projet ancien ou lien de partage ancien
  Given un projet sans champ annonce
  Then il se charge sans erreur
```

### US-7 : La fiche du bien et ses photos dans le projet

En tant que Camille,
je veux voir les photos et les caractéristiques de l'annonce en tête du rapport,
afin de reconnaître le bien et de préparer la visite.

Priorité : P1 · Effort : M · Dépend de : US-6

- Carte « Le bien » en tête du Rapport : photos en bandeau défilant (défilement horizontal, chargement différé, `referrerPolicy="no-referrer"`, image cassée masquée), puis pastilles de caractéristiques (chauffage, étage/étages, extérieurs, cave, parking, équipements, énergie, vendeur, quartier, date de publication), lien « Voir l'annonce ».
- Rien si le projet n'a pas de fiche ; photos absentes à l'impression.

```gherkin
Scenario: Projet avec photos
  Given un projet dont annonce porte 3 photos et chauffage collectif gaz
  When j'ouvre le Rapport
  Then je vois 3 images et la pastille « Chauffage collectif · gaz »

Scenario: Image qui ne se charge plus
  Given une photo dont l'adresse ne répond plus
  Then elle disparaît du bandeau sans casser la carte

Scenario: Projet sans fiche
  Given un projet créé à la main
  Then aucune carte « Le bien » ne s'affiche
```

---

## Modèle de données

```
ChampsCapture (+ champs de US-1, tous optionnels)
Capture.mode : extension | bookmarklet | serveur

ProjetEnregistre
  annonce?: {
    photos: string[] (https, ≤ 30)
    fiche: FicheAnnonce (chauffageCollectif, chauffageEnergie, etat, etagesImmeuble, balcon, terrasse, jardin,
                          cave, parking, gardien, digicode, interphone, piscine, climatisation, cheminee,
                          accessiblePmr, sallesEau, honoraires, honorairesACharge, budgetEnergieMin,
                          budgetEnergieMax, consommationEnergie, dateDpe, quartier, vendeur, publieeLe)
    lueLe: ISO 8601
  }
```

## Priorisation MoSCoW

| Story                                  | Priorité | Effort | Dépendances |
| -------------------------------------- | -------- | ------ | ----------- |
| US-1 Capture enrichie                  | Must     | M      | —           |
| US-2 Règles des cinq portails          | Must     | L      | US-1        |
| US-3 Route `POST /lecture`             | Must     | L      | —           |
| US-4 Lecture par Deklic dans le web    | Must     | M      | US-1, US-3  |
| US-5 Écran d'attente                   | Must     | M      | US-4        |
| US-6 Données vers hypothèses et projet | Must     | M      | US-1        |
| US-7 Fiche du bien et photos           | Should   | M      | US-6        |

Effort total estimé : XL (3 à 4 jours).
