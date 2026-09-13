import { z } from 'zod';
import { CodeDepartementSchema, CodeInseeSchema, MetaSchema } from './meta.ts';

/** Zones du zonage ABC, de la plus tendue à la moins tendue. */
export const ZoneAbcSchema = z.enum(['Abis', 'A', 'B1', 'B2', 'C']);
export type ZoneAbc = z.infer<typeof ZoneAbcSchema>;

/** `zonage/<departement>.json` */
export const ZonageDepartementSchema = MetaSchema.extend({
  departement: CodeDepartementSchema,
  communes: z.record(CodeInseeSchema, ZoneAbcSchema),
});
export type ZonageDepartement = z.infer<typeof ZonageDepartementSchema>;
