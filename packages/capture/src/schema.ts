// Import de l'espace de noms (et non de l'objet `z`) : les bundlers ne gardent alors que ce qui sert,
// sans les 40 locales de Zod (l'extension et le bouton-favori y gagnent 300 Ko).
import * as z from 'zod';

import { PortailSchema } from './portails';

/** Version du contrat : à incrémenter si un champ change de sens ou de type. */
export const VERSION_CAPTURE = 1;

/** La description sert à l'extraction par règles côté web, puis est jetée : inutile d'en porter plus. */
export const LONGUEUR_MAX_DESCRIPTION = 4_000;

export const ClasseEnergieCaptureSchema = z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
export type ClasseEnergieCapture = z.infer<typeof ClasseEnergieCaptureSchema>;

export const ModeCaptureSchema = z.enum(['extension', 'bookmarklet']);
export type ModeCapture = z.infer<typeof ModeCaptureSchema>;

export const TypeBienCaptureSchema = z.enum(['appartement', 'maison']);
export type TypeBienCapture = z.infer<typeof TypeBienCaptureSchema>;

/** Les champs lus sur la page, tous optionnels : ce que la page ne dit pas reste absent. */
export const ChampsCaptureSchema = z.object({
  id: z.string().trim().min(1).max(100).optional(),
  typeBien: TypeBienCaptureSchema.optional(),
  prix: z.number().positive().optional(),
  surface: z.number().positive().optional(),
  pieces: z.number().int().positive().optional(),
  chambres: z.number().int().nonnegative().optional(),
  ville: z.string().trim().min(1).max(80).optional(),
  codePostal: z
    .string()
    .regex(/^\d{5}$/)
    .optional(),
  adresse: z.string().trim().min(1).max(200).optional(),
  etage: z.number().int().min(-5).max(100).optional(),
  ascenseur: z.boolean().optional(),
  dpe: ClasseEnergieCaptureSchema.optional(),
  ges: ClasseEnergieCaptureSchema.optional(),
  /** Charges de copropriété, en euros par mois. */
  chargesCopro: z.number().nonnegative().optional(),
  /** Taxe foncière, en euros par an. */
  taxeFonciere: z.number().nonnegative().optional(),
  anneeConstruction: z.number().int().min(1000).max(2100).optional(),
  /** Nombre de lots de la copropriété. */
  lotsCopro: z.number().int().positive().max(10_000).optional(),
  /** Copropriété faisant l'objet d'une procédure (plan de sauvegarde, administration provisoire…). */
  coproEnProcedure: z.boolean().optional(),
  meuble: z.boolean().optional(),
  description: z.string().max(LONGUEUR_MAX_DESCRIPTION).optional(),
});
export type ChampsCapture = z.infer<typeof ChampsCaptureSchema>;
export type NomChampCapture = keyof ChampsCapture;

/**
 * Ce que l'extension ou le bouton-favori transmet au web dans le fragment d'URL.
 * Jamais le HTML de la page, jamais de donnée sur le visiteur : seulement l'annonce.
 */
export const CaptureSchema = ChampsCaptureSchema.extend({
  version: z.literal(VERSION_CAPTURE),
  portail: PortailSchema,
  url: z.url(),
  /** Instant de la lecture, ISO 8601 en UTC. */
  captureLe: z.iso.datetime(),
  mode: ModeCaptureSchema.optional(),
  /** Version du fichier de règles appliqué, ex. `leboncoin-2026-09-13`. */
  regles: z.string().min(1).max(60).optional(),
});
export type Capture = z.infer<typeof CaptureSchema>;
