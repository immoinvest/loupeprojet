# Architecture : Hypothèses optionnelles (fiche 02)

Discovery : `../features/hypotheses-optionnelles-discovery.md`. Specs : `../specs/hypotheses-optionnelles-specs.md`. État de la session : `../pipeline/hypotheses-optionnelles.json`. Socles : `moteur-calcul.md`, `web-socle.md`, `garder.md` (mode document), `responsive.md` (règles d'écran).

## Fichiers

```
packages/moteur/src/
├── schema/
│   ├── hypotheses.ts              loyerHc optionnel ; tmi .default(0.3) ; revenusMensuels optionnel (si la fiche 01 ne l'a pas déjà fait)
│   ├── manques.ts                 NOUVEAU : CodeManqueSchema ('LOYER_ABSENT' | 'REVENUS_ABSENTS'), Manque { code, champ }, manquesDe(projet)
│   ├── projet.ts                  ProjetComplet (loyerHc: number), estComplet(projet) (garde de type)
│   ├── resultats.ts               ResultatsSchema = union { complet: true, sections } | { complet: false, sections null } ; manques ; FeuVerdict.raison
│   └── index.ts                   exports
├── calculer-base.ts               ResultatsCommuns / ResultatsComplets / ResultatsPartiels ; calculerComplet(ProjetComplet) ; calculerPartiel(Projet) ; calculerBase = l'un ou l'autre
├── calculer-projet.ts             Resultats = (ResultatsComplets | ResultatsPartiels) & { scenarios, meta } ; scénarios seulement si complet
├── financement/
│   ├── effort.ts                  revenusMensuels et loyerMensuel : number | null ; hcsf null si l'un manque ; depasseHcsf = hcsf !== null && hcsf > seuil
│   └── index.ts                   passe loyerHc ?? null et revenusMensuels ?? null
├── cashflow/index.ts, recettes.ts ProjetComplet (le loyer est un nombre) ; recettesAnnuelles prend Location complète
├── fiscalite/index.ts, types.ts   ProjetComplet ; locationPourRegime(hypotheses complètes)
├── revente/index.ts, rendement/   inchangés (ne lisent pas le loyer) ; appelés seulement par calculerComplet
├── scenarios/                     Variante.projet: ProjetComplet ; avecPrix, prixCible, calculerScenarios sur ProjetComplet ; evaluerVariante via calculerComplet
├── estimation/index.ts            effetCharges : sans loyer de référence ni loyer visé → null
├── verdict/
│   ├── feux.ts                    FeuVerdict.raison: CodeManque | null ; feuRendement/feuCashflow(valeur | null, raison) ; feuEffort(effort, raison)
│   ├── index.ts                   calculerVerdict(projet, financement, fiscalite | null, rendement | null, regles, estimation, manques)
│   └── vigilance.ts               pointsFinanciers sans fiscalité : ni plafond micro, ni PS BIC, ni loyer encadré ; effort seulement si dépassé (connu)
└── index.ts                       exports : ProjetComplet, estComplet, Manque, CodeManque, manquesDe, ResultatsComplets, ResultatsPartiels

packages/moteur/tests/
├── schema/manques.test.ts         NOUVEAU : loyer, revenus, tmi par défaut, estComplet, courte durée sans loyer
├── integration/projet-incomplet.test.ts   NOUVEAU : rapport partiel (sections null, feux et raisons, vigilance, ResultatsSchema, aucun NaN) ; sans revenus ; exemple inchangé au centime
├── financement/taeg-effort-ira.test.ts    effort null (loyer ou revenus absents), depasseHcsf faux
├── verdict/verdict.test.ts                raisons des feux, vigilance sans fiscalité
├── estimation/estimation.test.ts          charges sans loyer
└── scenarios/scenarios.test.ts            inchangé (projet complet) ; evaluerVariante typé

apps/web/src/
├── annonces/construire.ts         SaisieProjet : loyerHc, apport, dureeAnnees, tmi, revenusMensuels optionnels ; loyer ANIL depuis enrichi.marche.loyerReferenceM2 ; défauts « estime »
├── ecrans/formulaire/
│   ├── valeurs.ts                 VIDE : durée « 25 », apport « 0 », tranche « 0.3 » avec provenance « estime » ; valider (quatre champs + formats) ; versSaisie (optionnels)
│   └── Champ.tsx                  badge « estimé » (provenance estime) ; indication (« facultatif »)
├── ecrans/FormulaireProjet.tsx    carte « Vous » : indications ; le bouton « Estimer le loyer » reste
├── enrichissement/loyer.ts        loyerViseDepuisReference(referenceM2, surface, mode, prime) ; appliquerLoyerDeReference(projet, regles)
├── textes/
│   ├── manques.ts                 NOUVEAU : MANQUES[code] = { titre, phrase, feu } ; libelleFeuManque
│   ├── feux.ts                    libelleFeu : « … : loyer à indiquer » / « … : revenus à indiquer » selon raison
│   ├── verdict.ts                 « Le loyer reste à indiquer. » quand le résultat est partiel
│   ├── methode-verdict.ts         défauts : apport, durée, tranche (justification), loyer ANIL ; verdict : ce qui est calculé sans loyer et sans revenus
│   └── explications.ts            inchangé
├── ecrans/projet/AnalyseIncomplete.tsx    NOUVEAU : bandeau (titre, phrase), champ en ligne (ChampHypothese + appliquerSaisie + mettreAJour), bouton « Utiliser le loyer de marché : X € » ; en mode document : phrase seule
├── ecrans/Rapport.tsx             r.complet ? cartes : bandeau + CartePrix + trois cartes « À compléter », pas de Leviers ; carte impôts : « tranche supposée à 30 % »
├── ecrans/rapport/CarteACompleter.tsx     NOUVEAU : titre de la carte, « À compléter », phrase courte
├── ecrans/Fiscalite.tsx           bandeau si partiel ; encart « Votre tranche d'imposition » (select en ligne) quand la provenance est « estime » ; chapo « tranche supposée »
├── ecrans/Revente.tsx             bandeau si partiel (pas d'horizons)
├── ecrans/Hypotheses.tsx          synthèse « — » si partiel
├── hypotheses/groupes-finances.ts loyer et revenus non obligatoires
├── hypotheses/appliquer.ts        preparerCourteDuree : nuitée 60 € sans loyer
├── ecrans/adresse/Loyer.tsx       « Loyer visé du projet : non renseigné » ; bouton « Utiliser … » toujours proposé
├── ecrans/MesProjets.tsx          « — » si partiel
├── analyses/comparaison.ts        extraire : null si partiel
├── analyses/revente.ts            variantesRevente : [] si partiel
├── analyses/defauts.ts            Defauts + apport, dureeAnnees, tmi ; saisie minimale
└── stockage/                      inchangé (ProjetSchema accepte l'absence)

apps/web/tests/
├── analyse-incomplete.test.tsx    NOUVEAU : Rapport, Fiscalité, Revente, Hypothèses, Visite, Estimation, Mes projets, Comparer, impression, partage avec un projet sans loyer ; compléter depuis le bandeau ; loyer de marché
├── nouveau-projet.test.tsx        quatre champs suffisent ; erreurs du minimum ; défauts et badges ; loyer ANIL (client simulé) ; sans marché
├── annonces.test.ts               construireProjet : loyer ANIL, défauts « estime », loyer saisi prioritaire
├── hypotheses.test.ts             loyer vide accepté ; courte durée sans loyer ; revenus vides
├── textes.test.ts                 libelleFeu avec raison ; texteVerdict partiel ; MANQUES
├── onglets.test.tsx               tranche supposée (chapo, encart, changement)
├── comparaison.test.ts, analyses.test.ts, methode.test.ts   projets partiels, nouveaux défauts
└── (tests existants)              apport et revenus retirés des saisies où ils ne servent pas

apps/web/e2e/
├── aides.ts                       creerProjetManuel : prix, surface, code postal, ville, loyer (le Worker n'est pas joignable en e2e : pas d'ANIL)
├── incomplet.spec.ts              NOUVEAU : projet sans loyer → bandeau → 700 € → cash-flow ; rechargement
├── mes-projets.spec.ts            valeurs de Lyon recalculées (apport 0 €)
└── formats.ts                     preparerDonnees ajoute un projet sans loyer ; écran « Rapport à compléter »
```

## Types clés

```ts
// schema/manques.ts
export const CodeManqueSchema = z.enum(['LOYER_ABSENT', 'REVENUS_ABSENTS']);
export interface Manque {
  readonly code: CodeManque;
  readonly champ: string;
}
export function manquesDe(projet: Projet): Manque[]; // loyer d'abord, puis revenus

// schema/projet.ts
export type ProjetComplet = Projet & {
  readonly hypotheses: { readonly location: { readonly loyerHc: number } };
};
export function estComplet(projet: Projet): projet is ProjetComplet;

// calculer-base.ts
interface ResultatsCommuns {
  projet;
  financement;
  estimation;
  verdict;
  manques;
}
export interface ResultatsComplets extends ResultatsCommuns {
  complet: true;
  cashflow;
  fiscalite;
  revente;
  rendement;
}
export interface ResultatsPartiels extends ResultatsCommuns {
  complet: false;
  cashflow: null;
  fiscalite: null;
  revente: null;
  rendement: null;
}
export type ResultatsBase = ResultatsComplets | ResultatsPartiels;
export function calculerComplet(projet: ProjetComplet, regles): ResultatsComplets; // l'enchaînement d'aujourd'hui
export function calculerPartiel(projet: Projet, regles): ResultatsPartiels; // financement, estimation, verdict
export function calculerBase(projet: Projet, regles): ResultatsBase;

// calculer-projet.ts
export type Resultats = ResultatsBase & {
  scenarios: ResultatScenarios | null;
  meta: MetaResultats;
};
// scénarios : avecScenarios && base.complet ? calculerScenarios(base.projet, base, regles) : null

// verdict/feux.ts
export interface FeuVerdict {
  axe;
  feu;
  valeur: number | null;
  raison: CodeManque | null;
}
```

## Flux

- **Calcul** : `calculerProjet` → `ProjetSchema.parse` (tmi 0,3 posé, loyer et revenus absents acceptés) → `calculerBase` : `estComplet` ? `calculerComplet` (chaîne inchangée) : `calculerPartiel` (financement avec effort `null`, estimation, verdict avec feux « inconnu » et raison, vigilance du bien + taxe foncière + durée) → scénarios si complet → `meta`.
- **Création** : Vérifier (quatre champs) → `versSaisie` (optionnels `undefined`) → `enrichirSaisie` (géocodage, marché) → `construireProjet(saisie, id, enrichi)` : loyer = saisie, sinon `loyerViseDepuisReference(enrichi.marche.loyerReferenceM2, surface, mode, prime)` (provenance `anil`), sinon absent ; apport 0, durée 25, tranche 0,3 (`estime`) ; revenus seulement s'ils sont saisis.
- **Compléter** : bandeau `AnalyseIncomplete` → `appliquerSaisie(projet, descripteurParChemin(champ), texte)` → `mettreAJour` (Zod) → recalcul par `FournisseurProjet` ; bouton « loyer de marché » → `appliquerLoyerDeReference(projet, regles)` → `mettreAJour`.
- **Tranche** : Fiscalité lit `provenance['fiscalite.tmi'] === 'estime'` → encart avec le select du descripteur `hypotheses.fiscalite.tmi` → `appliquerSaisie` → provenance `utilisateur`.

## Décisions

- **ADR-H1 : union discriminée `complet` plutôt que quatre sections nullables indépendantes.** Les quatre sections dépendent toutes du loyer et tombent ensemble ; un seul contrôle `r.complet` par écran donne toutes les sections typées non nulles. `manques` reste la liste des données absentes (le résultat complet peut porter `REVENUS_ABSENTS`). Les scénarios recalculent des variantes complètes par construction (`calculerComplet`), donc sans contrôle nul.
- **ADR-H2 : tranche d'imposition avec défaut 30 % (« estimé »), pas de blocage.** Les cinq feux ne lisent pas la tranche ; l'onglet Fiscalité et la carte impôts annoncent « tranche supposée » avec le choix en ligne. Source du défaut : barème 2026 (30 % dès 29 316 € de revenu imposable par part), tranche la plus fréquente d'un ménage qui emprunte pour investir. Réversible : retirer le `.default()` et ajouter `TMI_ABSENTE` aux manques.
- **ADR-H3 : le loyer de marché est posé à la création, pas seulement proposé.** `enrichirSaisie` lit déjà les loyers ANIL ; les ranger dans `marche.loyerReferenceM2` sans en faire le loyer visé obligeait à cliquer « Estimer le loyer ». Provenance `anil` (badge « donnée publique »), même formule que la carte « Le loyer de marché » (moins 8 % de charges, prime meublé). Sans réponse du Worker ou sans loyer ANIL : loyer absent, analyses bloquées.
- **ADR-H4 : un effort inconnu n'est pas un effort dépassé.** `depasseHcsf` devient `hcsf !== null && hcsf > seuil` ; sans revenus (ou sans loyer), le feu est « inconnu » avec sa raison et aucun point de vigilance « effort au-dessus du seuil ». Compatible avec la fiche 01 (couverture en repli) : le feu effort y prend une autre valeur, la raison reste disponible pour le texte.
- **ADR-H5 : le formulaire montre ses défauts** (25 ans, 0 €, 30 % avec badge « estimé ») plutôt que des champs vides ; un champ facultatif vidé revient au défaut sans erreur. « Jamais de case vide » vaut aussi pour Vérifier.
- Le loyer reste `obligatoire` nulle part dans les descripteurs, mais `bien.surface`, `bien.pieces`, `bien.departement`, `achat.prix`, `pret.dureeAnnees`, `pret.tauxNominal` le restent : ils ont un défaut posé à la création et vider le champ dans Hypothèses n'aurait pas de sens.

## Ordre d'implémentation

1. US-1 : `schema/manques.ts`, `hypotheses.ts`, `projet.ts` (types, garde), `resultats.ts` ; tests schéma ; commit.
2. US-2 : `effort.ts`, `financement/index.ts`, `estimation`, `cashflow`/`fiscalite`/`scenarios` sur `ProjetComplet`, `verdict/*`, `calculer-base.ts`, `calculer-projet.ts`, `index.ts` ; tests d'intégration partiels, exemple inchangé, couverture 100 % ; commit.
3. US-3 : `construire.ts`, `loyer.ts`, `valeurs.ts`, `Champ.tsx`, `FormulaireProjet.tsx`, `defauts.ts` ; tests annonces, nouveau projet ; commit.
4. US-4 : `textes/manques.ts`, `feux.ts`, `verdict.ts`, `AnalyseIncomplete.tsx`, `CarteACompleter.tsx`, `Rapport`, `Fiscalite`, `Revente`, `Hypotheses`, `groupes-finances.ts`, `appliquer.ts`, `Loyer.tsx`, `MesProjets`, `comparaison.ts`, `revente.ts` ; test `analyse-incomplete.test.tsx` ; vérification dans le navigateur ; commit.
5. US-5 : tranche supposée (Fiscalité, Rapport) ; tests ; commit.
6. US-6 : Méthode (défauts, verdict), e2e (`aides.ts`, `incomplet.spec.ts`, `mes-projets.spec.ts`, `formats.ts`) ; commit.
7. Suite complète, `test:coverage`, e2e local ; docs (US-7) ; `git merge origin/master` ; PR ; auto-merge.

## Auto-revue

- `ResultatsSchema` devient une union : les tests d'intégration existants (`ResultatsSchema.parse(resultats)`) restent verts sur l'exemple ; un test vérifie que le résultat partiel passe aussi et qu'un résultat « complet » avec une section nulle est refusé.
- Le typage strict signale chaque lecture des sections dans le web (dix fichiers) : aucune ne peut être oubliée ; chaque écran a un test de rendu avec un projet sans loyer.
- `hcsf` devenant `null` avec un loyer absent : `Comparer` et `Hypothèses` savent déjà afficher « — » ; `texteVerdict` omet déjà la phrase d'effort.
- Les tests web qui saisissent apport et revenus (nouveau projet, capture, enrichi, auto, marché complet, app) sont relus : ils gardent le loyer, retirent ce qui n'a plus de champ obligatoire, et fixent les valeurs attendues recalculées.
- Fiche 01 : si `revenusMensuels` est déjà optionnel sur `master` au moment d'implémenter, US-1 ne le touche pas et US-2 reprend sa version de `feuEffort` (couverture) en y ajoutant `raison`.

## Notes d'implémentation (écarts avec le plan)

- **US-4 livrée dans le commit de US-2** : dès que `Resultats` devient une union, les écrans ne compilent plus sans leur contrôle `r.complet` ; bandeau, cartes « À compléter », feux « loyer à indiquer » et « — » de Mes projets, Comparer et Hypothèses sont donc arrivés avec le moteur.
- **Bandeau : champ + bouton « Appliquer »** (ou Entrée) plutôt qu'un enregistrement à chaque frappe : sinon le premier chiffre tapé (« 9 ») complète le projet, le bandeau disparaît et la saisie s'interrompt.
- **Taxe foncière sans loyer** : 14 € par m² et par an (`TAXE_FONCIERE_PAR_M2_AN`), estimée ; avec un loyer, un mois de loyer comme avant.
- **Courte durée sans loyer** : nuitée de départ 60 € (`NUITEE_DEFAUT`), à la création comme dans Hypothèses.
- **Parcours e2e** : le projet de Lyon (apport 0 € par défaut, sans revenus) passe de −222 à −273 €/mois et affiche « Effort bancaire : revenus à indiquer » ; `incomplet.spec.ts` couvre la création sans loyer, Fiscalité bloquée et la saisie dans le bandeau.
- **Fiches 01 et 04** : implémentée avant leur fusion, sur décision de Pierre. À la fusion : `revenusMensuels` est optionnel des deux côtés ; la couverture en repli du feu effort (fiche 01) doit garder `raison` quand ni revenus ni loyer ne sont connus ; `prixRetenu` (fiche 04) remplace `achat.prix` dans `calculerPartiel` aussi.
- **Fusion de `master` (fiches 04, 06, 09, 10, 11)** : `ResultatsCommuns` porte aussi `achat` (prix retenu), calculé même sans loyer ; `estimation` capitalise les charges au loyer visé ÷ **prix retenu** ; `avecPrix` et `prixCible` gardent `ProjetComplet`. Le Rapport de la fiche 10 (`CarteAutofinancement`, `CarteRendements`, `analyses/rapport.ts`, `textes/explications.ts`) ne reçoit que des `ResultatsComplets` : sans loyer, quatre cartes « À compléter » (autofinancement, rendements, impôts, revente) sous le bandeau, la carte du prix reste. Revente (fiche 06) : le curseur et ses variantes ne s'affichent qu'une fois `r.complet` vérifié ; `variantesRevente` s'appuie sur `projetAHorizon` et rend `[]` sans loyer. Tests de la fiche 10 : helper `rapportComplet` dans `tests/projets.ts`.
- **Seconde fusion de `master` (fiche 07 `visite-questions`, correctifs #51, #52)** : les signaux du bien (copropriété, DPE, étage, risques, prix sous le marché, taxe foncière) ont quitté `pointsDeVigilance` pour la base de questions de visite, qui ne lit que les feux et fonctionne donc sans loyer. `pointsDeVigilance(projet, financement, fiscalite | null)` garde la séparation de cette feature : points de la banque toujours, points fiscaux seulement avec la fiscalité. `CarteVigilance` (« Avant de faire une offre ») s'affiche aussi sous le bandeau d'un rapport partiel. La question de visite « loyer actuel » écrit `hypotheses.location.loyerHc` : une autre façon de compléter un projet sans loyer. Le débordement de Comparer sur téléphone, révélé par le projet sans loyer ajouté aux formats, était corrigé par la fiche 07.
- **Troisième fusion de `master` (fiches 01 et 03 `hypotheses-financement`)** : les revenus ne sont plus jamais demandés. Le code `REVENUS_ABSENTS` disparaît : `LOYER_ABSENT` est le seul manque. Le feu `effort` devient `couverture` (mensualité ÷ loyer) : `feuCouverture(taux | null, regles, raison)` porte `LOYER_ABSENT` quand le loyer manque, comme rendement et cash-flow. Le champ « Vos revenus nets » quitte Vérifier, et `SaisieProjet.revenusMensuels` disparaît. L'onglet Financement de la fiche 01 reste lisible sans loyer : la carte « Le loyer porte-t-il le crédit ? » garde la ligne du crédit et dit « Indiquez un loyer ». Le projet de Lyon des parcours e2e reprend l'apport de 10 000 € (−222 €/mois), et `creerProjetMinimal(page, { loyer, apport })` sert aux deux.
- **Quatrième fusion de `master` (`location-types`, PR #46)** : la location devient une union par type (nu, meublé, colocation, courte et moyenne durée), et chaque type a son propre champ de loyer. Ce champ devient facultatif : `loyerHc` (nu, meublé, moyenne durée), `loyerChambre` (colocation), `nuitee` (courte durée). `CHAMP_LOYER_PAR_MODE` le nomme, `loyerConnu(location)` dit s'il est connu, `champLoyer(mode)` donne le chemin du manque. `LocationComplete` et `HypothesesCompletes` sont les variantes où ce champ est un nombre : recettes, équivalents de loyer, défauts du type, fiscalité et scénarios ne prennent qu'elles. Financement, estimation et vigilance lisent le loyer seulement s'il est connu. À la création, sans loyer saisi ni loyer de marché, la variante du type est construite sans son champ de loyer : les autres défauts du type restent posés, avec le badge « estimé ». En colocation, le loyer de marché devient le total des chambres (meublé × prime colocation). Dans Hypothèses, changer de type sans loyer ne crée pas de loyer : la nouvelle variante attend le sien. Le bandeau propose le loyer de marché dans l'unité du champ qui manque (loyer mensuel, ou loyer par chambre en colocation), jamais en courte durée. Pour tenir sous 300 lignes, deux fichiers ont été découpés : `annonces/location-saisie.ts` (loyer retenu, variante du type) et `schema/resultats-estimation.ts`.
