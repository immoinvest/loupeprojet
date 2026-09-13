import { z } from 'zod';

export const NiveauRisqueSchema = z.enum(['faible', 'moyen', 'fort']);

export const RisqueSchema = z.object({
  type: z.string().min(1),
  niveau: NiveauRisqueSchema,
});
export type Risque = z.infer<typeof RisqueSchema>;

export const DvfSchema = z.object({
  medianM2: z.number().positive(),
  q1M2: z.number().positive().optional(),
  q3M2: z.number().positive().optional(),
  nombreVentes: z.number().int().nonnegative(),
  rayonMetres: z.number().positive().optional(),
});

/** Données de marché autour du bien. Tout est optionnel : le moteur sait calculer sans. */
export const MarcheSchema = z.object({
  dvf: DvfSchema.optional(),
  loyerReferenceM2: z.number().positive().optional(),
  plafondLoyerMensuel: z.number().positive().optional(),
  risques: z.array(RisqueSchema).default([]),
});
export type Marche = z.infer<typeof MarcheSchema>;
