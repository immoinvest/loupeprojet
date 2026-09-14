# Architecture — location-types

Specs : `.product/specs/location-types-specs.md`. Rédigée le 14/09/2026 ; mise à jour au fil des deux PR.

## 1. Vue d'ensemble

Le type d'exploitation devient le **discriminant** du bloc `hypotheses.location`. Tout ce qui dépend du type (recettes, charges propres, régimes possibles, scénarios, vigilance, champs affichés, défauts) se lit dans une seule variante typée ; le reste du moteur ne connaît que `Recettes` et `LigneCharge[]`.

```
hypotheses.location (union par mode)
   │
   ├─ location/            equivalents.ts   loyerMensuelHc, loyerMensuelReference, estModeMeuble
   │                        defauts.ts       defautsPourMode(mode, regles, contexte)
   │                        regimes.ts       regimesCompatibles(mode)
   ├─ cashflow/recettes.ts  recettesAnnuelles(location) → Recettes { bruts, récupérées, vacance, nets, nuitées, séjours }
   ├─ cashflow/charges.ts   chargesExploitation(hypotheses, regime, recettes) → lignes (+ plateforme, conciergerie, ménage, énergie, internet)
   ├─ fiscalite/index.ts    locationPourRegime → Location ; compatibles ; meilleur parmi les compatibles
   ├─ scenarios/predefinis  transformations → Variante | null
   ├─ verdict/vigilance.ts  pointsLocation(projet, regles)
   └─ schema/migration.ts   migrerProjet(brut) : ancien format → nouveau
```

## 2. Moteur (PR 1)

### 2.1 `schema/hypotheses.ts`

```ts
ModeLocationSchema = z.enum(['nu', 'meuble', 'colocation', 'courte_duree', 'moyenne_duree'])

LocationNueSchema         { mode:'nu', loyerHc, chargesLocataire=0, vacanceSemaines=3, gestionTaux=0 }
LocationMeubleeSchema     { mode:'meuble', loyerHc, loyerHcNu?, chargesLocataire=0, vacanceSemaines=3, gestionTaux=0 }
LocationColocationSchema  { mode:'colocation', chambres (1..20), loyerChambre, forfaitChargesChambre=0, vacanceSemaines=4, gestionTaux=0 }
LocationCourteDureeSchema { mode:'courte_duree', nuitee>0, nuiteesParMois (0..31), dureeSejourNuits=4 (1..31),
                            menageFactureParSejour=0, menageCoutParSejour=0, plateformeTaux=0, conciergerieTaux=0, tourismeClasse=false }
LocationMoyenneDureeSchema{ mode:'moyenne_duree', loyerHc, forfaitCharges=0, dureeSejourMois=4 (1..10), vacanceSemaines=4,
                            menageCoutParSejour=0, plateformeTaux=0, gestionTaux=0 }
LocationSchema = z.discriminatedUnion('mode', [...])
ChargesSchema += energieMensuel=0, internetMensuel=0
HypothesesSchema.refine(régime ∈ regimesCompatibles(mode), path fiscalite.regime)
```

Les défauts du schéma (3, 4, 4, 4 semaines ; 4 nuits ; 4 mois) sont dupliqués dans `regles.exploitation.parType` ; un test vérifie l'égalité.

### 2.2 `location/`

- `equivalents.ts` : `loyerMensuelHc(location)` (nu/meublé/moyenne : loyer ; colocation : chambres × loyer par chambre ; courte : nuitée × nuitées par mois) ; `loyerMensuelReference(location, regles)` = loyer meublé longue durée équivalent (nu × (1 + primeMeuble) ; meublé ; colocation total ÷ (1 + primeColocation) ; courte : nuitée × 30 ÷ `nuiteeEnLoyersJournaliers` ; moyenne : loyer) ; `estModeMeuble(mode)` = mode ≠ nu ; `tauxProportionnel(location)` = gestion + conciergerie + plateforme.
- `defauts.ts` : `defautsPourMode(mode, regles, { loyerMensuel, chambres })` → `{ location, charges: { energieMensuel, internetMensuel } }`. Colocation : loyer par chambre = arrondi(loyerMensuel × (1 + primeColocation) ÷ chambres), forfait par chambre = arrondi((énergie + internet) ÷ chambres) (le forfait couvre exactement les charges propriétaire : choix neutre). Courte durée : nuitée = max(30, arrondi(loyerMensuel ÷ 30 × nuiteeEnLoyersJournaliers)), ménage facturé = ménage coût = `menageParSejour`. Moyenne durée : forfait = énergie + internet.
- `regimes.ts` : `REGIMES_PAR_MODE`, `regimesCompatibles(mode)`.

### 2.3 `regles/2026-09.ts` (`exploitation`)

```ts
primeMeuble 0.15 · primeColocation 0.35 · interdictionLocationDpe (inchangés)
parType: {
  nu:            { vacanceSemaines: 3, gestionTaux: 0 },
  meuble:        { vacanceSemaines: 3, gestionTaux: 0 },
  colocation:    { vacanceSemaines: 4, gestionTaux: 0, energieMensuel: 190, internetMensuel: 30 },
  courte_duree:  { nuiteesParMois: 15, dureeSejourNuits: 4, menageParSejour: 27, plateformeTaux: 0.03, conciergerieTaux: 0,
                   nuiteeEnLoyersJournaliers: 2, energieMensuel: 190, internetMensuel: 30 },
  moyenne_duree: { vacanceSemaines: 4, dureeSejourMois: 4, menageParSejour: 0, plateformeTaux: 0, gestionTaux: 0,
                   energieMensuel: 190, internetMensuel: 30 },
}
colocation: { surfaceMinChambreM2: 9, volumeMinChambreM3: 20 }             // loi 89-462 art. 8-1, décret 2002-120
meubleTourisme: { dpeMinNouvelleAutorisation: 'E', dpeMinTous: 'D', dpeMinTousDes: 2034, joursMaxResidencePrincipale: 120,
                  departementsChangementUsage: ['75','92','93','94'] }      // loi 2024-1039 ; CCH L. 631-7
bailMobilite: { dureeMinMois: 1, dureeMaxMois: 10 }                          // loi 89-462 art. 25-12
```

`aConfirmer` += les chemins des valeurs issues de l'Excel ou de choix Deklic (nuitées, séjours, ménage, plateforme, nuitée ÷ loyer, énergie, internet, vacance et séjour en moyenne durée). `simplifications` : forfaits de charges comptés en recettes imposables ; ménage et frais de plateforme déductibles au réel seulement ; nuitées réparties uniformément sur l'année ; vacance de colocation appliquée à toutes les chambres.

### 2.4 Recettes et charges

```ts
interface Recettes { mode; loyersBruts; chargesRecuperees; vacance; loyersNets; nuitees: number|null; sejours: number|null }
type CodeCharge = 'taxeFonciere'|'copro'|'pno'|'comptable'|'cfe'|'gestion'|'conciergerie'|'plateforme'|'menage'|'energie'|'internet'|'entretien'
chargesExploitation(hypotheses, regime, recettes)
calculerCashflow(projet, financement, { regime?, location? })
```

Point mort (hors courte durée) : `L = ((chargesFixes + crédit) ÷ ((1 − v)(1 − p)) − R) ÷ 12` avec `v` = vacance ÷ 52, `p` = taux proportionnel, `R` = charges récupérées annuelles avant vacance ; `null` si `(1 − v)(1 − p) ≤ 0`. Taux de couverture = mensualité ÷ (bruts ÷ 12).

### 2.5 Fiscalité

`locationPourRegime(hypotheses, regime, regles): Location` rend la variante à projeter : régimes BIC → la location du projet (ou une meublée à loyer × (1 + prime) pour une location nue) ; régimes fonciers → une location nue (loyer nu saisi, sinon loyer meublé de référence ÷ (1 + prime)), vacance et gestion reprises quand la variante les porte. `calculerFiscalite` ajoute `compatibles` ; `meilleur` et `meilleurImpot` parmi compatibles ∩ éligibles. Micro-BIC : tourisme non classé quand la location du projet est une courte durée non classée.

### 2.6 Scénarios

`Transformation = (projet, regles) => Variante | null` ; `calculerScenarios` ignore les `null`. Colocation : `defautsPourMode('colocation', …, { loyerMensuel: loyerMeubleReference(projet), chambres })`, charges énergie/internet posées si elles sont à 0, régime conservé s'il est compatible sinon `lmnp_reel`. `loyerMeubleReference(projet)` = loyer de marché (`marche.loyerReferenceM2 × surface × (1 + primeMeuble)`) pour une courte durée quand il existe, sinon `loyerMensuelReference(location)`.

### 2.7 Vigilance

`pointsLocation(projet, regles)` ajouté à `pointsDeVigilance` : codes `CHANGEMENT_USAGE_COURTE_DUREE { zone }`, `DPE_MEUBLE_TOURISME { dpe, classeMinimale, classeTous, annee }`, `REGLEMENT_COPRO_LOCATION { mode }`, `SURFACE_CHAMBRES_COLOCATION { chambres, surfaceParChambre, minimum }`, `BAIL_MOBILITE_CONDITIONS { dureeMin, dureeMax }`.

### 2.8 Migration

`schema/migration.ts` : `migrerProjet(brut: unknown): unknown`, pur, idempotent, sans Zod (il précède la validation). Constantes documentées : `DUREE_SEJOUR_MIGRATION = 4` nuits, `JOURS_PAR_AN = 365`. Le web l'applique dans `stockage/projets.ts` (`migrerEnregistre`) avant `ProjetEnregistreSchema`, pour le stockage local et les liens de partage.

### 2.9 Contrat de sortie

`ResultatsSchema` : recettes (`chargesRecuperees`, `nuitees`, `sejours`), codes de charges, `fiscalite.compatibles`. Les tests d'intégration relisent le rapport de chaque type par ce schéma.

## 3. Web

### 3.1 PR 1 (minimum)

`textes/regimes.ts` (MODES), `hypotheses/groupes-finances.ts` (cinq options, champs par type avec `visibleSi`), `hypotheses/appliquer.ts` (changement de type → `defautsPourMode`, régime compatible, charges propriétaire si elles sont à 0), `annonces/construire.ts` (variante par type depuis le loyer saisi), `ecrans/formulaire/valeurs.ts` et `FormulaireProjet.tsx` (options), `enrichissement/loyer.ts` (loyer visé par type), `analyses/defauts.ts`, `textes/vigilance.ts` (phrases et catégories), `textes/methode-*.ts` (règles renommées), `stockage/projets.ts` (migration), tests.

### 3.2 PR 2 (écrans)

- `ecrans/hypotheses/SelecteurMode.tsx` : groupe de boutons radio (`role="radiogroup"`, 44 px, `pointer-coarse:`), réutilisé par Vérifier ; le descripteur `hypotheses.location.mode` porte `presentation: 'boutons'` ; la carte « La location » affiche « — {type} » dans son titre.
- `ecrans/FormulaireProjet.tsx` : carte « La location » (sélecteur + champs du type) avant « Vous » ; `SaisieProjet` += `chambresLouees`, `loyerChambre`, `nuitee`, `nuiteesParMois` ; `EstimerLoyer` par type.
- `annonces/extraire.ts` : `mode` par règles ; `enrichissement/contrat.ts` et `lecture.ts` : `typeLocation` ; `apps/worker/src/extraction/{contrat,prompt}.ts` v3.
- `ecrans/Fiscalite.tsx` (cartes compatibles), `ecrans/rapport/Leviers.tsx`, `ecrans/Rapport.tsx` (lignes de charges), `ecrans/Comparer` + `analyses/comparaison.ts` (indicateur type), `textes/methode-location.ts` (nouvelle section), `textes/explications.ts`.
- e2e : `apps/web/e2e/location-types.spec.ts`.

## 4. Décisions

- **Union discriminée plutôt que champs optionnels** : chaque variante est complète et typée ; le code qui lit `location.loyerHc` doit affiner le type, ce qui rend visibles les endroits dépendant du type.
- **Migration hors Zod** : `ProjetSchema` reste typé (entrée = nouveau format) ; la migration est une fonction pure appliquée aux frontières de lecture.
- **Frais en charges, pas en recettes** : le micro-BIC se calcule sur les recettes brutes (CGI art. 50-0) ; conciergerie, plateforme et ménage ne sont déductibles qu'au réel. Changement assumé par rapport au modèle précédent (documenté dans `simplifications`).
- **Quatre régimes toujours calculés** : le contrat de sortie ne change pas de forme ; `compatibles` guide l'affichage et le choix du meilleur.
- **Défauts dans les règles, pas dans les écrans** : `defautsPourMode` est la seule source des valeurs de départ (Vérifier, Hypothèses, scénario colocation).
