import { z } from 'zod';

const taux = (max: number): z.ZodNumber => z.number().min(0).max(max);
const montant = (): z.ZodNumber => z.number().nonnegative();

export const AchatSchema = z.object({
  /** Prix affiché, honoraires d'agence inclus s'ils sont à la charge de l'acquéreur. */
  prix: z.number().positive(),
  honorairesAgence: montant().default(0),
  honorairesChargeAcquereur: z.boolean().default(true),
  travaux: montant().default(0),
  travauxRenovationEnergetique: z.boolean().default(false),
  mobilier: montant().default(0),
  /** Taux DMTO imposé (sinon déduit du département). */
  dmtoTaux: taux(0.1).optional(),
});

export const PretSchema = z
  .object({
    apport: montant().default(0),
    tauxNominal: taux(0.2),
    dureeAnnees: z.number().int().min(1).max(30),
    /** En proportion du capital initial, par an. */
    tauxAssurance: taux(0.02).default(0.0025),
    fraisDossier: montant().default(0),
    fraisGarantie: montant().default(0),
    differeTotalMois: z.number().int().nonnegative().default(0),
    differePartielMois: z.number().int().nonnegative().default(0),
  })
  .refine((p) => p.differeTotalMois + p.differePartielMois < p.dureeAnnees * 12, {
    message: 'Le différé doit être plus court que le prêt',
    path: ['differeTotalMois'],
  });

export const ModeLocationSchema = z.enum(['meuble_lld', 'nu', 'courte_duree']);
export type ModeLocation = z.infer<typeof ModeLocationSchema>;

export const CourteDureeSchema = z.object({
  nuitee: z.number().positive(),
  tauxOccupation: taux(1),
  fraisMenageParNuit: montant().default(0),
  conciergerieTaux: taux(1).default(0),
  tourismeClasse: z.boolean().default(false),
});

export const LocationSchema = z
  .object({
    mode: ModeLocationSchema,
    /** Loyer mensuel hors charges dans le mode choisi (meublé ou courte durée : équivalent mensuel ignoré). */
    loyerHc: montant(),
    /** Loyer mensuel hors charges si le bien était loué nu (défaut : déduit de la prime meublé). */
    loyerHcNu: montant().optional(),
    chargesLocataire: montant().default(0),
    vacanceSemaines: z.number().min(0).max(52).default(3),
    gestionTaux: taux(1).default(0),
    courteDuree: CourteDureeSchema.optional(),
  })
  .refine((l) => l.mode !== 'courte_duree' || l.courteDuree !== undefined, {
    message: 'Le mode courte durée exige les hypothèses de nuitée et d’occupation',
    path: ['courteDuree'],
  });

export const ChargesSchema = z.object({
  taxeFonciere: montant().default(0),
  coproAnnuel: montant().default(0),
  pno: montant().default(0),
  comptable: montant().default(0),
  cfe: montant().default(0),
  /** Provision annuelle d'entretien, en proportion du prix. */
  entretienTaux: taux(0.05).default(0.005),
});

export const RegimeSchema = z.enum(['micro_bic', 'lmnp_reel', 'micro_foncier', 'nu_reel']);
export type Regime = z.infer<typeof RegimeSchema>;

export const TmiSchema = z.union([
  z.literal(0),
  z.literal(0.11),
  z.literal(0.3),
  z.literal(0.41),
  z.literal(0.45),
]);

export const FiscaliteSchema = z.object({
  tmi: TmiSchema,
  psBic: taux(0.3).default(0.186),
  psFoncier: taux(0.3).default(0.172),
  regime: RegimeSchema,
});

export const ReventeSchema = z.object({
  annees: z.number().int().min(1).max(30).default(10),
  evolutionAnnuelle: z.number().min(-0.2).max(0.2).default(0.015),
  fraisAgenceTaux: taux(0.15).default(0.04),
  diagnostics: montant().default(500),
});

export const HypothesesSchema = z.object({
  achat: AchatSchema,
  pret: PretSchema,
  location: LocationSchema,
  charges: ChargesSchema.prefault({}),
  fiscalite: FiscaliteSchema,
  revente: ReventeSchema.prefault({}),
  /** Revenus nets mensuels du ménage, pour le taux d'effort. */
  revenusMensuels: montant(),
});
export type Hypotheses = z.infer<typeof HypothesesSchema>;
export type HypothesesEntree = z.input<typeof HypothesesSchema>;
