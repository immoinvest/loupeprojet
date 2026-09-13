import { z } from 'zod';
import { CodeDepartementSchema, CodeInseeSchema, MetaSchema } from './meta.ts';

export const TypeLogementSchema = z.enum(['appartement', 'maison']);
export type TypeLogement = z.infer<typeof TypeLogementSchema>;

/** Une ligne du CSV `dvf/<millesime>/<codeInsee>.csv` ; coordonnées absentes quand la parcelle n'est pas géocodée. */
export const VenteSchema = z.object({
  date: z.iso.date(),
  prix: z.number().positive(),
  surface: z.number().positive(),
  type: TypeLogementSchema,
  pieces: z.number().int().nonnegative(),
  lat: z.number().min(-90).max(90).nullable(),
  lon: z.number().min(-180).max(180).nullable(),
  /** Parcelle cadastrale, même format que le cadastre IGN (14 caractères) : même parcelle = même immeuble. */
  idParcelle: z
    .string()
    .regex(/^[0-9A-Z]{14}$/)
    .nullable(),
  numero: z.number().int().nonnegative().nullable(),
  suffixe: z.string().min(1).nullable(),
  /** Code de la voie (FANTOIR), identique à celui de la clé BAN d'une adresse : même code = même rue. */
  codeVoie: z.string().min(1).nullable(),
  voie: z.string().min(1).nullable(),
  /** Surface Carrez du logement (somme de ses lots) quand l'acte la mentionne. */
  carrez: z.number().positive().nullable(),
});
export type Vente = z.infer<typeof VenteSchema>;

/** Colonnes du CSV des ventes ; les colonnes d'adresse ont été ajoutées à la fin (compatibles avec les anciens lecteurs). */
export const EN_TETE_VENTES = [
  'date',
  'prix',
  'surface',
  'type',
  'pieces',
  'lat',
  'lon',
  'idParcelle',
  'numero',
  'suffixe',
  'codeVoie',
  'voie',
  'carrez',
] as const;

/** Prix au m² d'un type de logement dans une commune : nombre de ventes, médiane, quartiles (en €/m² entiers). */
export const StatistiquesTypeSchema = z.object({
  ventes: z.number().int().positive(),
  medianeM2: z.number().positive(),
  q1M2: z.number().positive(),
  q3M2: z.number().positive(),
});
export type StatistiquesType = z.infer<typeof StatistiquesTypeSchema>;

export const StatistiquesCommuneSchema = z.object({
  appartement: StatistiquesTypeSchema.optional(),
  maison: StatistiquesTypeSchema.optional(),
});
export type StatistiquesCommune = z.infer<typeof StatistiquesCommuneSchema>;

export const FenetreSchema = z.object({
  debut: z.iso.date(),
  fin: z.iso.date(),
});
export type Fenetre = z.infer<typeof FenetreSchema>;

/** `dvf/<millesime>/index/<departement>.json` */
export const IndexDvfDepartementSchema = MetaSchema.extend({
  departement: CodeDepartementSchema,
  fenetre: FenetreSchema,
  communes: z.record(CodeInseeSchema, StatistiquesCommuneSchema),
});
export type IndexDvfDepartement = z.infer<typeof IndexDvfDepartementSchema>;

/** Médiane du prix au m² d'un semestre (`2024-S2`) et nombre de ventes qui la font. */
export const PointTendanceSchema = z.object({
  periode: z.string().regex(/^\d{4}-S[12]$/),
  ventes: z.number().int().positive(),
  medianeM2: z.number().positive(),
});
export type PointTendance = z.infer<typeof PointTendanceSchema>;

/** Séries semestrielles par type de logement ; un type absent n'a pas assez de ventes. */
export const SeriesTendanceSchema = z.object({
  appartement: z.array(PointTendanceSchema).min(2).optional(),
  maison: z.array(PointTendanceSchema).min(2).optional(),
});
export type SeriesTendance = z.infer<typeof SeriesTendanceSchema>;

/**
 * `dvf/<millesime>/tendance/<departement>.json` : évolution des prix sur cinq ans, pour remettre les ventes
 * passées à la date du dernier semestre connu. Séries du département, puis des communes assez actives.
 */
export const TendanceDvfDepartementSchema = MetaSchema.extend({
  departement: CodeDepartementSchema,
  seuilVentes: z.number().int().positive(),
  seriesDepartement: SeriesTendanceSchema,
  communes: z.record(CodeInseeSchema, SeriesTendanceSchema),
});
export type TendanceDvfDepartement = z.infer<typeof TendanceDvfDepartementSchema>;

/** `dvf/<millesime>/index.json` : fusion nationale, écrite seulement quand la passe couvre tous les départements. */
export const IndexDvfNationalSchema = MetaSchema.extend({
  departements: z.array(CodeDepartementSchema),
  communes: z.record(CodeInseeSchema, StatistiquesCommuneSchema),
});
export type IndexDvfNational = z.infer<typeof IndexDvfNationalSchema>;
