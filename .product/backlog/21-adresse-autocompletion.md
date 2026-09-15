# 21 — Estimation : l'adresse du bien avec suggestions

Statut : `livrée` (15/09/2026, feature `adresse-suggestions` : [discovery](../features/adresse-suggestions-discovery.md), [specs](../specs/adresse-suggestions-specs.md), [architecture](../architecture/adresse-suggestions.md)) · Notée le 14/09/2026 · Dépend de : rien ; à coordonner avec 13 (champ « Commune » du formulaire, même composant) et 14 (adresse en tête de l'onglet) · Taille : une session

## La demande de Pierre

> Dans Estimation, je veux que le choix de l'adresse se fasse de manière plus intelligente, avec une autocomplétion : aujourd'hui c'est dur à remplir.

## Ce qui existe aujourd'hui

- `apps/web/src/ecrans/Adresse.tsx` : un `<input>` libre « Adresse du bien » (exemple « 144 rue de l'Olivier 13005 Marseille ») et un bouton « Analyser ».
- Au clic : `client.geocoder(texte)` → Worker `GET /proxy/geocodage` (`apps/worker/src/services/geocodage.ts`, Géoplateforme IGN `https://data.geopf.fr/geocodage/search`, `q` de 3 à 200 caractères, `limit` 1 à 10, `codePostal` facultatif) → **le premier résultat est pris d'office**.
- Échecs fréquents et frustrants : faute de frappe → « introuvable » ; rue sans numéro ou commune seule → refus par `phrasePrecision` (il faut le numéro pour l'analyse DVF à l'adresse) ; homonymes (même rue dans une autre ville) → mauvais résultat pris sans le voir.
- On ne se sert pas de ce qu'on sait déjà : code postal et ville du projet (`projet.bien`), adresse partielle lue dans l'annonce.
- Le proxy met chaque réponse en **cache KV 24 h** (`apps/worker/src/proxy/cache.ts`) et limite à 60 requêtes/min par IP.

## Ce que ça changerait pour l'utilisateur

```
Adresse du bien
┌──────────────────────────────────────────────┐
│ 144 rue de l'oli                             │
└──────────────────────────────────────────────┘
  📍 144 Rue de l'Olivier, 13005 Marseille        ← surligné, Entrée pour choisir
  📍 144 Rue de l'Olivier, 13190 Allauch
  🛣  Rue de l'Olivier, 13005 Marseille  (sans numéro : on vous demandera le numéro)
```

- Les suggestions apparaissent **dès 3 caractères**, pendant la frappe (après une courte pause), **d'abord dans la ville du projet**.
- Flèches pour parcourir, Entrée ou clic pour choisir ; **choisir une suggestion lance l'analyse** (un clic de moins, le bouton « Analyser » reste pour qui préfère).
- Choisir une **rue sans numéro** ouvre un petit champ « Numéro ? » au lieu d'une erreur ; « Je ne connais pas le numéro » garde la rue (analyse moins précise, dite comme telle — lien avec la confiance, fiche 09).
- Le champ est **pré-rempli** avec ce qu'on sait : « Rue de l'Olivier, 13005 Marseille » si l'annonce le donne, sinon la ville du projet comme contexte (texte d'aide « dans Marseille (13005) — changer »).
- Aucune suggestion : « Vérifiez l'orthographe, ou tapez seulement la rue et la ville ».
- Hors ligne : champ libre comme aujourd'hui, message « suggestions indisponibles hors ligne ».

## Bogue constaté : les adresses « fiscales » (numéros 9xxx, résidences, cités) sont refusées

Exemples donnés par Pierre le 14/09/2026, vérifiés le même jour :

| Saisie                                     | Géoplateforme (BAN)                                                                                                       | DVF 2023-2024 (fichiers publics geo-dvf, commune 13001)                                                                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9001 route de Galice 13090 Aix-en-Provence | seulement la rue « Route de Galice » (`street`, 13001_1161) ; les numéros 12, 42, 4009, 4376, 4460 existent, **9001 non** | ventes au **9001** libellées « RES DE GALICE RUE DR BIANC » (voie `A436`, parcelle `13001000CP0090`) et « RES GALICE RUE DE LA CHART » (voie `A366`, parcelle `13001000CR0192`), avec coordonnées |
| 9001 Cité Valcros Aix-en-Provence          | rien de tel : « Rue de Valcros » ou « Route de Valcros » (`street`)                                                       | ventes au **9001 « CITE VALCROS »** (voie `A285`, parcelle `13001000CP0007`, 5.430097 / 43.526878), appartements et dépendances                                                                   |

**Cause** : `9001`, `9002`… sont des **numéros fictifs de la DGFiP** (adressage fiscal des parcelles et ensembles sans numéro de voirie) ; les voies à code en `A…` sont des **lieux-dits / ensembles fiscaux** (FANTOIR), absents de la BAN. La BAN ne peut donc renvoyer que la rue, et `phrasePrecision` refuse (« Adresse trouvée à la rue seulement »). Pourtant **les ventes DVF de l'immeuble existent** avec parcelle et coordonnées : l'analyse « même immeuble » serait la plus précise possible.

**Correction proposée** (peut être livrée avant l'autocomplétion, session courte) :

1. **Deuxième source d'adresses : les adresses DVF de la commune.** Worker, nouvelle route `GET /marche/adresses-dvf?codeInsee&texte` : lit le CSV DVF de la commune déjà sur R2 (`adresse/ventes.ts`), regroupe par `numero + codeVoie + voie` → `{ libelle: '9001 CITE VALCROS', numero, codeVoie, voie, parcelles, lat, lon, ventes }`, filtre par le texte normalisé (majuscules, sans accents, abréviations `RES`/`RESIDENCE`, `RTE`/`ROUTE`, `CITE`). Cache 24 h par commune (une écriture KV par commune, pas par frappe).
2. **Suggestions mélangées** : BAN d'abord ; puis « 📑 9001 Cité Valcros — adresse du cadastre, 7 ventes connues » quand le texte contient un numéro ≥ 9000, un nom de résidence ou de cité, ou quand la BAN ne trouve que la rue.
3. **Analyse** : `AdresseBien` construit depuis l'adresse DVF (numéro 9001, `codeVoie` `A285`, point de la parcelle) ; `analyserAdresse` retrouve le groupe « même immeuble » par numéro + code de voie **et** par parcelle, qui fonctionnent déjà. Précision affichée : « adresse du cadastre » (confiance au niveau adresse).
4. **Sans suggestion** : si la BAN ne trouve que la rue et que le numéro saisi est ≥ 9000, message clair (« Ce numéro vient du cadastre ; choisissez l'adresse dans la liste ou placez le bien sur la carte ») au lieu de « ajoutez le numéro ».
5. **Pièges à tester** : une même adresse fiscale « 9001 » dans plusieurs voies de la commune (Galice : A436 et A366 — deux résidences, deux suggestions) ; ventes sans coordonnées ; DPE ADEME (clé BAN absente → rapprochement par distance seulement).

Tests : cas réels ci-dessus en fixtures (lignes DVF anonymes, déjà publiques), route Worker (regroupement, normalisation, cache), écran (suggestion cadastre → analyse lancée, groupe « même immeuble » trouvé).

## Proposition de réalisation

### Worker

- Nouveau service **`/proxy/adresses`** (liste blanche `SERVICES`), distinct de `geocodage` : Géoplateforme `…/geocodage/search` avec `autocomplete=1`, `index=address`, `limit=6`, **biais de position** (`lat`, `lon` du centre de la commune du projet quand on l'a) et `postcode` facultatif ; réponse Zod `{ suggestions: [{ libelle, precision, numero, rue, codePostal, commune, codeInsee, lat, lon, cleBan }] }` (mêmes champs que `ResultatGeocodage`, pour réutiliser `lireCleBan` et `AdresseBien`).
- **Pas de cache KV pour les suggestions** : une requête par pause de frappe épuiserait vite le quota gratuit d'écritures KV (1 000 par jour). À la place : Cache API du Worker (`caches.default`, gratuit, par point de présence) 24 h, ou aucun cache (réponses Géoplateforme rapides). Le géocodage final garde son cache KV.
- **Débit** : limite dédiée plus large (ex. 120 suggestions/min par IP) pour ne pas bloquer une frappe normale sans ouvrir la porte aux abus ; à vérifier dans `proxy/debit.ts`.
- Alternative à trancher (question 1) : appeler la Géoplateforme **directement depuis le navigateur** (API publique, CORS ouvert, sans clé) : plus rapide, aucun quota à nous, mais contraire à la règle « APIs publiques par le proxy ».

### Web

- Composant **`ChampAdresse`** (`apps/web/src/composants/saisie/`, partagé avec le champ « Commune » de la fiche 13 : même moteur de combobox, deux sources) selon le motif WAI-ARIA **combobox avec liste** : `input[role="combobox"][aria-expanded][aria-controls][aria-activedescendant]`, `ul[role="listbox"]`, options annoncées (« 3 suggestions »), Échap ferme, Tab garde la saisie.
- Logique pure et testée à part : `suggestionsAAfficher` (tri : numéro exact > rue > lieu-dit, ville du projet d'abord), **anti-rebond 250 ms**, annulation de la requête précédente (`AbortController`), pas de requête sous 3 caractères ni pour un texte identique.
- `ClientWorker.suggererAdresses(texte, contexte)` revalidé par Zod ; `clientHorsLigne` → liste vide et message.
- `Adresse.tsx` : choisir une suggestion construit directement `AdresseBien` (plus de second géocodage) puis `analyser(adresse)` ; « Numéro ? » complète `numero` et `cleBan` par un géocodage précis de « numéro + rue + ville ».
- Pré-remplissage : `projet.bien.codePostal` / ville → contexte de recherche ; adresse partielle de l'annonce si elle existe dans `projet.source`.
- Même composant ensuite dans le formulaire Vérifier si l'on y demande l'adresse (hors périmètre ici).

## Décisions prises (14/09/2026)

1. **Par le Worker** (service `/proxy/adresses`, sans cache KV).
2. **Choisir une suggestion lance l'analyse** tout de suite ; le bouton « Analyser » reste.
3. **Rue sans numéro** : on demande le numéro, et l'on peut continuer sans (analyse moins précise, dite comme telle).

## Questions ouvertes

1. **Placer le bien sur la carte** quand l'adresse exacte est inconnue (annonce sans numéro) : un clic sur la carte (fiche 15) donne le point → analyse autour ? Proposition : oui, mais dans la fiche 15.

## Tests à mettre à jour

- Worker : service `adresses` (paramètres, biais de position, réponse amont invalide, Géoplateforme en panne, débit dédié, pas d'écriture KV). Couverture 100 %.
- Web : `suggestionsAAfficher`, anti-rebond et annulation (faux minuteurs), combobox au clavier (flèches, Entrée, Échap, `aria-activedescendant`), rue sans numéro → champ « Numéro ? », hors ligne ; `tests/adresse-ecran.test.tsx` (le parcours actuel « taper puis Analyser » doit rester possible).
- Playwright : sans Worker en e2e → suggestions simulées par `page.route` : taper, choisir au clavier, l'analyse démarre.

## Coût et risques

- Appels : quelques requêtes Géoplateforme par adresse saisie (au lieu d'une), gratuites, sans clé ; aucune écriture KV ajoutée.
- Quota Workers : ~5 à 10 requêtes par saisie d'adresse, négligeable face aux 100 000 par jour.
- Vie privée : l'adresse tapée part vers l'IGN (déjà le cas aujourd'hui au clic) ; rien n'est enregistré côté Worker hors journal technique sans le texte.
