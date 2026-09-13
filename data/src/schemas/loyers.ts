import { z } from 'zod';
import { CodeDepartementSchema, CodeInseeSchema, MetaSchema } from './meta.ts';

/**
 * Indicateur ANIL : loyer en €/m² charges comprises d'un bien type loué vide, intervalle de prédiction,
 * `maille` quand la commune n'a pas d'annonce et hérite de l'estimation d'une maille plus large.
 */
export const IndicateurLoyerSchema = z.object({
  loyerM2: z.number().positive(),
  basM2: z.number().positive(),
  hautM2: z.number().positive(),
  maille: z.boolean(),
  observations: z.number().int().nonnegative(),
});
export type IndicateurLoyer = z.infer<typeof IndicateurLoyerSchema>;

export const TYPES_INDICATEUR_LOYER = [
  'appartement',
  'appartementT1T2',
  'appartementT3Plus',
  'maison',
] as const;
export type TypeIndicateurLoyer = (typeof TYPES_INDICATEUR_LOYER)[number];

export const LoyersCommuneSchema = z.object({
  appartement: IndicateurLoyerSchema.optional(),
  appartementT1T2: IndicateurLoyerSchema.optional(),
  appartementT3Plus: IndicateurLoyerSchema.optional(),
  maison: IndicateurLoyerSchema.optional(),
});
export type LoyersCommune = z.infer<typeof LoyersCommuneSchema>;

/** `loyers/<millesime>/<departement>.json` */
export const LoyersDepartementSchema = MetaSchema.extend({
  departement: CodeDepartementSchema,
  communes: z.record(CodeInseeSchema, LoyersCommuneSchema),
});
export type LoyersDepartement = z.infer<typeof LoyersDepartementSchema>;
