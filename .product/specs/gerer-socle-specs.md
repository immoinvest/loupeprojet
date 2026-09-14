# Specs — Gérer, le socle (G1a)

Discovery : `.product/features/gerer-socle-discovery.md` · Épic : `.product/specs/gestion-locative-specs.md` (stories G1-1, G1-2, G1-3, G1-5, G1-6, G1-9 reprises et resserrées) · Branche `feat/gerer-socle`.

## Épics

| Épic | Titre                                 | Stories    |
| ---- | ------------------------------------- | ---------- |
| E1   | Calcul et données de gestion          | US-1, US-2 |
| E2   | Menu et accueil de Gérer (`apps/web`) | US-3, US-4 |
| E3   | Les portes en deux clics (`apps/web`) | US-5, US-6 |

## Règle transversale : deux clics

Un clic = activer un bouton ou un lien qui fait avancer. Remplir un champ, cocher, choisir dans une liste ne comptent pas. Le compte part de l'utilisateur connecté, sur l'accueil de Gérer (ou sur un projet pour la porte « J'ai acheté ce bien »). Preuve : tests de rendu qui comptent chaque `click` du parcours.

## Stories

### US-1 : Paquet `@loupe/gestion` (calcul pur)

En tant que développeur, je veux les règles des loyers dans un paquet pur et testé, pour que l'API, l'écran et plus tard la banque calculent la même chose.

Priorité **P0** · Effort **M**

```gherkin
Scénario : loyer d'un mois plein
  Étant donné une location du 1er octobre 2026, loyer 65 000 centimes, charges 5 000, jour 5
  Quand je demande le loyer dû de 2026-10
  Alors il couvre 2026-10-01 → 2026-10-31, dû le 2026-10-05, 70 000 centimes (65 000 + 5 000)

Scénario : prorata d'entrée et de sortie
  Étant donné une entrée le 2026-10-12
  Alors le loyer dû de 2026-10 vaut round(65 000 × 20 ÷ 31) + round(5 000 × 20 ÷ 31) = 41 935 + 3 226 centimes
  Et la période commence le 2026-10-12, la date due reste le 2026-10-12 si elle précède l'entrée
  Étant donné une fin le 2027-03-14
  Alors le loyer dû de 2027-03 couvre 14 jours sur 31, et aucun loyer n'est dû en 2027-04

Scénario : mois hors location
  Étant donné une location qui commence en 2026-10
  Alors aucun loyer n'est dû en 2026-09

Scénario : statut à une date
  Étant donné le loyer dû le 2026-10-05
  Alors il est « à venir » avant le 2026-10-01, « attendu » du 2026-10-01 au 2026-10-09, « en retard » à partir du 2026-10-10 (5 jours de délai)
  Et « reçu » dès qu'un paiement de la période couvre le montant, quelle que soit la date

Scénario : résumé du mois
  Étant donné 4 locations actives en septembre 2026, 3 payées
  Alors le résumé donne 3 reçus sur 4, les montants reçu et attendu, le nombre de retards et une ligne par loyer triée : en retard, attendus, à venir, reçus

Scénario : entrées invalides
  Quand une location a un jour de loyer hors 1..28, un loyer négatif ou non entier, une date mal formée, ou une fin avant le début
  Alors son schéma la refuse avec le chemin du champ fautif
```

### US-2 : API de gestion et migration D1

En tant que bailleur connecté, je veux que mes biens, locataires, locations, paiements et préférences soient enregistrés avec mon compte, pour les retrouver partout et, plus tard, que la banque et les envois travaillent sans moi.

Priorité **P0** · Effort **L**

```gherkin
Scénario : état complet
  Étant donné Camille connectée, avec un bien loué et un paiement
  Quand elle demande GET /api/gestion/etat
  Alors la réponse est 200 { biens, locataires, locations, paiements, preferences } avec ses seules données
  Et Cache-Control vaut no-store

Scénario : création en une requête
  Quand elle POST /api/gestion/locations { bien, locataire, location }
  Alors bien, locataire et location sont créés ensemble (aucun des trois si l'un est invalide) et la réponse est 201
  Et sans locataire ni location, seul un bien vacant est créé

Scénario : paiement et annulation
  Quand elle POST /api/gestion/paiements { locationId, periode, montant, date }
  Alors la réponse est 201 avec le paiement
  Et un second paiement de la même période rend 409 PERIODE_DEJA_RECUE
  Quand elle DELETE /api/gestion/paiements/<id>
  Alors la réponse est 204

Scénario : préférences du menu
  Quand elle PUT /api/gestion/preferences { analyser: false, gerer: true }
  Alors la réponse est 200 et GET /etat renvoie ces préférences
  Et { analyser: false, gerer: false } rend 400 CHAMPS_INVALIDES
  Et sans préférence enregistrée, les deux sections sont affichées

Scénario : non connecté, origine, validation
  Quand une requête arrive sans session
  Alors la réponse est 401 NON_CONNECTE
  Quand une écriture arrive avec un en-tête Origin inconnu
  Alors la réponse est 403 ORIGINE_INCONNUE et rien n'est écrit
  Quand le corps est invalide ou dépasse 64 Ko
  Alors la réponse est 400 CHAMPS_INVALIDES ou 413 CORPS_TROP_GROS

Scénario : accès croisé
  Étant donné les comptes A et B
  Quand A paie ou annule sur une location ou un paiement de B
  Alors la réponse est 404 INTROUVABLE et les données de B sont intactes

Scénario : base pas encore migrée
  Étant donné la base sans les tables de gestion
  Quand une route de gestion est appelée
  Alors la réponse est 503 GESTION_INDISPONIBLE, journalisée sans donnée personnelle, et les routes des comptes fonctionnent

Scénario : suppression du compte
  Quand Camille supprime son compte
  Alors ses biens, locataires, locations, paiements et préférences sont supprimés (cascade des clés étrangères, vérifiée à travers l'interface D1)
```

### US-3 : Menu à deux sections et « Mon menu »

En tant que bailleur, je veux mes projets et mes biens loués dans le même menu, et pouvoir masquer la section qui ne me sert pas.

Priorité **P0** · Effort **M**

```gherkin
Scénario : deux sections
  Étant donné la barre latérale
  Alors la section « Analyser » montre « Nouveau projet », les 5 projets les plus récents, « Tous mes projets · N » au-delà de 5, et « Comparer »
  Et la section « Gérer » montre « Ajouter un bien » et « Accueil » (avec le nombre de loyers en retard quand il y en a)
  Et le grand bouton « Nouveau projet » a disparu : chaque section commence par son action de création

Scénario : sans compte
  Étant donné que je ne suis pas connecté
  Alors la section Gérer se réduit à « Gérer mes biens loués »

Scénario : masquer une section
  Étant donné Camille connectée sur Mon compte
  Alors la carte « Mon menu » montre deux interrupteurs, Analyser et Gérer, actifs
  Quand elle désactive Analyser
  Alors la section Analyser disparaît du menu et le réglage est enregistré (PUT /preferences)
  Et l'interrupteur Gérer devient inactif : impossible de masquer les deux
  Quand l'enregistrement échoue
  Alors l'interrupteur revient à sa position et un message le dit

Scénario : lien croisé masqué
  Étant donné la section Gérer masquée
  Alors l'en-tête d'un projet ne montre pas « J'ai acheté ce bien »
```

### US-4 : Accueil de Gérer

En tant que bailleur, je veux voir en une phrase qui a payé ce mois-ci, et marquer un loyer reçu en un clic.

Priorité **P0** · Effort **M**

```gherkin
Scénario : sans compte
  Quand j'ouvre /gerer sans être connecté
  Alors je lis ce que Gérer fait, pourquoi il faut un compte, et « Se connecter » mène à /connexion?retour=/gerer

Scénario : premier accès
  Étant donné un compte sans bien
  Alors l'accueil titre « Mettons tes biens en pilote automatique. » et montre trois portes :
    « J'ai acheté un bien analysé » (mes projets, « Offre faite » en premier), « Connecter ma banque » (Bientôt), « Ajouter à la main »

Scénario : le mois
  Étant donné 4 loyers dus en septembre 2026 dont 3 reçus
  Alors l'accueil titre « 3 loyers sur 4 reçus », montre la barre en euros et une ligne par loyer (bien, locataire, montant, date due, statut en mot)
  Et chaque loyer attendu ou en retard a un bouton « Reçu »

Scénario : reçu puis annuler
  Quand je clique « Reçu » sur le loyer de Julie
  Alors il passe « Reçu » (POST /paiements du montant dû, daté du jour) et un bandeau « Loyer de Julie reçu » propose « Annuler »
  Quand je clique « Annuler »
  Alors le paiement est supprimé et le loyer redevient « Attendu » ou « En retard »

Scénario : erreurs
  Quand l'API répond indisponible ou le réseau manque
  Alors l'accueil affiche un message clair et « Réessayer », sans rien perdre de ce qui est affiché
```

### US-5 : Porte « Ajouter à la main »

En tant que bailleur sans analyse, je veux créer une location sur un seul écran.

Priorité **P0** · Effort **S**

```gherkin
Scénario : deux clics
  Étant donné l'accueil de Gérer
  Quand je clique « Ajouter à la main »                                      # clic 1
  Alors un écran demande : adresse, vide ou meublée, loyer hors charges, charges, prénom et nom, e-mail, date d'entrée
  Quand je remplis et clique « Créer »                                        # clic 2
  Alors la location est créée et j'arrive sur l'accueil qui la montre
  Et le dépôt vaut 1 mois de loyer hors charges (vide) ou 2 (meublée), le jour du loyer vaut 5, le type de bien « appartement »
  Et « Plus de détails » (replié) permet de changer le jour du loyer, le dépôt, le type de bien et la surface

Scénario : saisies
  Quand j'écris « 650,50 » ou « 650.50 » ou « 650 € »
  Alors le loyer vaut 65 050 centimes
  Quand le loyer est vide, négatif ou supérieur à 100 000 €, l'adresse vide ou l'e-mail mal formé
  Alors le champ dit quoi corriger et rien n'est envoyé
  Et un e-mail vide est accepté

Scénario : bien vacant
  Quand je laisse le locataire vide et clique « Créer »
  Alors seul le bien est créé, vacant
```

### US-6 : Porte « J'ai acheté ce bien »

En tant que Camille, je veux transformer mon analyse en bien géré sans rien ressaisir.

Priorité **P0** · Effort **M**

```gherkin
Scénario : deux clics depuis le projet
  Étant donné un projet analysé en meublé, loyer 650 €, charges 50 €, 38 m², appartement
  Quand je clique « J'ai acheté ce bien » dans son en-tête                    # clic 1
  Alors l'écran « Prêt à gérer » montre, badges compris :
    | Le bien     | nom, adresse, type, surface            | analyse                |
    | La location | meublée, 650 € + 50 €, dépôt 1 300 €, loyer le 5, entrée le 1er du mois suivant | analyse / par défaut |
  Et une seule saisie : « Ton locataire » (prénom et nom, e-mail)
  Quand je saisis « Julie Martin » et clique « C'est parti »                  # clic 2
  Alors la location est créée avec l'instantané des entrées du projet, le projet passe « Acheté », et j'arrive sur l'accueil

Scénario : pas encore loué
  Quand je clique « Pas encore loué »                                         # clic 2
  Alors seul le bien est créé, vacant, et le projet passe « Acheté »

Scénario : adresse
  Étant donné un projet avec une adresse précise enregistrée
  Alors l'adresse est reprise
  Étant donné un projet sans adresse précise
  Alors le champ adresse est à remplir et « C'est parti » reste inactif tant qu'il est vide

Scénario : projet introuvable
  Quand j'ouvre /gerer/pret/<id inconnu>
  Alors l'écran dit que le projet est introuvable et renvoie vers Mes projets
```

## Contrats d'API

Toutes les routes : JSON, cookie de session Better Auth, `Cache-Control: no-store`. Erreurs `{ code }`.

```yaml
GET /api/gestion/etat
  200: { biens: Bien[], locataires: Locataire[], locations: Location[], paiements: Paiement[], preferences: { analyser: boolean, gerer: boolean } }
  401 NON_CONNECTE · 503 GESTION_INDISPONIBLE

POST /api/gestion/locations
  corps: {
    bien: { nom (1..80), adresse (1..200), codePostal? (5 chiffres), ville? (1..80), type: appartement|maison|studio|parking,
            surface? (m², > 0, ≤ 10 000), meuble: boolean, projetId? (1..100), projet? (objet JSON, instantané des entrées) },
    locataire: { prenom (1..80), nom (1..80), email? } | null,
    location: { type: nue|meublee, debut: AAAA-MM-JJ, fin?: AAAA-MM-JJ, jourLoyer: 1..28,
                loyerHorsCharges: centimes 0..10 000 000, charges: centimes 0..10 000 000, depot: centimes 0..10 000 000 } | null
  }  (locataire et location tous deux présents ou tous deux null)
  201: { bien, locataire, location }
  400 CHAMPS_INVALIDES · 401 · 403 ORIGINE_INCONNUE · 413 CORPS_TROP_GROS · 503

POST /api/gestion/paiements
  corps: { locationId, periode: AAAA-MM, montant: centimes 1..10 000 000, date: AAAA-MM-JJ }
  201: Paiement
  400 · 401 · 403 · 404 INTROUVABLE (location d'un autre compte ou inconnue) · 409 PERIODE_DEJA_RECUE · 503

DELETE /api/gestion/paiements/:id
  204
  401 · 403 · 404 · 503

PUT /api/gestion/preferences
  corps: { analyser: boolean, gerer: boolean } (au moins un vrai)
  200: { analyser, gerer }
  400 · 401 · 403 · 503
```

## Modèle de données (migration `0002_gestion.sql`)

```
Table gestion_bien
  id text PK · userId text → user.id (cascade) · nom text · adresse text · codePostal text? · ville text?
  type text · surface real? · meuble integer (0/1) · projetId text? · projet text? (JSON) · creeLe text · modifieLe text
Table gestion_locataire
  id text PK · userId → user.id (cascade) · prenom text · nom text · email text? · creeLe text
Table gestion_location
  id text PK · userId → user.id (cascade) · bienId → gestion_bien.id (cascade) · locataireId → gestion_locataire.id (cascade)
  type text · debut text · fin text? · jourLoyer integer · loyerHorsCharges integer · charges integer · depot integer · creeLe text
Table gestion_paiement
  id text PK · userId → user.id (cascade) · locationId → gestion_location.id (cascade) · periode text · montant integer · date text
  source text ('manuel') · creeLe text · unique (locationId, periode)
Table gestion_preference
  userId text PK → user.id (cascade) · analyser integer · gerer integer · modifieLe text
Index : userId sur les quatre premières tables, bienId sur gestion_location
```

## Priorisation

| Story | Priorité | Effort | Dépend de     |
| ----- | -------- | ------ | ------------- |
| US-1  | Must     | M      | —             |
| US-2  | Must     | L      | US-1          |
| US-3  | Must     | M      | US-2 (client) |
| US-4  | Must     | M      | US-1, US-2    |
| US-5  | Must     | S      | US-4          |
| US-6  | Must     | M      | US-4, US-5    |

Total : environ deux jours de travail, six commits.

## Auto-revue (checkpoint validé par Claude)

- **Six stories P0, aucune P1** : le périmètre est déjà resserré ; ce qui était P1 dans l'épic (fiches, colocation, PDF) est parti en G1b.
- **`POST /paiements` refuse le doublon d'une période** : simple et sûr tant qu'il n'y a que des paiements complets ; le paiement partiel (G1b) changera cette règle en « somme des paiements ≤ dû ».
- **Instantané du projet côté serveur** : jusqu'à 64 Ko de JSON par bien, sans donnée personnelle du locataire ; il porte les revenus du ménage saisis dans l'analyse. Acceptable (même compte, même personne) ; à rappeler dans l'export des données (G1b).
- **Préférences d'abord serveur, puis mémoire locale** pour afficher le bon menu dès le chargement suivant : un menu qui clignote serait pire qu'un menu en retard d'une visite.
