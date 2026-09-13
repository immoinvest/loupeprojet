import { z } from 'zod';
import { CodeDepartementSchema, CodeInseeSchema, MetaSchema } from './meta.ts';

/** Une commune ou un arrondissement municipal (Paris, Lyon, Marseille), rattaché alors à `communeParente`. */
export const CommuneSchema = z.object({
  nom: z.string().min(1),
  codesPostaux: z.array(z.string().regex(/^\d{5}$/)),
  population: z.number().int().nonnegative().optional(),
  epci: z
    .string()
    .regex(/^\d{9}$/)
    .optional(),
  communeParente: CodeInseeSchema.optional(),
});
export type Commune = z.infer<typeof CommuneSchema>;

/** `communes/<departement>.json` */
export const CommunesDepartementSchema = MetaSchema.extend({
  departement: CodeDepartementSchema,
  communes: z.record(CodeInseeSchema, CommuneSchema),
});
export type CommunesDepartement = z.infer<typeof CommunesDepartementSchema>;
