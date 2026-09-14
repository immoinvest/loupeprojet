import { z } from 'zod';

export const ClasseEnergieSchema = z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
export type ClasseEnergie = z.infer<typeof ClasseEnergieSchema>;

export const TypeBienSchema = z.enum(['appartement', 'maison']);
export type TypeBien = z.infer<typeof TypeBienSchema>;

/** État du bien, de l'annonce ou de la visite : place son prix dans la fourchette des ventes comparables. */
export const EtatBienSchema = z.enum(['a_renover', 'a_rafraichir', 'bon_etat', 'renove']);
export type EtatBien = z.infer<typeof EtatBienSchema>;

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
  etat: EtatBienSchema.optional(),
  /** Balcon, terrasse ou loggia. */
  exterieur: z.boolean().optional(),
  /** Vendu loué : un locataire est en place à la vente. */
  venduLoue: z.boolean().optional(),
  /** Numéro de département (« 13 », « 2A », « 976 ») : détermine les droits de mutation. */
  departement: z.string().regex(/^(\d{2,3}|2A|2B)$/),
  copro: CoproSchema.optional(),
});
export type Bien = z.infer<typeof BienSchema>;
