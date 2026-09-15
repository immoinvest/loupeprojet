import { z } from 'zod';

import { ajouterJours, JourSchema, periodeDe } from './dates';
import { ajouterMoisAuJour } from './fin-bail';
import { montantsDuMois } from './montants';
import type { TypeLocation } from './regles';
import type { FormeBail } from './regles-bail';
import {
  DEPOT_MAXIMUM_MOIS,
  MOTIF_RETENUE_MAX,
  RAPPEL_DEPOT_JOURS,
  RESTITUTION_DEPOT,
  RETENUES_MAX,
} from './regles-fin-bail';
import { CentimesSchema, type LocationGeree } from './schemas';

/*
 * Dépôt de garantie (loi n° 89-462, art. 22, 25-6, 25-13) : plafond à la saisie, restitution après la
 * sortie, date limite, rappel et majoration de retard calculés à l'affichage (ADR-G36).
 */

const IdentifiantSchema = z.string().min(1).max(100);
const HorodatageSchema = z.string().min(1).max(40);

/** Le dépôt maximal : 1 mois de loyer hors charges en vide, 2 en meublé, aucun en bail mobilité. */
export function depotMaximum(
  type: TypeLocation,
  formeBail: FormeBail,
  loyerHorsCharges: number,
): number {
  return loyerHorsCharges * DEPOT_MAXIMUM_MOIS[formeBail === 'mobilite' ? 'mobilite' : type];
}

/** Un dépôt saisi au-dessus du maximum légal ? (les formulaires refusent, les données existantes sont signalées) */
export function depotTropEleve(
  type: TypeLocation,
  formeBail: FormeBail,
  loyerHorsCharges: number,
  depot: number,
): boolean {
  return depot > depotMaximum(type, formeBail, loyerHorsCharges);
}

export const RetenueSchema = z.object({
  motif: z.string().trim().min(1).max(MOTIF_RETENUE_MAX),
  montant: CentimesSchema.min(1),
});

const champsSaisie = {
  /** Jour de la remise des clés : le délai de restitution en part. */
  clesLe: JourSchema,
  /** État des lieux de sortie conforme à celui d'entrée. */
  conforme: z.boolean(),
  retenues: z.array(RetenueSchema).max(RETENUES_MAX),
};

export const RestitutionSaisieSchema = z
  .object(champsSaisie)
  .refine((s) => !s.conforme || s.retenues.length === 0, {
    message: 'Un état des lieux conforme ne donne lieu à aucune retenue',
    path: ['retenues'],
  })
  .refine((s) => s.conforme || s.retenues.length > 0, {
    message: 'Indique au moins une retenue',
    path: ['retenues'],
  });

export const RestitutionSchema = z.object({
  locationId: IdentifiantSchema,
  ...champsSaisie,
  /** Le dépôt de la location au jour de l'enregistrement. */
  depot: CentimesSchema,
  aRendre: CentimesSchema,
  dateLimite: JourSchema,
  decompteId: IdentifiantSchema,
  rendueLe: JourSchema.nullable(),
  modifieLe: HorodatageSchema,
});

export const RenduDepotSchema = z.object({ rendueLe: JourSchema });

export type Retenue = z.infer<typeof RetenueSchema>;
export type RestitutionSaisie = z.infer<typeof RestitutionSaisieSchema>;
export type Restitution = z.infer<typeof RestitutionSchema>;

export function totalRetenues(retenues: readonly Pick<Retenue, 'montant'>[]): number {
  return retenues.reduce((somme, r) => somme + r.montant, 0);
}

/** 1 mois après la remise des clés si l'état des lieux est conforme, 2 mois sinon. */
export function dateLimiteRestitution(clesLe: string, conforme: boolean): string {
  return ajouterMoisAuJour(
    clesLe,
    conforme ? RESTITUTION_DEPOT.conformeMois : RESTITUTION_DEPOT.retenuesMois,
  );
}

export type RefusRestitution = 'LOCATION_EN_COURS' | 'DATE_INVALIDE' | 'RETENUES_TROP_ELEVEES';

/** Pourquoi cette restitution est refusée : sortie inconnue, clés remises hors du bail ou demain, retenues > dépôt. */
export function refusRestitution(
  location: Pick<LocationGeree, 'debut' | 'fin' | 'depot'>,
  saisie: RestitutionSaisie,
  aujourdhui: string,
): RefusRestitution | null {
  if (location.fin === undefined) return 'LOCATION_EN_COURS';
  if (saisie.clesLe > aujourdhui || saisie.clesLe < location.debut) return 'DATE_INVALIDE';
  return totalRetenues(saisie.retenues) > location.depot ? 'RETENUES_TROP_ELEVEES' : null;
}

export interface Majoration {
  /** Périodes mensuelles commencées après la date limite. */
  readonly moisCommences: number;
  readonly montant: number;
}

const SANS_MAJORATION: Majoration = { moisCommences: 0, montant: 0 };

/** 10 % du loyer mensuel en principal par période mensuelle commencée en retard, au jour dit. */
export function majorationRetard(
  loyerMensuel: number,
  dateLimite: string,
  jour: string,
): Majoration {
  if (jour <= dateLimite) return SANS_MAJORATION;
  let moisCommences = 1;
  while (ajouterMoisAuJour(dateLimite, moisCommences) < jour) moisCommences += 1;
  const parMois = Math.round((loyerMensuel * RESTITUTION_DEPOT.majorationPourcent) / 100);
  return { moisCommences, montant: parMois * moisCommences };
}

export type StatutDepot = 'sans_depot' | 'en_cours' | 'a_rendre' | 'rendu';

export interface SuiviDepot {
  readonly statut: StatutDepot;
  /** La date limite de restitution, ou `null` tant que le locataire est là. */
  readonly dateLimite: string | null;
  /** Sans restitution enregistrée, la limite est celle du délai court (1 mois après la sortie). */
  readonly supposee: boolean;
  readonly aRendre: number;
  /** À partir d'une semaine avant la limite, tant que ce n'est pas rendu. */
  readonly rappel: boolean;
  readonly enRetard: boolean;
  /** Au jour de lecture, ou au jour du rendu s'il est passé. */
  readonly majoration: Majoration;
}

type LocationDuDepot = Pick<
  LocationGeree,
  'depot' | 'fin' | 'loyerHorsCharges' | 'charges' | 'apl' | 'changements'
>;

/** Où en est le dépôt d'une location ; rien n'est stocké hors de la restitution enregistrée. */
export function suiviDepot(
  location: LocationDuDepot,
  restitution: Restitution | undefined,
  aujourdhui: string,
): SuiviDepot {
  const base = { supposee: false, rappel: false, enRetard: false, majoration: SANS_MAJORATION };
  if (location.depot === 0) return { ...base, statut: 'sans_depot', dateLimite: null, aRendre: 0 };
  const { fin } = location;
  const sortie = restitution?.clesLe ?? (fin !== undefined && fin < aujourdhui ? fin : undefined);
  if (sortie === undefined) {
    return { ...base, statut: 'en_cours', dateLimite: null, aRendre: location.depot };
  }
  const dateLimite = restitution?.dateLimite ?? dateLimiteRestitution(sortie, true);
  const aRendre = restitution?.aRendre ?? location.depot;
  const loyer = montantsDuMois(location, periodeDe(sortie)).loyerHorsCharges;
  const rendueLe = restitution?.rendueLe ?? null;
  const jour = rendueLe ?? aujourdhui;
  // La majoration porte sur le dépôt restant dû : rien quand les retenues l'absorbent.
  const majoration = aRendre === 0 ? SANS_MAJORATION : majorationRetard(loyer, dateLimite, jour);
  if (rendueLe !== null) {
    return { ...base, statut: 'rendu', dateLimite, aRendre, majoration };
  }
  return {
    statut: 'a_rendre',
    dateLimite,
    supposee: restitution === undefined,
    aRendre,
    rappel: aujourdhui >= ajouterJours(dateLimite, -RAPPEL_DEPOT_JOURS),
    enRetard: aujourdhui > dateLimite,
    majoration,
  };
}
