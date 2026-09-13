import { z } from 'zod';

export const ClasseEnergieSchema = z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
export type ClasseEnergie = z.infer<typeof ClasseEnergieSchema>;

export const TypeBienSchema = z.enum(['appartement', 'maison']);
export type TypeBien = z.infer<typeof TypeBienSchema>;

export const CoproSchema = z.object({
  lots: z.number().int().positive().optional(),
  procedure: z.boolean().default(false),
});

/** Le bien tel que décrit par l'annonce et les données publiques. */
export const BienSchema = z.object({
  type: TypeBienSchema,
  surface: z.number().positive(),
  pieces: z.number().int().positive(),
  chambres: z.number().int().nonnegative().optional(),
  etage: z.number().int().optional(),
  ascenseur: z.boolean().optional(),
  annee: z.number().int().min(1000).max(2100).optional(),
  dpe: ClasseEnergieSchema.optional(),
  ges: ClasseEnergieSchema.optional(),
  /** Numéro de département (« 13 », « 2A », « 976 ») : détermine les droits de mutation. */
  departement: z.string().regex(/^(\d{2,3}|2A|2B)$/),
  copro: CoproSchema.optional(),
});
export type Bien = z.infer<typeof BienSchema>;
