# Specs — adresse-suggestions

Discovery : `.product/features/adresse-suggestions-discovery.md`. Fiche : `.product/backlog/21-adresse-autocompletion.md`.

## Épic : choisir l'adresse du bien sans se tromper

### US-1 (Must) — Worker : adresses DVF d'une commune

En tant qu'application, je veux la liste des adresses du cadastre d'une commune filtrée par un texte, pour proposer les adresses fiscales absentes de la BAN.

`GET /marche/adresses-dvf?codeInsee=13001&texte=9001 cite valcros&limit=6`

```gherkin
Scénario: adresse fiscale d'une cité
  Étant donné le CSV DVF de 13001 avec trois ventes au 9001 CITE VALCROS (voie A285)
  Quand je demande texte "9001 Cité Valcros Aix-en-Provence"
  Alors la réponse contient { libelle "9001 CITE VALCROS", numero 9001, codeVoie "A285", ventes 3, parcelles ["13001000CP0007"], lat, lon }

Scénario: même numéro fiscal dans deux résidences
  Étant donné des ventes au 9001 voie A436 "RES DE GALICE RUE DR BIANC" et 9001 voie A366 "RES GALICE RUE DE LA CHART"
  Quand je demande texte "9001 route de Galice 13090 Aix-en-Provence"
  Alors deux adresses sont rendues, une par voie

Scénario: normalisation
  Alors « Résidence », « RES », accents, apostrophes et code postal sont tolérés ; le numéro tapé doit être égal

Scénario: ventes sans coordonnées
  Alors une adresse dont aucune vente n'a de point n'est pas proposée ; le point est la moyenne des ventes situées

Scénario: cache par commune
  Quand deux textes différents sont demandés pour la même commune
  Alors le CSV est lu une fois et une seule écriture KV a lieu (24 h) ; aucune écriture si la lecture R2 est en panne

Scénario: paramètres invalides → 400 PARAMETRES_INVALIDES ; commune non publiée → 200 avec adresses []
```

### US-2 (Must) — Worker : suggestions d'adresses BAN

`GET /proxy/adresses?q=144 rue de l'oli&limit=6&lat&lon&codePostal`

```gherkin
Scénario: autocomplétion
  Alors la Géoplateforme est appelée avec autocomplete=1, index=address, limit, lat/lon s'ils sont fournis
  Et la réponse est { suggestions: [{ libelle, precision, numero, rue, codePostal, commune, codeInsee, lat, lon, cleBan }] } sans les communes seules

Scénario: pas de cache KV
  Alors aucune lecture ni écriture KV n'a lieu pour ce service

Scénario: débit dédié
  Alors /proxy/adresses est limité par LIMITEUR_SUGGESTIONS (120/min/IP), les autres services gardent LIMITEUR

Scénario: amont en panne ou invalide → 502 AMONT_INDISPONIBLE / AMONT_INVALIDE
```

### US-3 (Must) — Web : choisir une adresse du cadastre

```gherkin
Scénario: le bogue d'Aix
  Étant donné un projet à Aix-en-Provence
  Quand je tape "9001 Cité Valcros Aix-en-Provence"
  Alors la liste propose « 9001 Cite Valcros — adresse du cadastre, 3 ventes connues »
  Quand je la choisis
  Alors l'analyse est lancée avec numero 9001 et codeVoie A285, et l'adresse est enregistrée

Scénario: numéro fiscal sans suggestion, bouton Analyser
  Quand la BAN ne trouve que la rue pour "9001 route de Galice"
  Alors le message dit que ce numéro vient du cadastre (et non « ajoutez le numéro »)
```

### US-4 (Must) — Web : suggestions pendant la frappe

```gherkin
Scénario: clavier
  Quand je tape "144 rue de l'oli" puis ↓ et Entrée
  Alors l'analyse démarre sur la suggestion surlignée, sans second géocodage

Scénario: anti-rebond et annulation
  Alors aucune requête sous 3 caractères ni pour un texte identique ; une requête par pause de 250 ms ; la précédente est annulée

Scénario: tri
  Alors numéro exact > rue > lieu-dit, et le code postal du projet d'abord

Scénario: rue sans numéro
  Quand je choisis « Rue de l'Olivier, 13005 Marseille »
  Alors « Numéro ? » apparaît ; avec 144 → géocodage précis puis analyse ; « Je ne connais pas le numéro » → analyse sans numéro, dite moins précise

Scénario: hors ligne → message « Suggestions indisponibles pour le moment », la saisie libre et Analyser fonctionnent

Scénario: le parcours « taper puis Analyser » reste possible
```

### US-5 (Should) — e2e

Playwright avec `page.route` : taper, choisir au clavier, `/marche/adresse` est appelé.

## Priorités

Must : US-1 à US-4 · Should : US-5. Contrats : `/marche/adresses-dvf` v1, `/proxy/adresses` (enveloppe du proxy). Worker 0.11.0.

## Auto-revue critique

Stories testables et bornées au périmètre de la fiche de session ; US-1 d'abord (le bogue) comme demandé. Le « point de la parcelle » de la fiche est remplacé par la moyenne des points des ventes (le CSV porte le point de la parcelle de chaque vente : identique). Validé.
