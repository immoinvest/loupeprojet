import { z } from 'zod';
import { CodeDepartementSchema, CodeInseeSchema, MetaSchema, TauxDecimalSchema } from './meta.ts';

/**
 * Taux de taxe foncière sur les propriétés bâties, en décimal. `total` additionne les cinq postes
 * qui pèsent sur le propriétaire ; la TEOM, récupérable sur le locataire, est donnée à part.
 */
export const TauxTaxeFonciereSchema = z.object({
  commune: TauxDecimalSchema,
  syndicats: TauxDecimalSchema,
  intercommunalite: TauxDecimalSchema,
  gemapi: TauxDecimalSchema,
  tse: TauxDecimalSchema,
  total: TauxDecimalSchema,
  teom: TauxDecimalSchema.optional(),
});
export type TauxTaxeFonciere = z.infer<typeof TauxTaxeFonciereSchema>;

/** `taxe-fonciere/<annee>/<departement>.json` */
export const TaxeFonciereDepartementSchema = MetaSchema.extend({
  departement: CodeDepartementSchema,
  communes: z.record(CodeInseeSchema, TauxTaxeFonciereSchema),
});
export type TaxeFonciereDepartement = z.infer<typeof TaxeFonciereDepartementSchema>;
