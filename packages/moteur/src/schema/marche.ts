import { z } from 'zod';

export const NiveauRisqueSchema = z.enum(['faible', 'moyen', 'fort']);

export const RisqueSchema = z.object({
  type: z.string().min(1),
  niveau: NiveauRisqueSchema,
});
export type Risque = z.infer<typeof RisqueSchema>;

/** D'où viennent les ventes du repère : même immeuble, même rue, quartier (cercle), commune ou arrondissement. */
export const PrecisionDvfSchema = z.enum(['immeuble', 'rue', 'quartier', 'commune']);
export type PrecisionDvf = z.infer<typeof PrecisionDvfSchema>;

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

export const DvfSchema = z.object({
  medianM2: z.number().positive(),
  q1M2: z.number().positive().optional(),
  q3M2: z.number().positive().optional(),
  nombreVentes: z.number().int().nonnegative(),
  rayonMetres: z.number().positive().optional(),
  /** Semestre auquel les prix ont été ramenés par la tendance locale (`2025-S1`) ; absent = prix des actes. */
  actualiseAu: z
    .string()
    .regex(/^\d{4}-S[12]$/)
    .optional(),
  /** Absente : déduite du rayon (quartier quand il est connu, commune sinon). */
  precision: PrecisionDvfSchema.optional(),
  /** Mois écoulés depuis la vente médiane au moment où le repère a été lu ; absente : supposée par les règles. */
  ancienneteMedianeMois: z.number().int().nonnegative().optional(),
  /** Dates de la première et de la dernière vente du repère. */
  periode: z
    .object({ debut: z.string().regex(DATE_ISO), fin: z.string().regex(DATE_ISO) })
    .optional(),
  /** Nom de la commune ou de l'arrondissement d'un repère de commune. */
  lieu: z.string().min(1).max(120).optional(),
});
export type Dvf = z.infer<typeof DvfSchema>;

/** Données de marché autour du bien. Tout est optionnel : le moteur sait calculer sans. */
export const MarcheSchema = z.object({
  dvf: DvfSchema.optional(),
  loyerReferenceM2: z.number().positive().optional(),
  plafondLoyerMensuel: z.number().positive().optional(),
  risques: z.array(RisqueSchema).default([]),
});
export type Marche = z.infer<typeof MarcheSchema>;
