# Architecture : Moteur de calcul (`packages/moteur`)

Specs : `../specs/moteur-calcul-specs.md`. Stack : ADR-001.

## 1. Existant

Aucun code réutilisable en place (monorepo à créer). Repris de [src/calculPret.ts](../../src/calculPret.ts) : formule PMT, logique des différés (capitalisation en différé total, intérêts seuls en différé partiel), regroupement par périodes. Jeté : TAEG par pas fixe, dates système, types `BienData/PretData`, comparaison de prêts.

## 2. Fichiers

### Racine (US-0)

```
package.json                 workspaces ["packages/*","apps/*"], scripts lint/typecheck/test/test:coverage/build/format
tsconfig.base.json           strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, ES2022, bundler resolution
eslint.config.js             typescript-eslint strict-type-checked + stylistic, prettier compat
.prettierrc                  printWidth 100, singleQuote, semi
vitest.workspace.ts          projets = packages/*, apps/*
.github/workflows/ci.yml     Node 22 : npm ci → lint → typecheck → test:coverage → build
README.md                    (réécrit en US-10)
```

### `packages/moteur`

```
package.json                 name @loupe/moteur, type module, exports ./src/index.ts, deps: zod ; dev: vitest, @vitest/coverage-v8
tsconfig.json                extends base, include src tests
vitest.config.ts             coverage v8, thresholds 100/100/100/100 sur src/**

src/index.ts                 API publique (ré-exports)
src/calculer-projet.ts       orchestrateur : Projet → Resultats

src/schema/
  bien.ts                    BienSchema (type, surface, pieces, etage?, ascenseur?, annee?, dpe?, ges?, departement, copro?)
  marche.ts                  MarcheSchema (dvf?, loyerReferenceM2?, plafondLoyer?, risques[])
  hypotheses.ts              HypothesesSchema : achat, pret (avec differeTotalMois, differePartielMois), location (mode, loyerHc, loyerHcNu?, vacanceSemaines, courteDuree?), charges, fiscalite (tmi, psBic, psFoncier, regime), revente, revenusMensuels
  projet.ts                  ProjetSchema (id, versionRegles, bien, marche, hypotheses, provenance)
  resultats.ts               ResultatsSchema + sous-schémas (Financement, Cashflow, Fiscalite, Revente, Rendement, Verdict, Scenarios, Meta)
  index.ts

src/regles/
  types.ts                   interface Regles (toutes les constantes datées, avec `aConfirmer` où besoin)
  2026-09.ts                 valeurs : DMTO (5 %, liste 4,5 %), taxe communale, frais d'assiette, tranches émoluments, TVA, CSI, débours, taux moyens, usure, HCSF, IRA, PS, abattements micro, plafonds, amortissements (part terrain, composants), déficit foncier, abattements PV, taux PV, surtaxe, seuils verdict, défauts (vacance, entretien, prime meublé, diagnostics)
  index.ts                   obtenirRegles(version) ; ErreurVersionRegles

src/commun/
  arrondi.ts                 arrondir(n, decimales), arrondirEuro, arrondirCentime, pourcentage
  resolution.ts              resoudreParBissection(f, a, b, options) ; ErreurResolution
  erreurs.ts                 ErreurMoteur (base), ErreurHypotheseInvalide
  flux.ts                    van(flux, taux), sommer

src/financement/
  frais-acquisition.ts       fraisAcquisition(prix, honoraires, departement, regles) → détail
  mensualite.ts              calculerMensualite(capital, taux, mois), assuranceMensuelle
  amortissement.ts           tableauAmortissement(capital, taux, mois, differeTotal, differePartiel) → lignes ; regrouperParAnnee ; crdFinAnnee
  taeg.ts                    taeg(capital, fraisFixes, mensualites[], ...) par bissection
  effort.ts                  tauxEffort(mensualite, revenus, loyer, regles) → { hcsf, sansLoyers, seuil, depasse }
  ira.ts                     ira(crd, taux, regles)
  index.ts                   calculerFinancement(projet, regles) → ResultatFinancement

src/cashflow/
  recettes.ts                recettesAnnuelles(location, regles) → { loyersHcBruts, vacance, netsDeVacance, detail courte durée }
  charges.ts                 chargesExploitation(hyp, regles) → lignes nommées (tf, copro, pno, comptable, cfe, gestion, entretien)
  index.ts                   calculerCashflow(projet, financement, regles) → { annuel[], mensuel, mensuelHorsVacance, effortEpargne, pointMort, tauxCouverture }

src/fiscalite/
  types.ts                   AnneeFiscale, ResultatRegime, Regime enum
  amortissements.ts          planAmortissements(prix, travaux, mobilier, regles) → dotations annuelles par composant
  deficits.ts                StockDeficits (report 10 ans FIFO), StockAmortissements (illimité)
  micro-bic.ts               projeterMicroBic(recettes[], regles, tmi)
  lmnp-reel.ts               projeterLmnpReel(recettes[], charges[], interets[], amortissements, regles, tmi)
  micro-foncier.ts           projeterMicroFoncier(loyers[], regles, tmi)
  nu-reel.ts                 projeterNuReel(loyers[], charges[], interets[], travaux, regles, tmi)
  index.ts                   calculerFiscalite(projet, financement, cashflow, regles) → { regimes: 4, meilleur, retenu }

src/revente/
  valeur.ts                  valeurRevente(prix, evolution, annees), fraisVente
  plus-value.ts              plusValueImposable(..., reintegration), abattements(annees, regles), impotPlusValue(...) avec surtaxe
  index.ts                   calculerRevente(projet, financement, fiscalite, regles)

src/rendement/
  rendements.ts              brut, net, netNet
  tri.ts                     tri(flux[]) → number | null (bissection sur VAN)
  enrichissement.ts          enrichissement(...) deux décompositions
  index.ts                   calculerRendement(projet, financement, cashflow, fiscalite, revente, regles)

src/verdict/
  feux.ts                    feuPrix, feuRendement, feuCashflow, feuEffort, feuRisques (seuils depuis regles)
  vigilance.ts               pointsDeVigilance(projet, resultats) → codes[]
  index.ts                   calculerVerdict(...)

src/scenarios/
  predefinis.ts              scenarios : negocier, colocation, duree20, tauxPlus050, nu, vacance2Mois (transformations d'Hypotheses)
  prix-cible.ts              prixCible(projet, critere) par bissection sur calculerProjet
  index.ts                   appliquerScenario, calculerScenarios

src/exemples/
  t3-marseille.ts            projetExemple (T3 65 m², Marseille 5e, 155 000 € FAI, chiffres inventés crédibles)

tests/
  commun/*.test.ts  financement/*.test.ts  cashflow/*.test.ts  fiscalite/*.test.ts  revente/*.test.ts
  rendement/*.test.ts  verdict/*.test.ts  scenarios/*.test.ts  schema/*.test.ts  regles/*.test.ts
  integration/calculer-projet.test.ts     (US-9 : complet, pureté, perf)
```

Aucun fichier prévu > 300 lignes (les plus gros : `2026-09.ts` ~200, `hypotheses.ts` ~150, `lmnp-reel.ts` ~150).

## 3. Patterns

- **Fonctions pures + orchestrateur** : chaque module expose `calculerX(entrées, regles)`. `calculer-projet.ts` enchaîne les modules dans l'ordre des dépendances et assemble `Resultats`. Pas de classe, pas d'état partagé.
- **Strategy** pour les régimes fiscaux : quatre fonctions `projeterX` de même signature `(contexte: ContexteFiscal, regles) → ResultatRegime`, sélectionnées par une table `{ [Regime]: fn }`.
- **Strategy** pour les modes de location : `recettesAnnuelles` délègue à `recettesLongueDuree` / `recettesCourteDuree`.
- **Value objects par Zod** : types inférés (`z.infer`), valeurs par défaut dans les schémas (vacance, entretien, PS) pour respecter « jamais de case vide ».
- **Règles injectées** : `regles` est toujours un paramètre, jamais un import direct dans les modules de calcul → testable avec des règles modifiées, versionnable.
- **Résolution numérique unique** : `resoudreParBissection` sert au TAEG, au TRI, au point mort et au prix cible.
- **Erreurs nommées** : `ErreurMoteur` → `ErreurHypotheseInvalide`, `ErreurVersionRegles`, `ErreurResolution`. Les cas « pas de solution » légitimes (TRI, prix cible) retournent `null`, pas une exception.
- **Codes, pas de phrases** : verdict et vigilance retournent des enums ; les textes sont dans l'UI.

## 4. Flux de données

```
Projet (Zod parse, défauts appliqués)
  → obtenirRegles(versionRegles)
  → calculerFinancement          : frais acq., emprunt, mensualité, tableau (différés), TAEG, effort, IRA à N
  → calculerCashflow             : recettes (mode), charges, crédit par année → cash-flow avant impôt par année
  → calculerFiscalite            : 4 régimes projetés sur N années (chacun avec son loyer et ses charges), meilleur, retenu
  → calculerRevente              : valeur, frais, CRD, IRA, PV (réintégration si LMNP réel retenu), cash net
  → calculerRendement            : brut/net/net-net, flux annuels après impôt (régime retenu), TRI, enrichissement
  → calculerVerdict              : 5 feux + codes de vigilance
  → calculerScenarios            : 6 scénarios (recalcul complet sans scénarios imbriqués) + 3 prix cibles
  → Resultats (Zod parse de sortie en mode test uniquement)
```

Conventions : montants en euros `number`, arrondis uniquement dans l'assemblage final (`arrondirEuro` pour les montants, 4 décimales pour les taux) ; taux en décimal ; `dureeMois` / `annees` explicites ; année 1 = première année pleine de détention.

## 5. ADR locaux

**ADR-M1 — Emprunt et mise de départ.** `emprunt = prix + travaux + fraisAcquisition + fraisDossier + garantie − apport` ; `miseDeDepart = apport + mobilier` (le mobilier n'est pas financé). Reproduit la maquette (161 000 € / 19 337 €). Alternative écartée : financer le mobilier (rare en pratique).

**ADR-M2 — Cash-flow « headline » avec vacance.** La spec (« net calculé charges pleines ») prime sur la maquette (−134 € hors vacance). On expose les deux : `mensuel` (avec vacance, utilisé par le verdict) et `mensuelHorsVacance`.

**ADR-M3 — Quatre régimes, deux loyers.** Les régimes meublés utilisent `loyerHc` ; les régimes nus utilisent `loyerHcNu` (hypothèse, défaut = `loyerHc / (1 + primeMeuble 15 %)`). Comptable et CFE ne s'appliquent qu'aux régimes meublés (réel pour le comptable). Chaque régime a donc son propre cash-flow après impôt ; le régime « retenu » (`hypotheses.fiscalite.regime`) alimente revente, TRI et verdict.

**ADR-M4 — Amortissement par composants simplifié.** Base = prix hors honoraires × (1 − part terrain 15 %). Gros œuvre 55 % / 50 ans, second œuvre 45 % / 20 ans, travaux / 10 ans, mobilier / 7 ans. Frais d'acquisition passés en charge l'année 1 (option la plus favorable, cohérente avec la spec). Paramètres dans `regles`, marqués « simplification ».

**ADR-M5 — Réintégration PV (LF 2025).** En LMNP réel retenu, les dotations **effectivement déduites** sur bâti et travaux réduisent le prix d'acquisition majoré ; le mobilier et le stock non déduit (39 C) ne sont pas réintégrés.

**ADR-M6 — Différé.** Différé total : intérêts capitalisés, aucune mensualité, assurance due. Différé partiel : intérêts seuls. Mensualité de la période normale recalculée sur le capital après capitalisation et la durée restante (repris de l'existant). Les années de différé apparaissent dans le cash-flow annuel (crédit plus faible) et la fiscalité (intérêts déductibles quand payés ; capitalisés = non déduits, simplification notée).

**ADR-M7 — Scénarios non imbriqués.** `calculerProjet` calcule les scénarios avec une option interne `{ avecScenarios: false }` pour éviter la récursion.

## 6. Ordre d'implémentation (un commit par étape)

1. US-0 racine + CI + untrack node_modules/dist
2. US-1 schema/ + regles/ + commun/ (+ tests)
3. US-2 financement/
4. US-3 cashflow/
5. US-4a fiscalite/ : types, amortissements, deficits, micro-bic, lmnp-reel
6. US-4b fiscalite/ : micro-foncier, nu-reel, index (meilleur régime)
7. US-5 revente/
8. US-6 rendement/
9. US-7 verdict/
10. US-9 calculer-projet + exemple + tests d'intégration (avant US-8 : les scénarios s'appuient sur calculerProjet)
11. US-8 scenarios/
12. US-10 suppression ancien simulateur, README, docs, PR

## 7. Cas limites par module

- financement : apport ≥ coût total (emprunt 0 → mensualité 0, TAEG null), taux 0 (PMT = capital/mois), différé ≥ durée (erreur), département inconnu (DMTO 5 % par défaut).
- cashflow : loyer 0, vacance 52 semaines, occupation 0 % en courte durée, gestion 100 %.
- fiscalité : recettes > plafond micro, TMI 0, déficit qui expire après 10 ans, amortissements épuisés avant N, N = 1.
- revente : détention < 5 ans (pas de forfait travaux), > 22 ans (IR exonéré), > 30 ans (PS exonérés), PV négative, valeur < CRD (cash net négatif).
- rendement : coût total 0 (impossible via schéma), TRI sans solution, flux tous nuls.
- verdict : DVF absent, DPE absent, surface 0 (impossible via schéma).
- scénarios : prix cible impossible, colocation avec 0 chambre (schéma).

## 8. Checklist pré-implémentation

- [x] Pas de conflit avec l'existant (repo vide côté monorepo)
- [x] Patterns cohérents (pures + orchestrateur, Strategy, règles injectées)
- [x] Aucune migration (pas de BDD)
- [x] Entrées validées par Zod à l'entrée de `calculerProjet`
- [x] Chaque module ≤ 7 fonctions publiques
- [x] Aucun nom en « et » ; fichiers < 300 lignes prévus
- [x] Cas limites listés

## Auto-validation critique (checkpoint architecture)

- **Point faible identifié** : `prixCible` appelle `calculerProjet` dans une bissection (≈ 40 itérations × calcul complet). Acceptable (< 50 ms par calcul visé → < 2 s pire cas), mais on désactive scénarios et prix cibles dans les appels imbriqués (ADR-M7) et on mesure en US-9.
- **Point faible identifié** : la fiscalité en différé total (intérêts capitalisés non déduits) est une simplification ; signalée dans `meta.simplifications`.
- **Changement suite à la revue** : US-9 (`calculerProjet`) passe avant US-8 (scénarios) dans l'ordre d'implémentation, car les scénarios dépendent de l'orchestrateur.
