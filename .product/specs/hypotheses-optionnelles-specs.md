# Specs : Hypothèses optionnelles (fiche 02)

Discovery : `../features/hypotheses-optionnelles-discovery.md`. Branche : `feat/hypotheses-optionnelles`. Périmètre : `packages/moteur`, `apps/web`, tests e2e, docs. Aucun changement du Worker.

## Épics

| Épic | Titre                                                 | Stories    |
| ---- | ----------------------------------------------------- | ---------- |
| E1   | Moteur : résultats partiels typés                     | US-1, US-2 |
| E2   | Création : Vérifier minimal, loyer de marché, défauts | US-3       |
| E3   | Écrans : « il manque … pour cette analyse »           | US-4, US-5 |
| E4   | Méthode, e2e, formats, documentation                  | US-6, US-7 |

Priorités : US-1 à US-5 Must ; US-6 Must (la Méthode et les e2e font partie de la Definition of Done) ; US-7 Must. Effort global : L.

## Modèle de données (moteur, Zod)

```
LocationSchema.loyerHc        montant ≥ 0, OPTIONNEL (était obligatoire)
FiscaliteSchema.tmi           TmiSchema.default(0.3)          « tranche la plus fréquente d'un ménage qui investit ; barème 2026 : 30 % dès 29 316 € par part »
HypothesesSchema.revenusMensuels   montant ≥ 0, OPTIONNEL     (si la fiche 01 l'a déjà fait : rien à changer)

CodeManqueSchema = enum ['LOYER_ABSENT', 'REVENUS_ABSENTS']
Manque = { code: CodeManque, champ: string }                   champ = chemin pointé du projet (« hypotheses.location.loyerHc »)
manquesDe(projet: Projet): Manque[]                           dans l'ordre : loyer, revenus

ProjetComplet = Projet dont hypotheses.location.loyerHc est un number
estComplet(projet): projet is ProjetComplet

ResultatsBase
  projet: Projet
  financement: ResultatFinancement                            toujours calculé (frais, prêt, TAEG, effort, CRD)
  estimation: EstimationPrix | null                           toujours tenté (null sans DVF, comme aujourd'hui)
  verdict: ResultatVerdict                                    toujours cinq feux
  cashflow, fiscalite, revente, rendement                     null quand LOYER_ABSENT (les quatre ensemble)
  manques: readonly Manque[]
Resultats = ResultatsBase + scenarios (null si LOYER_ABSENT ou avecScenarios: false) + meta

FeuVerdict.raison: CodeManque | null                          non null seulement quand feu = 'inconnu' à cause d'un manque
TauxEffort.hcsf: null quand revenus OU loyer absents ; depasseHcsf = hcsf !== null && hcsf > seuil
ResultatsSchema : sections nullables, manques, raison ; strictObject partout (rien d'autre ne change)
```

## Stories

### US-1 : Schéma et résultats partiels (moteur)

En tant que moteur, je veux accepter un projet sans loyer ni revenus et décrire ce qui manque, afin que l'interface n'ait jamais à inventer une valeur.

Priorité : P0 · Effort : M

```gherkin
Scénario: le projet d'exemple ne change pas
  Étant donné projetExemple
  Quand calculerProjet le calcule
  Alors chaque section vaut ce qu'elle valait avant (même objet, comparé au centime sur cash-flow mensuel, impôt total, cash net, TRI, cinq feux)
  Et manques est vide
  Et ResultatsSchema accepte le résultat

Scénario: loyer absent accepté par le schéma
  Étant donné projetExemple sans hypotheses.location.loyerHc
  Alors ProjetSchema.parse réussit et estComplet(projet) vaut faux
  Et manquesDe(projet) vaut [{ code: 'LOYER_ABSENT', champ: 'hypotheses.location.loyerHc' }]

Scénario: revenus absents
  Étant donné projetExemple sans revenusMensuels
  Alors ProjetSchema.parse réussit
  Et manquesDe(projet) vaut [{ code: 'REVENUS_ABSENTS', champ: 'hypotheses.revenusMensuels' }]
  Et sans loyer ni revenus, les deux manques sont listés dans cet ordre

Scénario: tranche par défaut
  Étant donné un projet sans hypotheses.fiscalite.tmi
  Alors ProjetSchema.parse pose tmi = 0,3
  Et une tranche hors barème (0,25) est toujours refusée

Scénario: courte durée sans loyer
  Étant donné un projet en courte durée avec courteDuree mais sans loyerHc
  Alors le schéma l'accepte (la nuitée porte les recettes) mais estComplet vaut faux : le calcul reste partiel
```

### US-2 : Calcul partiel sans loyer, effort sans revenus (moteur)

En tant que Camille, je veux voir ce qui se calcule sans loyer (prix, frais, prêt, risques) et savoir exactement ce qui manque, afin de compléter en connaissance de cause.

Priorité : P0 · Effort : L

```gherkin
Scénario: rapport partiel sans loyer
  Étant donné projetExemple sans loyer
  Quand calculerProjet le calcule
  Alors aucune exception n'est levée
  Et financement est calculé (montant emprunté, mensualité, TAEG, frais d'acquisition identiques à l'exemple)
  Et estimation est calculée (mêmes bornes que l'exemple, correction charges absente si elle dépendait du loyer)
  Et cashflow, fiscalite, revente, rendement et scenarios valent null
  Et manques contient LOYER_ABSENT
  Et ResultatsSchema accepte le résultat

Scénario: cinq feux sans loyer
  Étant donné le même projet
  Alors les feux prix et risques sont ceux de l'exemple
  Et les feux rendement, cashflow et effort valent 'inconnu' avec valeur null et raison 'LOYER_ABSENT'
  Et la synthèse compte 3 inconnus

Scénario: points de vigilance sans loyer
  Étant donné le même projet
  Alors les points du bien (PV d'AG, charges de copro, DPE, étage, risques) et CONFIRMER_TAXE_FONCIERE sont présents
  Et DUREE_PRET_HORS_HCSF suit la durée comme avant
  Et EFFORT_HCSF_DEPASSE, PLAFOND_MICRO_DEPASSE, LOYER_AU_DESSUS_PLAFOND, PS_BIC_A_CONFIRMER et EXPLIQUER_PRIX_SOUS_MARCHE (qui dépend du feu prix seulement : présent si le prix est bon) sont absents sauf le dernier

Scénario: effort sans revenus, loyer connu
  Étant donné projetExemple sans revenusMensuels
  Alors tout le rapport est calculé (cashflow, fiscalité, revente, rendement, scénarios)
  Et financement.effort.hcsf et sansLoyers valent null, depasseHcsf vaut faux
  Et le feu effort vaut 'inconnu' avec raison 'REVENUS_ABSENTS'
  Et EFFORT_HCSF_DEPASSE est absent
  Et manques contient REVENUS_ABSENTS

Scénario: effort avec revenus, loyer absent
  Étant donné projetExemple sans loyer, revenus 2 600 €
  Alors hcsf vaut null (les loyers HCSF sont inconnus), sansLoyers vaut mensualité ÷ 2 600
  Et le feu effort vaut 'inconnu' avec raison 'LOYER_ABSENT'

Scénario: scénarios et prix cibles
  Étant donné un projet sans loyer et avecScenarios: true
  Alors scenarios vaut null (aucune variante n'est calculée)

Scénario: prix cible et variantes sur un projet complet
  Étant donné projetExemple
  Alors les scénarios, prix cibles et variantes de revente sont inchangés
```

### US-3 : Vérifier minimal, loyer de marché à la création, défauts « estimé » (web)

En tant que Camille, je veux créer un projet avec le prix, la surface, le code postal et la ville, afin de voir un rapport sans remplir vingt cases.

Priorité : P0 · Effort : M

```gherkin
Scénario: quatre champs suffisent
  Étant donné le formulaire Vérifier à la main
  Quand je remplis prix 120 000, surface 40, code postal 69003, ville Lyon et je clique « Créer le projet et voir le rapport »
  Alors le projet est créé et son rapport s'ouvre
  Et aucune erreur n'est affichée sur loyer, apport, durée, tranche ou revenus

Scénario: erreurs seulement sur le minimum
  Étant donné le formulaire vide
  Quand je clique « Créer le projet »
  Alors les messages sont : « Indiquez le prix affiché. », « Indiquez la surface. », « Code postal à 5 chiffres. », « Indiquez la ville. »
  Et aucun message sur le loyer, l'apport, la durée ou les revenus

Scénario: champs facultatifs contrôlés quand ils sont remplis
  Quand je saisis une durée de 0 ou de 31 ans, un loyer, un apport ou des revenus négatifs, ou « abc »
  Alors le champ porte un message (« Entre 1 et 30 ans. », « Nombre attendu. »…) et le projet n'est pas créé

Scénario: défauts affichés avec leur badge
  Étant donné le formulaire Vérifier
  Alors durée du prêt vaut « 25 », apport « 0 », tranche « 30 % », chacun avec le badge « estimé »
  Et le loyer et les revenus sont vides, avec l'indication « facultatif » ; le loyer précise « vide : loyer de marché de la commune »
  Quand je modifie la durée
  Alors son badge passe à « à toi »
  Quand je vide l'apport puis crée le projet
  Alors l'apport vaut 0 € avec la provenance « estime » (pas d'erreur)

Scénario: loyer pris dans les loyers de marché
  Étant donné un Worker qui répond au géocodage et au marché avec un loyer ANIL de 13,10 €/m²
  Quand je crée un projet meublé de 40 m² sans loyer
  Alors le projet porte location.loyerHc = loyerVise(loyerPourBien(anil, 40, prime meublé), 'meuble_lld')
  Et la provenance de location.loyerHc vaut « anil » (badge « donnée publique » dans Hypothèses)
  Et marche.loyerReferenceM2 est renseigné comme aujourd'hui

Scénario: loyer saisi par l'utilisateur prioritaire
  Étant donné le même Worker
  Quand je saisis un loyer de 700 €
  Alors location.loyerHc vaut 700 avec la provenance « utilisateur »

Scénario: sans donnée de marché, projet sans loyer
  Étant donné un Worker hors ligne (ou une commune sans loyer ANIL)
  Quand je crée un projet sans loyer
  Alors le projet n'a pas de location.loyerHc, aucune provenance pour ce champ, et le rapport s'ouvre en mode « à compléter »

Scénario: revenus et tranche
  Quand je crée un projet sans revenus
  Alors hypotheses.revenusMensuels est absent
  Quand je crée un projet sans toucher la tranche
  Alors fiscalite.tmi vaut 0,3 avec la provenance « estime »
  Quand je choisis 11 %
  Alors fiscalite.tmi vaut 0,11 avec la provenance « utilisateur »

Scénario: construireProjet et les défauts lus par la Méthode
  Étant donné une saisie sans apport, durée, tranche ni revenus
  Alors construireProjet pose apport 0 (estime), dureeAnnees 25 (estime), tauxNominal = taux du mois à 25 ans (usure), tmi 0,3 (estime)
  Et defautsDuMoteur() expose apport, dureeAnnees et tmi par défaut
```

### US-4 : Bandeau « Il manque … pour cette analyse » et écrans du projet (web)

En tant que Camille, je veux que chaque onglet me dise ce qui lui manque et me laisse le compléter sur place, afin de ne jamais chercher où saisir.

Priorité : P0 · Effort : L

```gherkin
Scénario: Rapport sans loyer
  Étant donné un projet enregistré sans loyer (sans DVF)
  Quand j'ouvre son rapport
  Alors le titre est « Prix sans repère de marché. Le loyer reste à indiquer. »
  Et le sous-titre ne contient ni cash-flow ni effort
  Et les cinq feux affichent « Prix vs ventes réelles : pas de données », « Rendement net : loyer à indiquer », « Cash-flow : loyer à indiquer », « Effort bancaire : loyer à indiquer », « Risques : aucun »
  Et un bandeau « Il manque le loyer visé pour cette analyse » montre le champ « Loyer visé, hors charges »
  Et la carte « Est-ce que c'est cher ? » est rendue comme aujourd'hui
  Et les cartes « Est-ce que ça s'autofinance ? », « Combien d'impôts ? » et « Qu'est-ce qu'il vous restera ? » affichent « À compléter » et aucun chiffre
  Et la carte des leviers est absente

Scénario: compléter depuis le bandeau
  Étant donné le rapport précédent
  Quand je saisis 700 dans le champ du bandeau
  Alors le projet est enregistré avec loyerHc 700 (provenance « utilisateur »)
  Et le bandeau disparaît, les cartes et les feux se remplissent (« Cash-flow −… €/mois »)

Scénario: loyer de marché connu
  Étant donné un projet sans loyer dont marche.loyerReferenceM2 vaut 12,05 (40 m², meublé)
  Alors le bandeau propose « Utiliser le loyer de marché : 554 € »
  Quand je clique
  Alors loyerHc vaut 554 avec la provenance « anil »

Scénario: Fiscalité et Revente sans loyer
  Quand j'ouvre Fiscalité (ou Revente)
  Alors le titre de l'onglet reste, le bandeau « Il manque le loyer visé pour cette analyse » remplace les cartes des régimes (ou les horizons et cartes)
  Et le champ du bandeau complète le projet comme dans le Rapport

Scénario: Hypothèses sans loyer
  Quand j'ouvre Hypothèses
  Alors la synthèse affiche « — » pour cash-flow, rendement net, TRI et effort
  Et le champ « Loyer visé, hors charges » est vide, sans badge, et accepte le vide (pas d'erreur « nécessaire au calcul »)
  Quand je saisis 700
  Alors la synthèse se remplit
  Quand je vide de nouveau le loyer
  Alors le projet est enregistré sans loyer et la synthèse repasse à « — »

Scénario: courte durée sans loyer dans Hypothèses
  Étant donné un projet sans loyer
  Quand je passe le mode en courte durée
  Alors la nuitée de départ vaut 60 € et l'occupation 60 %, le projet est accepté

Scénario: Visite, Estimation, Mes projets, Comparer, impression, partage
  Étant donné un projet sans loyer
  Alors Visite montre les points du bien et les feux « à indiquer » ; aucun point d'effort ni de régime
  Et la carte « Le loyer de marché » de l'onglet Estimation dit « Loyer visé du projet : non renseigné » et propose « Utiliser … comme loyer visé »
  Et la carte de Mes projets affiche « — » pour cash-flow, rendement net et TRI, les feux inconnus en gris
  Et Comparer affiche « — » sur cash-flow, rendements, effort, impôt, cash net, TRI, enrichissement ; le projet se trie en dernier sur ces lignes
  Et le document imprimable et la page de partage montrent la phrase du bandeau sans champ ni bouton

Scénario: revenus absents, loyer connu
  Étant donné un projet avec loyer et sans revenus
  Alors le rapport est complet ; le feu effort dit « Effort bancaire : revenus à indiquer »
  Et le bandeau n'apparaît pas (rien ne bloque) ; la pastille du feu suffit
  Et Hypothèses accepte un champ « Vos revenus nets » vide
```

### US-5 : Tranche supposée (web)

En tant que Camille, je veux savoir que les impôts affichés supposent une tranche à 30 % et pouvoir la changer là où je la lis.

Priorité : P0 · Effort : S

```gherkin
Scénario: Fiscalité avec tranche estimée
  Étant donné un projet dont la provenance de fiscalite.tmi vaut « estime »
  Quand j'ouvre Fiscalité
  Alors le chapo dit « Les quatre régimes avec une tranche supposée à 30 %, projetés sur 10 ans. »
  Et un encart « Votre tranche d'imposition » propose le choix (0, 11, 30, 41, 45 %) en ligne
  Quand je choisis 41 %
  Alors le projet est enregistré avec tmi 0,41 (provenance « utilisateur »), les impôts se recalculent et le chapo dit « avec votre tranche à 41 % »

Scénario: Rapport
  Étant donné le même projet
  Alors la carte « Combien d'impôts ? » ajoute « tranche supposée à 30 % » après le régime

Scénario: tranche choisie
  Étant donné un projet dont la tranche vient de l'utilisateur (projets existants, exemple)
  Alors rien ne change dans Fiscalité ni dans le Rapport (parcours e2e existants verts)
```

### US-6 : Méthode, e2e, formats

Priorité : P0 · Effort : M

```gherkin
Scénario: Méthode
  Quand j'ouvre « Comment c'est calculé »
  Alors la section « Valeurs par défaut » liste l'apport (0 €), la durée du prêt (25 ans, taux du mois), la tranche d'imposition (30 %, avec sa justification) et le loyer visé (loyers de marché ANIL de la commune, moins 8 % de charges, plus la prime meublé)
  Et la section « Verdict » dit ce qui est calculé sans loyer (prix, financement, estimation, risques) et sans revenus (effort)

Scénario: e2e, saisie minimale
  Étant donné creerProjetManuel qui ne remplit plus que prix, surface, code postal, ville et loyer
  Alors le rapport de Lyon s'ouvre avec les valeurs recalculées (apport 0 €, effort « revenus à indiquer ») et les parcours Mes projets, persistance et téléphone restent verts

Scénario: e2e, sans loyer
  Quand je crée un projet avec prix, surface, code postal et ville seulement
  Alors le rapport affiche « Le loyer reste à indiquer. », le bandeau, et « Cash-flow : loyer à indiquer »
  Quand je saisis 700 dans le bandeau
  Alors « Cash-flow −… €/mois » apparaît et le bandeau disparaît
  Quand je recharge la page
  Alors le loyer est conservé

Scénario: formats
  Alors l'écran « Rapport à compléter » (projet sans loyer) est ajouté à ecransDeReference et mesuré sur les neuf formats
```

### US-7 : Documentation

`.product/architecture/hypotheses-optionnelles.md` (tenue à jour pendant l'implémentation), `features-registry.md`, `functional-spec.md` (parcours Vérifier, résultats partiels), `technical-spec.md`, `architecture-overview.md`, README (structure, nombre de tests), CLAUDE.md (statut du repo), fiche 02 et tableau de `.product/backlog/README.md` au statut « livrée ».

## Contrats de textes (codes → phrases, `apps/web/src/textes/manques.ts`)

| Code              | Titre du bandeau                                | Phrase                                                                                                                           | Champ en ligne                | Libellé de feu inconnu                   |
| ----------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------- |
| `LOYER_ABSENT`    | Il manque le loyer visé pour cette analyse      | Cash-flow, impôts, revente et rendement se calculent à partir du loyer. Indiquez-le, ou prenez le loyer de marché de la commune. | `hypotheses.location.loyerHc` | « … : loyer à indiquer »                 |
| `REVENUS_ABSENTS` | (pas de bandeau : seul le feu effort en dépend) | Indiquez vos revenus nets pour vérifier l'effort bancaire (mensualité ÷ revenus + 70 % des loyers).                              | `hypotheses.revenusMensuels`  | « Effort bancaire : revenus à indiquer » |

## Hors périmètre rappelé

Onglet Financement et feu effort par la couverture (fiche 01), curseur de négociation (04), régime « meilleur des quatre » (refusé, voir discovery), Worker, comptes.
