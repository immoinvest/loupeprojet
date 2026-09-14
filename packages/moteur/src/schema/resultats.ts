import { z } from 'zod';

import { ModeLocationSchema, RegimeSchema } from './hypotheses';
import { ProjetSchema, VersionReglesSchema } from './projet';

/**
 * Schéma de sortie du moteur. Sert de contrat à l'interface et de garde-fou en test :
 * `z.number()` refuse NaN et l'infini, `strictObject` refuse toute clé non documentée.
 */
const n = z.number();
const nOuNull = z.number().nullable();

const PhaseCreditSchema = z.enum(['differe_total', 'differe_partiel', 'amortissement']);

export const FinancementSchema = z.strictObject({
  fraisAcquisition: z.strictObject({
    base: n,
    tauxDmto: n,
    droits: n,
    emolumentsHt: n,
    emolumentsTtc: n,
    contributionSecuriteImmobiliere: n,
    debours: n,
    total: n,
  }),
  coutTotalProjet: n,
  montantEmprunte: n,
  miseDeDepart: n,
  mensualiteHorsAssurance: n,
  assuranceMensuelle: n,
  mensualiteTotale: n,
  echeancier: z.array(
    z.strictObject({
      phase: PhaseCreditSchema,
      deMois: n,
      aMois: n,
      mensualiteHorsAssurance: n,
      mensualiteTotale: n,
    }),
  ),
  tableau: z.array(
    z.strictObject({
      mois: n,
      annee: n,
      phase: PhaseCreditSchema,
      crdDebut: n,
      interets: n,
      capital: n,
      mensualite: n,
      assurance: n,
      crdFin: n,
    }),
  ),
  parAnnee: z.array(
    z.strictObject({
      annee: n,
      interets: n,
      capital: n,
      mensualites: n,
      assurance: n,
      crdFin: n,
    }),
  ),
  totalInterets: n,
  totalAssurance: n,
  coutTotalCredit: n,
  taegHorsAssurance: nOuNull,
  taegAvecAssurance: nOuNull,
  tauxUsureDepasse: z.boolean(),
  effort: z.strictObject({
    hcsf: nOuNull,
    sansLoyers: nOuNull,
    seuil: n,
    depasseHcsf: z.boolean(),
    dureeMaxAnnees: n,
    depasseDuree: z.boolean(),
  }),
  crdRevente: n,
  iraRevente: n,
});

export const CashflowSchema = z.strictObject({
  regime: RegimeSchema,
  recettes: z.strictObject({
    mode: ModeLocationSchema,
    loyersBruts: n,
    vacance: n,
    loyersNets: n,
    courteDuree: z
      .strictObject({ nuitees: n, recettesBrutes: n, menage: n, conciergerie: n })
      .nullable(),
  }),
  charges: z.array(
    z.strictObject({
      code: z.enum(['taxeFonciere', 'copro', 'pno', 'comptable', 'cfe', 'gestion', 'entretien']),
      annuel: n,
    }),
  ),
  chargesAnnuelles: n,
  mensuel: n,
  mensuelHorsVacance: n,
  effortEpargne: n,
  pointMort: nOuNull,
  tauxCouverture: nOuNull,
  parAnnee: z.array(
    z.strictObject({ annee: n, recettes: n, charges: n, credit: n, avantImpot: n }),
  ),
});

const AnneeFiscaleSchema = z.strictObject({
  annee: n,
  recettes: n,
  chargesDeductibles: n,
  interetsDeductibles: n,
  amortissementsDeduits: n,
  deficitImpute: n,
  deficitImputeRevenuGlobal: n,
  baseImposable: n,
  impotRevenu: n,
  prelevementsSociaux: n,
  impot: n,
  cashflowApresImpot: n,
  stocks: z.strictObject({ deficitReportable: n, amortissementsReportes: n }),
});

const RegimeResultatSchema = z.strictObject({
  regime: RegimeSchema,
  mode: ModeLocationSchema,
  eligible: z.boolean(),
  motifIneligibilite: z.enum(['PLAFOND_MICRO_DEPASSE']).nullable(),
  cashflow: CashflowSchema,
  annees: z.array(AnneeFiscaleSchema),
  impotTotal: n,
  cashflowApresImpotTotal: n,
  premiereAnneeImposable: nOuNull,
  amortissementsImmeubleDeduits: n,
});

export const FiscaliteResultatSchema = z.strictObject({
  regimes: z.strictObject({
    micro_bic: RegimeResultatSchema,
    lmnp_reel: RegimeResultatSchema,
    micro_foncier: RegimeResultatSchema,
    nu_reel: RegimeResultatSchema,
  }),
  retenu: RegimeSchema,
  meilleur: RegimeSchema,
  meilleurImpot: RegimeSchema,
});

export const ReventeResultatSchema = z.strictObject({
  annees: n,
  valeur: n,
  fraisVente: z.strictObject({ agence: n, diagnostics: n, total: n }),
  crd: n,
  ira: n,
  plusValue: z.strictObject({
    prixCession: n,
    fraisRetenus: n,
    travauxRetenus: n,
    reintegration: n,
    prixAcquisitionMajore: n,
    plusValueBrute: n,
    abattements: z.strictObject({ ir: n, ps: n }),
    baseIr: n,
    basePs: n,
    impotIr: n,
    impotPs: n,
    surtaxe: n,
    impotTotal: n,
  }),
  cashNetVendeur: n,
});

export const RendementSchema = z.strictObject({
  rendements: z.strictObject({ coutTotal: n, brut: n, net: n, netNet: n }),
  cashflowsApresImpot: z.array(n),
  flux: z.array(n),
  tri: nOuNull,
  enrichissement: z.strictObject({
    miseDeDepart: n,
    cashflowsCumules: n,
    capitalRembourse: n,
    plusValueNette: n,
    total: n,
  }),
});

export const FeuSchema = z.enum(['bon', 'surveiller', 'probleme', 'inconnu']);

export const VerdictSchema = z.strictObject({
  feux: z
    .array(
      z.strictObject({
        axe: z.enum(['prix', 'rendement', 'cashflow', 'couverture', 'risques']),
        feu: FeuSchema,
        valeur: nOuNull,
      }),
    )
    .length(5),
  synthese: z.strictObject({ bons: n, surveiller: n, problemes: n, inconnus: n }),
  vigilance: z.array(
    z.strictObject({
      code: z.string().regex(/^[A-Z_]+$/),
      parametres: z.record(z.string(), z.union([n, z.string()])),
    }),
  ),
});

const IndicateursScenarioSchema = z.strictObject({
  cashflowMensuel: n,
  rendementNet: n,
  impotTotal: n,
  tri: nOuNull,
  enrichissement: n,
});

export const ScenariosSchema = z.strictObject({
  scenarios: z.array(
    z.strictObject({
      code: z.enum([
        'negocier',
        'colocation',
        'duree',
        'tauxPlus050',
        'nu',
        'meuble',
        'vacance2Mois',
      ]),
      parametres: z.record(z.string(), z.union([n, z.string()])),
      indicateurs: IndicateursScenarioSchema,
      deltas: IndicateursScenarioSchema,
    }),
  ),
  prixCibles: z.array(
    z.strictObject({
      critere: z.enum(['cashflow_zero', 'net_6', 'brut_8']),
      prix: nOuNull,
      ecart: nOuNull,
    }),
  ),
});

const EtatSchema = z.enum(['a_renover', 'a_rafraichir', 'bon_etat', 'renove']);

export const EstimationResultatSchema = z.strictObject({
  etat: EtatSchema,
  etatSuppose: z.boolean(),
  prixM2Marche: n,
  corrections: z.array(
    z.strictObject({
      code: z.enum(['dpe', 'etage', 'exterieur', 'charges']),
      taux: n,
      montant: n,
      ignoree: z.boolean(),
    }),
  ),
  prixM2Estime: n,
  centre: n,
  bas: n,
  haut: n,
  selonEtat: z.strictObject({ a_renover: n, a_rafraichir: n, bon_etat: n, renove: n }),
  confiance: z.strictObject({
    note: n,
    niveau: z.enum(['tres_faible', 'faible', 'moyenne', 'bonne', 'elevee']),
    precision: z.enum(['immeuble', 'rue', 'quartier', 'commune']),
    composantes: z.array(
      z.strictObject({
        code: z.enum(['localisation', 'comparables', 'dispersion', 'anciennete']),
        valeur: nOuNull,
        points: n,
        maximum: n,
        supposee: z.boolean(),
      }),
    ),
  }),
  marge: n,
  charges: z
    .strictObject({
      repereAnnuel: n,
      excedentAnnuel: n,
      rendementLocal: n,
      borneAtteinte: z.boolean(),
    })
    .nullable(),
  actualiseAu: z.string().nullable(),
  ecartPrix: n,
});

export const ResultatsSchema = z.strictObject({
  projet: ProjetSchema,
  achat: z.strictObject({
    prixAffiche: n,
    prixRetenu: n,
    negociationTaux: n,
    negociationMontant: n,
  }),
  financement: FinancementSchema,
  cashflow: CashflowSchema,
  fiscalite: FiscaliteResultatSchema,
  revente: ReventeResultatSchema,
  rendement: RendementSchema,
  estimation: EstimationResultatSchema.nullable(),
  verdict: VerdictSchema,
  scenarios: ScenariosSchema.nullable(),
  meta: z.strictObject({
    versionRegles: VersionReglesSchema,
    dateReference: z.string(),
    aConfirmer: z.array(z.string()),
    simplifications: z.array(z.string()),
  }),
});
