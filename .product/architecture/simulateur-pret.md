# Architecture : Simulateur de prêt

Discovery : `../features/simulateur-pret-discovery.md`. Specs : `../specs/simulateur-pret-specs.md`. État : `../pipeline/simulateur-pret.json`. Socle : `web-socle.md`, `garder.md` (mode document, fragment d'URL).

## Existant réutilisé

- Moteur : `tableauAmortissement`, `regrouperParAnnee`, `echeancier`, `calculerMensualite`, `assuranceMensuelle`, `taeg`, `fraisAcquisition`, `tauxDmto` (`packages/moteur/src/financement/`), `sommer` (`commun/flux.ts`), `arrondirCentime` (`commun/arrondi.ts`), `obtenirRegles`, `VersionReglesSchema`.
- Web : `ChampHypothese` + type `Descripteur` (rendu d'un champ), `versTexte` / `depuisTexte` (`hypotheses/conversion.ts`), `versBase64Url` / décodage de `stockage/partage.ts` (à extraire en `stockage/base64url.ts` pour être partagé), `ModeDocument` / `useModeDocument`, `Carte`, `TitreCarte`, `Ligne`, `GrosChiffre`, `Bouton`, `Pastille`, `Pourquoi`, formatage (`euros`, `pourcentage`, `nombre`), mécanique de `Imprimer.tsx`, `LogotypeDeklic`.

## Fichiers

```
packages/moteur/src/
├── index.ts                         + export * from './pret'
├── pret/
│   ├── index.ts                     exports publics du module
│   ├── schema.ts                    OffrePretSchema, ProjetFinanceSchema, SimulationPretSchema, types (…Entree)
│   ├── simuler.ts                   besoinFinancement, montantEmprunte, simulerPret(projet, offre, regles) → ResultatPret
│   ├── comparer.ts                  CODES_CRITERES, comparerOffres(a, b, offreA, offreB) → ComparaisonOffres
│   └── frais.ts                     fraisNotaireEstimes(prix, honoraires, departement | undefined, regles) → number (délègue à fraisAcquisition)
packages/moteur/tests/pret/
├── schema.test.ts                   bornes, défauts, refine du différé, noms
├── simuler.test.ts                  0 %, 12 % sur un an, cohérence calculerFinancement (projetExemple), différés, apport total, frais financés, usure, endettement
├── comparer.test.ts                 nominal, égalité, absents, informatifs, ordre
└── frais.test.ts                    département connu, inconnu, absent ; honoraires exclus de l'assiette

apps/web/src/
├── App.tsx                          routes : /simulateur-pret (coque), /simulateur-pret/imprimer (hors coque)
├── coque/Sidebar.tsx                nav « Outils » : Simulateur de prêt (lucide Calculator)
├── stockage/base64url.ts            versBase64Url / depuisBase64Url extraits de partage.ts (partage.ts les importe)
├── simulateur/
│   ├── descripteurs.ts              CHAMPS_PROJET, CHAMPS_OFFRE : Descripteur[] (chemin = clé plate « prix », « offre.tauxNominal »…), libellés, unités, types
│   ├── saisie.ts                    Saisie (textes par clé), saisieDefaut(regles), versSimulation(saisie) → { ok, simulation } | { ok: false, erreurs }, offreVide, copierOffre, estimerFraisNotaire(saisie, regles)
│   ├── lien.ts                      encoderSimulation, decoderSimulation (jamais d'exception, Zod, raisons 'vide' | 'illisible' | 'invalide'), lienSimulateur(origine, simulation), lireFragmentSimulation(hash), PARAMETRE = 's'
│   ├── memoire.ts                   CLE_SIMULATEUR = 'loupe.simulateur.v1', lireSimulation(stockage), ecrireSimulation(stockage, simulation) (Zod, silencieux)
│   └── csv.ts                       csvAmortissement(offre, resultat) → string, nomFichierCsv(offre), LIBELLES_PHASES, centimes(n) → « 1234,56 »
├── textes/simulateur.ts             TITRES, LIBELLES_CRITERES, phraseSynthese(comparaison, noms), PHRASES (rien à emprunter, corrigez, usure(taux, date), lien illisible, identiques, durées différentes), EXPLICATIONS (TAEG, endettement, frais financés)
├── textes/methode-financement.ts    + section « Simulateur de prêt » (constantes lues dans regles.credit)
├── ecrans/
│   ├── SimulateurPret.tsx           page : état Saisie (useState), simulation mémoïsée (useMemo), écriture mémoire + fragment, en-tête (titre, Copier le lien, Imprimer), trois FormulaireColonne, deux ResultatOffre, Comparaison, TableauxAmortissement
│   ├── SimulateurImprimer.tsx       hors coque : lit #s=, ModeDocument, DocumentSimulation, window.print() différé (copie de la mécanique de Imprimer.tsx)
│   └── simulateur/
│       ├── FormulaireColonne.tsx    une carte de champs (ChampHypothese) : projet, offre A, offre B ; boutons Retirer / Ajouter l'offre B, Ré-estimer les frais de notaire
│       ├── ResultatOffre.tsx        carte résultats : GrosChiffre mensualité totale, Ligne × 8, échéancier par phase, pastilles usure / endettement / rien à emprunter / corrigez
│       ├── Comparaison.tsx          tableau critère / A / B / écart, pastille « meilleure », phrase de synthèse, note durées
│       ├── TableauxAmortissement.tsx onglets (aria-pressed), TableauAnnees (années dépliables, aria-expanded), totaux, bouton CSV
│       ├── DocumentSimulation.tsx   rendu imprimable : en-tête, paramètres, résultats, comparaison, tableaux annuels, pied
│       └── telecharger.ts           telechargerTexte(nom, contenu, type) : Blob + <a download> + revokeObjectURL (seul effet, 12 lignes)
apps/web/tests/
├── simulateur-saisie.test.ts        défauts, conversions, erreurs par champ, estimation des frais, offre B vide / copiée
├── simulateur-lien.test.ts          aller-retour, partiel, corrompu, fragment
├── simulateur-memoire.test.ts       lecture / écriture, contenu illisible ignoré
├── simulateur-csv.test.ts           BOM, en-tête, lignes, virgule décimale, totaux, nom de fichier, \r\n
├── simulateur-ecran.test.tsx        page par défaut, saisie → résultats, erreur de champ, comparaison, onglets, années dépliées, bouton CSV (telechargerTexte doublé), Copier le lien, Retirer / Ajouter l'offre B
├── simulateur-impression.test.tsx   page hors coque, mode document, tableaux annuels, print appelé
└── methode-page.test.tsx            + section du simulateur
apps/web/e2e/simulateur.spec.ts      parcours : ouvrir depuis le menu, saisir A et B, comparaison visible, déplier une année, télécharger le CSV (waitForEvent('download'), nom et première ligne), copier le lien et le rouvrir
vitest.config.ts                     seuil 100 % : ajouter « simulateur » à la liste des dossiers de apps/web
```

Aucun fichier au-dessus de 300 lignes : `SimulateurPret.tsx` orchestre seulement ; les cartes sont séparées.

## Interfaces

```ts
// packages/moteur/src/pret/schema.ts
export const OffrePretSchema = z.object({ nom, apport, fraisDossier, fraisGarantie, fraisBancairesFinances, tauxNominal, tauxAssurance, dureeAnnees, differeTotalMois, differePartielMois }).refine(...);
export const ProjetFinanceSchema = z.object({ prix, honorairesAgence, travaux, fraisNotaire, departement?, revenusMensuels? });
export const SimulationPretSchema = z.object({ versionRegles, projet, offres: z.array(OffrePretSchema).min(1).max(2) });
export type OffrePret, OffrePretEntree, ProjetFinance, ProjetFinanceEntree, SimulationPret, SimulationPretEntree;

// packages/moteur/src/pret/simuler.ts
export interface ResultatPret { aEmprunter; besoin; montantEmprunte; fraisBancaires; mensualiteHorsAssurance; assuranceMensuelle; mensualiteTotale; echeancier; tableau; parAnnee; totalInterets; totalAssurance; totalMensualites; coutTotalCredit; taegHorsAssurance; taegAvecAssurance; tauxUsure; tauxUsureDepasse; endettement }
export function besoinFinancement(projet: ProjetFinance, offre: OffrePret): number;
export function simulerPret(projet: ProjetFinance, offre: OffrePret, regles: Regles): ResultatPret;

// packages/moteur/src/pret/comparer.ts
export type CodeCritere = 'mensualiteTotale' | 'coutTotalCredit' | 'totalInterets' | 'totalAssurance' | 'taegHorsAssurance' | 'taegAvecAssurance' | 'montantEmprunte' | 'dureeAnnees' | 'endettement';
export const CODES_CRITERES: readonly CodeCritere[];
export interface CritereCompare { code; a: number | null; b: number | null; ecart: number | null; meilleure: 'a' | 'b' | null }
export interface ComparaisonOffres { criteres: readonly CritereCompare[] }
export function comparerOffres(a: ResultatPret, b: ResultatPret, offreA: OffrePret, offreB: OffrePret): ComparaisonOffres;

// apps/web/src/simulateur/saisie.ts
export interface Saisie { projet: Record<CleProjet, string>; offres: [Record<CleOffre, string>, Record<CleOffre, string> | null]; fraisNotaireManuels: boolean }
export type Conversion = { ok: true; simulation: SimulationPret } | { ok: false; erreurs: Record<string, string>; partiel: { offreA: ResultatPret | null } };
export function saisieDefaut(regles: Regles): Saisie;
export function versSimulation(saisie: Saisie, regles: Regles): Conversion;   // chaque offre validée séparément : A peut être calculée si seule B est fausse

// apps/web/src/simulateur/csv.ts
export function csvAmortissement(offre: OffrePret, resultat: ResultatPret): string;
export function nomFichierCsv(offre: OffrePret): string;
```

Un seul objet traverse les écrans : `{ saisie, simulation, resultats: [ResultatPret | null, ResultatPret | null], comparaison: ComparaisonOffres | null, erreurs }` calculé dans `SimulateurPret.tsx` par `useMemo` sur `saisie`.

## Flux

```
Saisie (textes)  ── versSimulation (depuisTexte + Zod, par carte) ──▶ SimulationPret | erreurs
                                                                     │
                     simulerPret(projet, offreA, regles) ◀───────────┤ (useMemo, ≈ 2 ms par offre, TAEG compris)
                     simulerPret(projet, offreB, regles) ◀───────────┘
                                │
                     comparerOffres(A, B) ──▶ Comparaison.tsx
                                │
        ResultatOffre.tsx ◀─────┴─────▶ TableauxAmortissement.tsx ──▶ csvAmortissement ──▶ telechargerTexte (Blob)
                                │
        ecrireSimulation(localStorage) et history.replaceState('#s=…') à chaque simulation valide (dégommé 300 ms)
        « Copier le lien » ──▶ lienSimulateur ──▶ presse-papiers (ou champ à copier)
        « Imprimer » ──▶ /simulateur-pret/imprimer#s=… ──▶ ModeDocument ──▶ DocumentSimulation ──▶ window.print()
```

Ouverture de la page : `#s=` s'il existe (sinon stockage local, sinon `saisieDefaut`) ; un fragment illisible affiche les défauts et une pastille. Les frais de notaire sont ré-estimés à chaque changement de prix, honoraires ou département tant que `fraisNotaireManuels` est faux.

## Décisions

- **ADR-S1 : le simulateur vit dans le moteur.** `simulerPret` réutilise `tableauAmortissement`, `taeg`, `echeancier` : les chiffres d'une offre sont, au centime, ceux du rapport d'un projet (test de cohérence sur `projetExemple`). Le web ne calcule rien.
- **ADR-S2 : frais bancaires payés comptant par défaut**, case « financés par le prêt » pour retrouver un projet Deklic. Dans les deux cas le TAEG les compte (capital net = montant − frais). Alternative écartée : les financer toujours (l'Excel et les offres réelles ne le font pas).
- **ADR-S3 : CSV, pas XLSX.** UTF-8 avec BOM, `;`, virgule décimale, `\r\n` : Excel en français l'ouvre en colonnes sans assistant. Zéro dépendance. Un XLSX pourra s'ajouter sans toucher au reste.
- **ADR-S4 : impression par le navigateur** (page hors coque en `ModeDocument`, comme `garder`), années sur papier, mois dans le CSV. Pas de jsPDF.
- **ADR-S5 : état dans le fragment et le stockage local**, jamais sur un serveur ; `history.replaceState` garde l'URL à jour pour que « copier l'adresse » suffise. Le fragment est validé par Zod avec des bornes (prix ≤ 100 M€, taux ≤ 20 %, durée 1..30, différés ≤ 36) ; les noms de banque sont affichés comme texte (jamais interprétés), 40 caractères au plus.
- **ADR-S6 : « taux d'endettement » = mensualité totale ÷ revenus nets**, comme l'ancien outil et l'Excel ; distinct de l'effort HCSF d'un projet (70 % des loyers comptés). Nommé et expliqué (ⓘ, Méthode) pour éviter la confusion ; seuil HCSF des règles repris pour la pastille.
- **Champs par `Descripteur`** : `CHAMPS_PROJET` / `CHAMPS_OFFRE` réutilisent le type `Descripteur` et `ChampHypothese` ; le `chemin` est une clé plate (« tauxNominal »), pas un chemin de projet. Pas de nouveau composant de champ. Les curseurs de l'ancien outil (durée, différés) deviennent des champs entiers ; un curseur pourra venir avec la fiche de backlog 06 (composant partagé).
- **Extraction de `stockage/base64url.ts`** depuis `partage.ts` : même encodage pour les deux fragments, un seul jeu de tests.

## Ordre d'implémentation

1. `packages/moteur/src/pret/schema.ts` + tests (US-1, partie schéma)
2. `pret/frais.ts`, `pret/simuler.ts` + tests, export dans `index.ts` (US-1)
3. `pret/comparer.ts` + tests (US-2) — commit `feat(moteur): US-1/US-2 — simulateur de prêt`
4. Web purs : `stockage/base64url.ts` (extraction), `simulateur/{descripteurs,saisie,lien,memoire,csv}.ts`, `textes/simulateur.ts` + tests, seuil de couverture (US-3 socle, US-6 contenu, US-7 lien)
5. Écrans : `FormulaireColonne`, `ResultatOffre`, `SimulateurPret` + route + tests (US-3) — commit
6. `Comparaison.tsx`, `TableauxAmortissement.tsx` + bouton CSV + `telecharger.ts` + tests (US-4, US-5, US-6) — commit
7. `SimulateurImprimer.tsx`, `DocumentSimulation.tsx`, Copier le lien + tests (US-7) — commit
8. `Sidebar.tsx`, section Méthode + tests (US-8) — commit
9. e2e `simulateur.spec.ts` ; vérification manuelle du CSV dans Excel ; docs (registre, README, CLAUDE.md, backlog 08 → livrée) ; PR, auto-merge

## Cas limites (par module)

- `simuler.ts` : taux 0 (mensualité = capital ÷ mois, TAEG résolu à 0 ou frais seuls) ; durée 1 an ; apport ≥ besoin (tableau vide, `aEmprunter` false, TAEG null, endettement 0 ou null) ; différés maximaux (35 + 0 mois sur 3 ans passe, 36 + 0 sur 3 ans est refusé par le schéma) ; frais bancaires 0 (TAEG hors assurance = taux nominal à 1e-6 près) ; revenus 0 (endettement null, pas de division par zéro).
- `comparer.ts` : valeurs nulles ; égalité au centime ; ordre des codes ; critères informatifs.
- `saisie.ts` : virgule ou point décimal, espaces, pourcentages saisis en « 3,3 » (→ 0,033), champs vides → défaut ou erreur selon le champ, offre B nulle, frais de notaire manuels puis ré-estimés.
- `lien.ts` / `memoire.ts` : fragment vide, base64 invalide, JSON invalide, schéma invalide, version de règles inconnue → défauts ; jamais d'exception.
- `csv.ts` : tableau vide → en-tête + ligne de totaux à 0 ; nom de banque avec accents, espaces, apostrophes → slug ; taux à deux décimales dans le nom.
- Écrans : offre B retirée puis remise ; presse-papiers refusé ; impression sans fragment (défauts) ; `telechargerTexte` doublé dans les tests (aucun Blob réel).

## Checklist avant implémentation

- [x] Aucun conflit : nouveau module `pret/`, nouvelles routes, `partage.ts` seulement refactoré (tests existants inchangés)
- [x] Patterns du dépôt : Zod partout, textes hors moteur, mode document, fragment base64url, `Descripteur`
- [x] Pas de migration, pas de backend, pas de dépendance ajoutée (lucide déjà présent pour l'icône)
- [x] Couverture : `packages/moteur` 100 % ; `apps/web/src/simulateur` ajouté aux seuils 100 % ; écrans testés par rendu
- [x] Fichiers < 300 lignes ; fonctions à une responsabilité ; aucune fonction « et »
- [x] Cas limites listés ci-dessus, chacun avec un test

## Écarts entre le plan et l'implémentation (14/09/2026)

- **Pas de drapeau `fraisNotaireManuels` dans la saisie.** Les frais sont « à toi » dès que le texte du champ diffère de l'estimation courante (`fraisNotaireManuels(projet, regles)` dérivé) ; un prix, des honoraires ou un département modifiés ré-estiment tant que ce n'est pas le cas. Rien à stocker : la mémoire locale garde la `SimulationPret` validée, pas les textes.
- **Deux modules purs de plus** dans `apps/web/src/simulateur/` : `calcul.ts` (`calculer(saisie, regles) → Calcul` : conversion, deux `ResultatPret`, comparaison, noms affichés) et `etat.ts` (`etatInitial(hash, stockage, regles)` : fragment, sinon mémoire, sinon défauts, avec `lienIllisible` et `aEnregistrer`). Les écrans n'ont plus qu'à afficher.
- **Nom d'offre** : le schéma accepte le vide (0 à 40 caractères, coupé de ses espaces) ; le web pose « Offre A » / « Offre B » à la conversion (`nomOffre`). `nomFichierCsv` rend « offre » quand le nom ne donne aucun caractère utile ; `csvAmortissement(resultat)` ne prend que le résultat.
- **Messages en français sur toutes les bornes** de `pret/schema.ts` (« Au plus 30 ans. », « Au plus 36 mois. », « Prix positif attendu. »…) : ils s'affichent tels quels sous le champ. Le refine du différé passe avant la borne du champ : un différé de 300 mois sur 20 ans dit « Le différé doit être plus court que le prêt ».
- **`eurosCentimes`** ajouté à `formatage/nombres.ts` : mensualités et assurance au centime (« 807,23 € ») ; les totaux restent à l'euro.
- **Adresse tenue à jour** par `window.history.replaceState(window.history.state, '', '#s=…')` 300 ms après la dernière frappe, sans passer par le routeur (une navigation refermerait le tiroir et déplacerait le focus).
- **Onglets des tableaux** : `aria-label` explicite sur « Voir les mois de l'année N » (le texte visible reste « Voir les mois »).
- **Impression** : `SimulateurImprimer` recalcule depuis le fragment (défauts sans fragment) ; `DocumentSimulation` ajoute une carte « Les hypothèses » (projet, puis les offres en colonnes) avant les résultats.
- **e2e** : `simulateur.spec.ts` (menu → saisie A et B → comparaison → année dépliée → CSV téléchargé et lu octet par octet → rechargement → lien rouvert dans un contexte neuf ; impression) et deux écrans dans `formats.ts` (18 au total).
- **Téléchargement** : `telecharger.ts` libère l’adresse du Blob 10 secondes après le clic (précaution : une adresse révoquée avant la lecture peut annuler un téléchargement). Le parcours e2e a pourtant échoué par intermittence sur le PC Windows de développement : la trace montre le clic à 3 s et `download.path()` résolu vers 58 s, l’enregistrement du fichier étant lent (analyse antivirus probable). Le parcours a donc 120 s (`test.setTimeout`) ; le contenu du CSV était juste à chaque fois.
