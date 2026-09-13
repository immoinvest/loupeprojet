# Specs : Moteur de calcul Loupe (`packages/moteur`)

Discovery validée : `../features/moteur-calcul-discovery.md`. Décisions de Pierre : différé de prêt conservé, projet d'exemple inventé (crédible), ancien simulateur supprimé en fin de feature.

## Epics

- **E1 — Socle** : monorepo, outillage, schémas, règles datées, utilitaires numériques.
- **E2 — Calculs** : financement, cash-flow, fiscalité, revente, rendement/TRI.
- **E3 — Lecture** : verdict, scénarios, API `calculerProjet`, projet d'exemple, nettoyage.

Persona des stories : **Camille** (utilisatrice finale, via les futurs écrans) ou **le développeur de `apps/web`** (consommateur direct du moteur).

---

## E1 — Socle

### US-0 : Monorepo et outillage

En tant que développeur, je veux un monorepo npm workspaces avec lint, typecheck, tests et CI, afin que chaque commit soit vérifié automatiquement.
Priorité P0 · Effort S

```gherkin
Scenario: Commandes racine
  Given le dépôt cloné et `npm install` exécuté
  When je lance `npm run lint && npm run typecheck && npm run test`
  Then les trois commandes réussissent avec 0 erreur et 0 warning

Scenario: Fichiers générés hors Git
  Given `.gitignore` en place
  When je lance `git ls-files node_modules dist`
  Then aucun fichier n'est listé

Scenario: CI sur pull request
  Given une PR ouverte vers master
  When GitHub Actions s'exécute
  Then lint, typecheck, test et build passent sur Node 22
```

### US-1 : Schémas, règles datées, utilitaires

En tant que développeur, je veux des schémas Zod `Projet` / `Resultats` et un fichier de règles `2026-09`, afin que toute entrée soit validée et que toute constante datée soit isolée.
Priorité P0 · Effort M

```gherkin
Scenario: Projet valide
  Given le projet d'exemple T3 Marseille
  When je le passe à `ProjetSchema.parse`
  Then il est accepté et les valeurs par défaut (vacance 3 semaines, entretien 0,5 %, PS BIC 18,6 %) sont appliquées

Scenario: Projet invalide
  Given un projet avec un prix négatif ou une durée de 0 an
  When je le passe à `ProjetSchema.safeParse`
  Then le résultat est un échec avec le chemin du champ fautif

Scenario: Règle à confirmer
  Given les règles `2026-09`
  When je lis `prelevementsSociaux.bic`
  Then la valeur est 0,186 et `aConfirmer` vaut true

Scenario: Version de règles inconnue
  Given un projet avec `versionRegles: "2031-01"`
  When j'appelle `obtenirRegles`
  Then une `ErreurVersionRegles` est levée

Scenario: Résolution numérique bornée
  Given une fonction continue changeant de signe sur [a, b]
  When j'appelle `resoudreParBissection`
  Then la racine est trouvée à 1e-9 près en moins de 200 itérations
  And si la fonction ne change pas de signe, une `ErreurResolution` est levée
```

---

## E2 — Calculs

### US-2 : Financement

En tant que Camille, je veux connaître mes frais d'acquisition réels, ma mensualité, mon TAEG, mon taux d'effort et le tableau d'amortissement (différé compris), afin de savoir ce que la banque me demandera.
Priorité P0 · Effort L

```gherkin
Scenario: Frais d'acquisition calculés (référence vérifiée à la main)
  Given prix FAI 155 000 €, honoraires 7 000 € à charge acquéreur, département 13
  When je calcule les frais d'acquisition
  Then droits = 9 351 €, émoluments TTC = 1 896 €, CSI = 148 €, débours = 592 €, total = 11 987 € (± 1 €)

Scenario: Mensualité et assurance
  Given emprunt 161 000 €, 3,35 %, 25 ans, assurance 0,25 % du capital initial
  When je calcule la mensualité
  Then hors assurance = 793,1 € et assurance = 33,5 € (± 0,1 €)

Scenario: Différé total puis partiel
  Given un prêt de 100 000 € sur 20 ans avec 12 mois de différé total et 12 mois de différé partiel
  When je génère le tableau d'amortissement
  Then les 12 premières lignes ont capital 0 et mensualité 0 avec intérêts capitalisés
  And les 12 suivantes ont capital 0 et mensualité = intérêts
  And le CRD de la dernière ligne vaut 0 (± 0,01 €)

Scenario: TAEG avec frais
  Given emprunt 161 000 €, mensualité 793,1 €, assurance 33,5 €, frais dossier 850 €, garantie 1 500 €, 300 mois
  When je résous le TAEG
  Then il est compris entre 3,9 % et 4,2 % et strictement supérieur au taux nominal

Scenario: Taux d'effort HCSF, deux lectures
  Given mensualité assurance comprise 827 €, revenus 2 600 €, loyer 980 €
  When je calcule l'effort
  Then HCSF (loyers à 70 %) = 25,2 % et « sans loyers » = 31,8 % (± 0,1 pt)

Scenario: IRA
  Given CRD 112 100 € et taux 3,35 %
  When je calcule l'IRA
  Then elle vaut min(6 mois d'intérêts = 1 878 €, 3 % = 3 363 €) = 1 878 €
```

### US-3 : Cash-flow

En tant que Camille, je veux mon cash-flow mensuel charges pleines, mon effort d'épargne, mon point mort et mon taux de couverture, afin de savoir si ça s'autofinance.
Priorité P0 · Effort M

```gherkin
Scenario: Meublé longue durée avec vacance
  Given loyer HC 980 €, vacance 3 semaines, crédit 827 €/mois, TF 1 050 €/an, copro 1 080 €/an, PNO 180, comptable 420, CFE 180, entretien 0,5 % de 155 000 €
  When je calcule le cash-flow
  Then le cash-flow mensuel hors vacance ≈ −140 € et avec vacance ≈ −196 € (± 2 €)
  And l'effort d'épargne = |cash-flow| et le taux de couverture = 827 / 980 = 84 %

Scenario: Point mort
  Given le même projet
  When je calcule le loyer d'équilibre
  Then le cash-flow recalculé avec ce loyer vaut 0 (± 0,5 €)

Scenario: Courte durée
  Given nuitée 75 €, occupation 60 %, ménage 15 €/nuit, conciergerie 20 %
  When je calcule les recettes annuelles
  Then recettes = 75 × 365 × 0,6 = 16 425 € moins ménage 3 285 € moins conciergerie 3 285 € = 9 855 €

Scenario: Loyer nul
  Given loyer HC 0 €
  When je calcule le cash-flow
  Then le taux de couverture est `null` (pas de division par zéro) et le cash-flow est négatif
```

### US-4 : Fiscalité, quatre régimes projetés

En tant que Camille, je veux comparer micro-BIC, LMNP réel, micro-foncier et nu réel année par année, afin de choisir mon régime et savoir quand je commence à payer.
Priorité P0 · Effort XL

```gherkin
Scenario: Micro-BIC
  Given recettes 11 760 €/an, TMI 30 %, PS BIC 18,6 %
  When je calcule l'impôt
  Then base = 5 880 € et impôt = 5 880 × 0,486 = 2 858 € chaque année
  And si les recettes dépassent 83 600 €, `eligible` vaut false

Scenario: LMNP réel, art. 39 C
  Given un résultat avant amortissement de +2 000 € et 6 000 € d'amortissements disponibles
  When je calcule l'année
  Then 2 000 € d'amortissement sont déduits, 4 000 € sont reportés sans limite, l'impôt vaut 0
  And si le résultat avant amortissement est −5 000 €, le déficit de 5 000 € est reportable 10 ans et les 6 000 € d'amortissement entièrement reportés

Scenario: Première année imposable
  Given un projet LMNP réel avec déficit initial et amortissements
  When je projette 10 ans
  Then `premiereAnneeImposable` est l'index de la première année où impôt > 0, ou null si aucune

Scenario: Nu réel, déficit foncier
  Given loyers 10 200 €, charges hors intérêts 9 000 €, intérêts 5 300 €, TMI 30 %
  When je calcule l'année
  Then le déficit hors intérêts (−3 800 € plafonné à 10 700 €) génère une économie d'impôt de 1 140 € (TMI seul, pas de PS)
  And la part intérêts non imputée est reportée 10 ans sur les revenus fonciers

Scenario: Micro-foncier
  Given loyers 10 200 €, TMI 30 %
  When je calcule
  Then base = 7 140 €, impôt = 7 140 × 0,472 = 3 370 € ; au-delà de 15 000 € de loyers, `eligible` vaut false

Scenario: Meilleur régime
  Given les quatre régimes calculés sur la durée de détention
  When je demande le meilleur
  Then c'est le régime éligible dont l'impôt cumulé est le plus faible
```

### US-5 : Revente et plus-value

En tant que Camille, je veux savoir ce qu'il me restera en poche à la revente, impôt sur la plus-value compris, afin de juger l'opération sur toute sa durée.
Priorité P0 · Effort L

```gherkin
Scenario: Cash net vendeur
  Given prix 155 000 €, +1,5 %/an, 10 ans, agence 4 %, diagnostics 500 €, CRD 112 100 €, IRA 1 878 €, impôt PV 12 540 €
  When je calcule
  Then valeur = 179 887 €, frais = 7 695 €, cash net = 179 887 − 7 695 − 112 100 − 1 878 − 12 540 = 45 674 €

Scenario: Abattements par durée
  Given une plus-value brute de 30 000 € détenue 8 ans
  When j'applique les abattements
  Then IR : 3 années × 6 % = 18 % ; PS : 3 × 1,65 % = 4,95 %
  And à 22 ans l'IR est exonéré, à 30 ans les PS aussi

Scenario: Réintégration LMNP réel (LF 2025)
  Given 43 900 € d'amortissements de l'immeuble déduits et 5 000 € de mobilier amortis
  When je calcule la plus-value imposable en LMNP réel
  Then seuls les 43 900 € réduisent le prix d'acquisition majoré ; le mobilier est ignoré
  And en micro-BIC ou en nu, aucune réintégration

Scenario: Forfaits
  Given détention ≥ 5 ans, frais réels 11 987 € (< 7,5 % = 11 625 € ? non : 7,5 % de 155 000 = 11 625) et travaux réels 6 000 € (< forfait 15 % = 23 250 €)
  When je calcule le prix d'acquisition majoré
  Then les frais réels (11 987 €) sont retenus car supérieurs au forfait, et le forfait travaux (23 250 €) car supérieur au réel

Scenario: Plus-value négative
  Given une valeur de revente inférieure au prix majoré
  When je calcule l'impôt
  Then il vaut 0 et la surtaxe vaut 0
```

### US-6 : Rendement, TRI, enrichissement

En tant que Camille, je veux mes rendements brut / net / net-net, mon TRI réel et mon enrichissement, afin de comparer ce projet à un livret ou à un autre bien.
Priorité P0 · Effort M

```gherkin
Scenario: Rendements
  Given loyers HC 11 760 €/an, charges pleines 3 900 €, coût total (prix + travaux + frais) 172 987 €
  When je calcule
  Then brut = 6,80 %, net = 4,54 % (± 0,02 pt)

Scenario: TRI réel
  Given flux : −19 337 € en année 0, −2 350 € par an pendant 9 ans, +43 324 € (−2 350 + 45 674) en année 10
  When je résous le TRI
  Then il est compris entre 0 % et 3 % et la VAN à ce taux vaut 0 (± 1 €)

Scenario: TRI sans solution
  Given tous les flux négatifs
  When je résous le TRI
  Then le résultat est `null` (pas d'exception)

Scenario: Enrichissement cohérent
  Given un projet complet
  When je calcule l'enrichissement
  Then enrichissement = capital remboursé + plus-value nette + cash-flows cumulés
  And = cash net vendeur + cash-flows cumulés − mise de départ (les deux décompositions coïncident à 1 € près)
```

---

## E3 — Lecture

### US-7 : Verdict à cinq feux et points de vigilance

En tant que Camille, je veux cinq feux lisibles et une liste de points à vérifier en visite, afin de décider sans note magique.
Priorité P0 · Effort S

```gherkin
Scenario: Cinq feux
  Given prix/m² 22 % sous la médiane DVF, net 4,8 %, cash-flow −196 €, effort 25 %, DPE D sans procédure ni risque fort
  When je calcule le verdict
  Then prix = bon, rendement = à surveiller, cash-flow = problème, effort = bon, risques = bon

Scenario: Sans données de marché
  Given aucun DVF disponible
  When je calcule le feu prix
  Then il vaut `inconnu` et le verdict reste calculable

Scenario: Points de vigilance par règles
  Given copro de 24 lots construite en 1962, DPE D, prix 22 % sous marché
  When je liste les points de vigilance
  Then les codes `PV_AG_ET_CARNET`, `VERIFIER_DPE`, `EXPLIQUER_PRIX_SOUS_MARCHE`, `CONFIRMER_TAXE_FONCIERE` sont présents, sans phrase rédigée
```

### US-8 : Scénarios et prix cibles

En tant que Camille, je veux tester « et si » (négocier, colocation, 20 ans, taux +0,5, nu, vacance 2 mois) et connaître le prix auquel ça marche, afin d'avoir un argument de négociation.
Priorité P1 · Effort M

```gherkin
Scenario: Prix cible pour cash-flow nul
  Given le projet d'exemple (cash-flow négatif)
  When je résous le prix pour un cash-flow de 0
  Then le projet recalculé à ce prix a un cash-flow de 0 (± 1 €) et le prix est inférieur au prix affiché

Scenario: Scénario prédéfini
  Given le projet d'exemple
  When j'applique « prêt sur 20 ans »
  Then la durée vaut 20, la mensualité augmente, et le delta de cash-flow est négatif

Scenario: Prix cible impossible
  Given un projet dont le cash-flow reste négatif même à prix 0
  When je résous le prix cible
  Then le résultat est `null`
```

### US-9 : `calculerProjet`, projet d'exemple, intégration

En tant que développeur de `apps/web`, je veux une fonction unique `calculerProjet(projet)` et un projet d'exemple, afin d'afficher un rapport complet dès le premier écran.
Priorité P0 · Effort M

```gherkin
Scenario: Résultats complets
  Given le projet d'exemple T3 65 m² Marseille 5e
  When j'appelle `calculerProjet`
  Then `Resultats` contient financement, cashflow, fiscalite (4 régimes + meilleur), revente, rendement, verdict, scenarios, et `ResultatsSchema.parse` l'accepte

Scenario: Pureté
  Given deux appels successifs avec le même projet
  When je compare les résultats
  Then ils sont strictement égaux (deepEqual), et le projet d'entrée n'a pas été muté

Scenario: Performance
  Given le projet d'exemple
  When je mesure 100 appels
  Then la moyenne est < 50 ms par appel
```

### US-10 : Suppression de l'ancien simulateur et documentation

En tant que développeur, je veux un dépôt propre (ancien simulateur retiré, README à jour), afin que la prochaine session parte d'une base saine.
Priorité P1 · Effort XS

```gherkin
Scenario: Nettoyage
  Given le moteur porté et testé
  When je supprime src/, webpack.config.js, dist/ et l'ancien package.json racine
  Then `npm run build` du monorepo passe toujours

Scenario: Documentation
  When la feature est terminée
  Then README.md, CLAUDE.md, features-registry.md, technical-spec.md, architecture-overview.md reflètent le moteur
```

---

## Contrats (API publique de `@loupe/moteur`)

```ts
calculerProjet(projet: Projet): Resultats
ProjetSchema, ResultatsSchema, HypothesesSchema            // Zod
obtenirRegles(version: VersionRegles): Regles
appliquerScenario(projet: Projet, scenario: Scenario): { projet: Projet; resultats: Resultats; deltas: Deltas }
prixCible(projet: Projet, critere: CriterePrix): number | null
projetExemple: Projet                                      // T3 Marseille
// + fonctions unitaires exportées par module (fraisAcquisition, calculerMensualite, tableauAmortissement, taeg, ...)
```

## Modèle de données (résumé, détail dans l'architecture)

`Projet = { id, versionRegles, bien, marche, hypotheses, provenance }` · `Resultats = { financement, cashflow, fiscalite, revente, rendement, verdict, scenarios, meta: { versionRegles, aConfirmer[] } }`. Résultats jamais persistés.

## MoSCoW

| Story                         | Priorité | Effort | Dépend de  |
| ----------------------------- | -------- | ------ | ---------- |
| US-0 Monorepo                 | Must     | S      | —          |
| US-1 Schémas + règles         | Must     | M      | US-0       |
| US-2 Financement              | Must     | L      | US-1       |
| US-3 Cash-flow                | Must     | M      | US-2       |
| US-4 Fiscalité                | Must     | XL     | US-3       |
| US-5 Revente                  | Must     | L      | US-2, US-4 |
| US-6 Rendement/TRI            | Must     | M      | US-3, US-5 |
| US-7 Verdict                  | Must     | S      | US-6       |
| US-8 Scénarios                | Should   | M      | US-7       |
| US-9 calculerProjet + exemple | Must     | M      | US-7       |
| US-10 Nettoyage + docs        | Should   | XS     | US-9       |

Total : 11 stories, ~4–5 jours équivalents. P0 : 8 stories.

## Auto-validation critique (checkpoint specs)

- **Risque vu** : US-4 (fiscalité) est XL et concentre l'incertitude réglementaire. Décision : la scinder en deux commits (régimes meublés, puis régimes nus) et paramétrer chaque taux dans `regles/`.
- **Risque vu** : les chiffres « attendus » des Gherkin viennent de la maquette (illustratifs). Décision : les scénarios de référence sont recalculés à la main dans les tests (formules montrées en commentaire) ; les valeurs de la maquette ne servent que d'ordre de grandeur.
- **Simplification assumée** : net-net et rendement net calculés sur l'année 1 ; surtaxe PV sans lissage ; recettes BIC = loyers HC (charges refacturées ignorées). Documenté dans les résultats via `meta.simplifications[]`.
- **Écarté** : comparaison de deux prêts (hors spec), SCI IS, encadrement des loyers par ville (le moteur reçoit un plafond, il ne connaît pas les villes).
