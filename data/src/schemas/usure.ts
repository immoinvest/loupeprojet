import { z } from 'zod';
import { MetaSchema, SourceSchema, TauxDecimalSchema } from './meta.ts';

/** Catégories de crédits immobiliers aux particuliers (arrêté du 29 juin 2022). */
export const SeuilsUsureSchema = z.object({
  fixeMoins10Ans: TauxDecimalSchema,
  fixe10a20Ans: TauxDecimalSchema,
  fixe20AnsEtPlus: TauxDecimalSchema,
  variable: TauxDecimalSchema,
  relais: TauxDecimalSchema,
});
export type SeuilsUsure = z.infer<typeof SeuilsUsureSchema>;

export const TrimestreSchema = z.string().regex(/^\d{4}-T[1-4]$/);

/** Fichier saisi à la main dans `data/sources/usure/<trimestre>.json` depuis la publication de la Banque de France. */
export const SaisieUsureSchema = z.object({
  trimestre: TrimestreSchema,
  applicableDu: z.iso.date(),
  publieLe: z.iso.date(),
  source: SourceSchema,
  tauxEffectifsMoyens: SeuilsUsureSchema,
  seuils: SeuilsUsureSchema,
});
export type SaisieUsure = z.infer<typeof SaisieUsureSchema>;

/** `usure/<trimestre>.json` et `usure/courant.json` ; `perime` : un trimestre plus récent devrait exister. */
export const UsurePublieeSchema = MetaSchema.extend({
  trimestre: TrimestreSchema,
  applicableDu: z.iso.date(),
  publieLe: z.iso.date(),
  tauxEffectifsMoyens: SeuilsUsureSchema,
  seuils: SeuilsUsureSchema,
  perime: z.boolean(),
});
export type UsurePubliee = z.infer<typeof UsurePublieeSchema>;
