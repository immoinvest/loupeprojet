import { z } from 'zod';

/**
 * Contrats de lecture des fichiers publiés par `data/` (schémas de référence : `data/src/schemas/`).
 * Volontairement tolérants (clés inconnues ignorées) : un champ ajouté côté données ne casse pas le Worker.
 */
export const SourceSchema = z.object({
  nom: z.string(),
  url: z.string(),
  licence: z.string(),
  mention: z.string().optional(),
});
export type Source = z.infer<typeof SourceSchema>;

export const CourantSchema = z.object({ millesime: z.string().min(1) });

const MetaSchema = z.object({ millesime: z.string().min(1), source: SourceSchema });

export const TypeLogementSchema = z.enum(['appartement', 'maison']);
export type TypeLogement = z.infer<typeof TypeLogementSchema>;

const StatistiquesSchema = z.object({
  ventes: z.number().int().positive(),
  medianeM2: z.number().positive(),
  q1M2: z.number().positive(),
  q3M2: z.number().positive(),
});
export type Statistiques = z.infer<typeof StatistiquesSchema>;

export const IndexDvfSchema = MetaSchema.extend({
  fenetre: z.object({ debut: z.string(), fin: z.string() }),
  communes: z.record(
    z.string(),
    z.object({ appartement: StatistiquesSchema.optional(), maison: StatistiquesSchema.optional() }),
  ),
});
export type IndexDvf = z.infer<typeof IndexDvfSchema>;

const IndicateurSchema = z.object({
  loyerM2: z.number().positive(),
  basM2: z.number().positive(),
  hautM2: z.number().positive(),
  maille: z.boolean(),
  observations: z.number().int().nonnegative(),
});
export type Indicateur = z.infer<typeof IndicateurSchema>;

export const INDICATEURS = [
  'appartement',
  'appartementT1T2',
  'appartementT3Plus',
  'maison',
] as const;
export type NomIndicateur = (typeof INDICATEURS)[number];

export const LoyersSchema = MetaSchema.extend({
  communes: z.record(z.string(), z.partialRecord(z.enum(INDICATEURS), IndicateurSchema)),
});
export type Loyers = z.infer<typeof LoyersSchema>;

export const ZoneSchema = z.enum(['Abis', 'A', 'B1', 'B2', 'C']);
export type Zone = z.infer<typeof ZoneSchema>;

export const ZonageSchema = MetaSchema.extend({ communes: z.record(z.string(), ZoneSchema) });
export type Zonage = z.infer<typeof ZonageSchema>;

export const CommunesSchema = MetaSchema.extend({
  communes: z.record(
    z.string(),
    z.object({
      nom: z.string(),
      codesPostaux: z.array(z.string()),
      communeParente: z.string().optional(),
    }),
  ),
});
export type Communes = z.infer<typeof CommunesSchema>;

/** « 13205 » → « 13 », « 2A004 » → « 2A », « 97411 » → « 974 ». */
export function departementDe(codeInsee: string): string {
  return codeInsee.startsWith('97') ? codeInsee.slice(0, 3) : codeInsee.slice(0, 2);
}

/** Millésimes DVF à essayer quand `dvf/courant.json` manque (passe partielle) : l'année en cours et les deux précédentes. */
export function millesimesDvfCandidats(maintenant: number): readonly string[] {
  const annee = new Date(maintenant).getUTCFullYear();
  return [annee, annee - 1, annee - 2].map(String);
}
