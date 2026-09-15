import { z } from 'zod';

import { MouvementColocationSchema } from './colocation';
import { DecompteCompletSchema, DecompteSchema } from './decomptes';
import { RestitutionSchema } from './depot-garantie';
import { CongeSchema } from './fin-bail';
import { ModeChargesLocationSchema, RegularisationSchema } from './regularisation';
import { LocataireSchema, LocationGereeSchema } from './schemas';

/** Tout ce que `/api/gestion/fin-bail` rend pour un compte, et les réponses de ses écritures (ADR-G34). */

export const EtatFinBailSchema = z.object({
  conges: z.array(CongeSchema),
  charges: z.array(ModeChargesLocationSchema),
  restitutions: z.array(RestitutionSchema),
  regularisations: z.array(RegularisationSchema),
  mouvements: z.array(MouvementColocationSchema),
  decomptes: z.array(DecompteSchema),
});

/** Le congé enregistré et la location à sa nouvelle sortie. */
export const CongeEnregistreSchema = z.object({
  conge: CongeSchema,
  location: LocationGereeSchema,
});

/** Le congé annulé : la location sans sortie. */
export const CongeRetireSchema = z.object({ location: LocationGereeSchema });

export const RestitutionEnregistreeSchema = z.object({
  restitution: RestitutionSchema,
  decompte: DecompteCompletSchema,
});

export const RegularisationValideeSchema = z.object({
  regularisation: RegularisationSchema,
  decompte: DecompteCompletSchema,
});

/** La location (colocataires à jour), le locataire arrivé s'il y en a un, et les mouvements écrits. */
export const ColocataireChangeSchema = z.object({
  location: LocationGereeSchema,
  locataire: LocataireSchema.nullable(),
  mouvements: z.array(MouvementColocationSchema),
});

export type EtatFinBail = z.infer<typeof EtatFinBailSchema>;
export type CongeEnregistre = z.infer<typeof CongeEnregistreSchema>;
export type CongeRetire = z.infer<typeof CongeRetireSchema>;
export type RestitutionEnregistree = z.infer<typeof RestitutionEnregistreeSchema>;
export type RegularisationValidee = z.infer<typeof RegularisationValideeSchema>;
export type ColocataireChange = z.infer<typeof ColocataireChangeSchema>;

export const ETAT_FIN_BAIL_VIDE: EtatFinBail = {
  conges: [],
  charges: [],
  restitutions: [],
  regularisations: [],
  mouvements: [],
  decomptes: [],
};
