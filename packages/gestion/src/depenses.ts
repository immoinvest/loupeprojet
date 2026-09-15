import { z } from 'zod';

import { JourSchema, PeriodeSchema } from './dates';
import {
  CAPITAL_MAX_CENTIMES,
  CATEGORIES_DEPENSE,
  DUREE_PRET_MAX_MOIS,
  FREQUENCES,
  LIBELLE_DEPENSE_MAX,
  TAUX_PRET_MAX,
} from './regles-argent';
import { CentimesSchema } from './schemas';

/*
 * Dépenses et prêt d'un bien géré. Montants en centimes entiers, dates en jours civils ; ces objets
 * vivent dans leurs propres tables et routes (ADR-G24, G25), jamais dans l'état commun de Gérer.
 */

const IdentifiantSchema = z.string().min(1).max(100);
const HorodatageSchema = z.string().min(1).max(40);

export const CategorieDepenseSchema = z.enum(CATEGORIES_DEPENSE);
export const FrequenceSchema = z.enum(FREQUENCES);

/** Une dépense qui revient : sa fréquence, et le dernier jour où elle compte encore (facultatif). */
export const RecurrenceSchema = z.object({
  frequence: FrequenceSchema,
  jusquAu: JourSchema.optional(),
});

const champsDepense = {
  /** Le bien concerné ; absent pour une dépense commune à tous les biens. */
  bienId: IdentifiantSchema.optional(),
  categorie: CategorieDepenseSchema,
  montant: CentimesSchema.min(1),
  /** Le jour de la dépense, ou de sa première occurrence si elle revient. */
  date: JourSchema,
  libelle: z.string().trim().min(1).max(LIBELLE_DEPENSE_MAX).optional(),
  /** Charge récupérable sur le locataire (sert à la régularisation des charges). */
  recuperable: z.boolean(),
  recurrence: RecurrenceSchema.optional(),
};

const FIN_APRES_DATE = {
  message: 'La fin de la dépense ne peut pas précéder sa première date',
  path: ['recurrence', 'jusquAu'],
};
const finApresDate = (d: {
  readonly date: string;
  readonly recurrence?: { readonly jusquAu?: string | undefined } | undefined;
}): boolean => d.recurrence?.jusquAu === undefined || d.recurrence.jusquAu >= d.date;

/** Ce qu'on envoie pour ajouter ou modifier une dépense (la modification remplace tout). */
export const NouvelleDepenseSchema = z.object(champsDepense).refine(finApresDate, FIN_APRES_DATE);

export const DepenseSchema = z
  .object({
    id: IdentifiantSchema,
    ...champsDepense,
    creeLe: HorodatageSchema,
    modifieLe: HorodatageSchema,
  })
  .refine(finApresDate, FIN_APRES_DATE);

/** Le prêt d'un bien : amortissable dès la première échéance, assurance en euros par mois (ADR-G27). */
export const PretBienSchema = z.object({
  capital: z.number().int().min(1).max(CAPITAL_MAX_CENTIMES),
  /** Taux nominal annuel, en décimal (0,0335 pour 3,35 %). */
  tauxAnnuel: z.number().min(0).max(TAUX_PRET_MAX),
  dureeMois: z.number().int().min(1).max(DUREE_PRET_MAX_MOIS),
  /** Le mois de la première échéance. */
  debut: PeriodeSchema,
  assuranceMensuelle: CentimesSchema,
});

export const PretEnregistreSchema = PretBienSchema.extend({
  bienId: IdentifiantSchema,
  modifieLe: HorodatageSchema,
});

/** Ce que rend `GET /api/gestion/argent` : toutes les dépenses et tous les prêts du compte. */
export const EtatArgentSchema = z.object({
  depenses: z.array(DepenseSchema),
  prets: z.array(PretEnregistreSchema),
});

export type Recurrence = z.infer<typeof RecurrenceSchema>;
export type NouvelleDepense = z.infer<typeof NouvelleDepenseSchema>;
export type Depense = z.infer<typeof DepenseSchema>;
export type PretBien = z.infer<typeof PretBienSchema>;
export type PretEnregistre = z.infer<typeof PretEnregistreSchema>;
export type EtatArgent = z.infer<typeof EtatArgentSchema>;
