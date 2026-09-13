import { z } from 'zod';

/** Provenance affichée dans l'application : nom du jeu, URL exacte, licence, mention imposée éventuelle. */
export const SourceSchema = z.object({
  nom: z.string().min(1),
  url: z.url(),
  licence: z.string().min(1),
  mention: z.string().min(1).optional(),
});
export type Source = z.infer<typeof SourceSchema>;

/** En-tête commun à tous les fichiers publiés : date de génération et millésime de la donnée source. */
export const MetaSchema = z.object({
  genereLe: z.iso.datetime(),
  millesime: z.string().min(1),
  source: SourceSchema,
});
export type Meta = z.infer<typeof MetaSchema>;

/** `<source>/courant.json` : le millésime à lire aujourd'hui, pour que l'application ne devine pas l'année. */
export const MillesimeCourantSchema = z.object({
  genereLe: z.iso.datetime(),
  millesime: z.string().min(1),
});
export type MillesimeCourant = z.infer<typeof MillesimeCourantSchema>;

/** Code INSEE : cinq chiffres, ou 2A/2B suivis de trois chiffres en Corse. */
export const CodeInseeSchema = z.string().regex(/^(\d{5}|2[AB]\d{3})$/);

/** Code département : 01 à 95, 2A, 2B, 971 à 976. */
export const CodeDepartementSchema = z.string().regex(/^(\d{2}|2[AB]|97[1-6])$/);

/** Taux exprimé en décimal (0,0529 pour 5,29 %). */
export const TauxDecimalSchema = z.number().min(0).max(2);
