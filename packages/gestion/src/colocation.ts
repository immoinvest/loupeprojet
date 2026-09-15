import { z } from 'zod';

import { bornesPeriode, JourSchema } from './dates';
import { ajouterMoisAuJour } from './fin-bail';
import { COLOCATAIRES_MAX } from './regles';
import { SOLIDARITE_COLOCATAIRE } from './regles-fin-bail';
import { NouveauLocataireSchema, type LocationGeree } from './schemas';

/*
 * Changement de colocataire dans un bail unique (ADR-G13, G38) : un départ et une arrivée datés ; la
 * location continue et les documents des mois suivants nomment les présents.
 */

const IdentifiantSchema = z.string().min(1).max(100);
const HorodatageSchema = z.string().min(1).max(40);

export const SENS_MOUVEMENT = ['arrivee', 'depart'] as const;
export type SensMouvement = (typeof SENS_MOUVEMENT)[number];

export const MouvementColocationSchema = z.object({
  id: IdentifiantSchema,
  locationId: IdentifiantSchema,
  locataireId: IdentifiantSchema,
  sens: z.enum(SENS_MOUVEMENT),
  /** Arrivée : premier jour présent ; départ : dernier jour présent. */
  date: JourSchema,
  creeLe: HorodatageSchema,
});

export const ChangementColocataireSchema = z
  .object({
    depart: z.object({ locataireId: IdentifiantSchema, date: JourSchema }).optional(),
    arrivee: z.object({ locataire: NouveauLocataireSchema, date: JourSchema }).optional(),
  })
  .refine((c) => c.depart !== undefined || c.arrivee !== undefined, {
    message: 'Un départ ou une arrivée',
    path: ['depart'],
  });

export type MouvementColocation = z.infer<typeof MouvementColocationSchema>;
export type ChangementColocataire = z.infer<typeof ChangementColocataireSchema>;

type Bail = Pick<LocationGeree, 'id' | 'debut' | 'fin' | 'locataireId' | 'colocataireIds'>;

export interface Presence {
  readonly locataireId: string;
  readonly arrivee: string;
  readonly depart?: string;
}

/** Chaque locataire du bail, le locataire en titre d'abord : arrivé à l'entrée sauf mouvement, parti s'il y a un départ. */
export function presences(location: Bail, mouvements: readonly MouvementColocation[]): Presence[] {
  const siens = mouvements.filter((m) => m.locationId === location.id);
  const dernier = (locataireId: string, sens: SensMouvement): string | undefined =>
    siens
      .filter((m) => m.locataireId === locataireId && m.sens === sens)
      .map((m) => m.date)
      .sort()
      .at(-1);
  return [location.locataireId, ...location.colocataireIds].map((locataireId) => {
    const depart = dernier(locataireId, 'depart');
    return {
      locataireId,
      arrivee: dernier(locataireId, 'arrivee') ?? location.debut,
      ...(depart === undefined ? {} : { depart }),
    };
  });
}

function presentEntre(p: Presence, debut: string, fin: string): boolean {
  return p.arrivee <= fin && (p.depart === undefined || p.depart >= debut);
}

/** Les locataires présents au moins un jour du mois : ceux que la quittance nomme. */
export function locatairesDuMois(
  location: Bail,
  mouvements: readonly MouvementColocation[],
  periode: string,
): string[] {
  const mois = bornesPeriode(periode);
  return presences(location, mouvements)
    .filter((p) => presentEntre(p, mois.debut, mois.fin))
    .map((p) => p.locataireId);
}

/** Les locataires présents ce jour-là. */
export function locatairesLe(
  location: Bail,
  mouvements: readonly MouvementColocation[],
  jour: string,
): string[] {
  return presences(location, mouvements)
    .filter((p) => presentEntre(p, jour, jour))
    .map((p) => p.locataireId);
}

export type RefusColocataire =
  'HORS_LOCATION' | 'PAS_DANS_LE_BAIL' | 'DEJA_PARTI' | 'DERNIER_LOCATAIRE' | 'LIMITE_ATTEINTE';

/** Pourquoi ce changement est refusé, ou `null` : dates dans le bail, un locataire présent à remplacer, 10 colocataires au plus. */
export function refusChangementColocataire(
  location: Bail,
  mouvements: readonly MouvementColocation[],
  changement: ChangementColocataire,
): RefusColocataire | null {
  const dansLeBail = (date: string): boolean =>
    date >= location.debut && (location.fin === undefined || date <= location.fin);
  const { depart, arrivee } = changement;
  if (depart !== undefined) {
    if (!dansLeBail(depart.date)) return 'HORS_LOCATION';
    const liste = presences(location, mouvements);
    const qui = liste.find((p) => p.locataireId === depart.locataireId);
    if (qui === undefined) return 'PAS_DANS_LE_BAIL';
    if (qui.depart !== undefined) return 'DEJA_PARTI';
    if (depart.date < qui.arrivee) return 'HORS_LOCATION';
    const restants = liste.filter((p) => p.depart === undefined && p !== qui);
    if (restants.length === 0 && arrivee === undefined) return 'DERNIER_LOCATAIRE';
  }
  if (arrivee !== undefined) {
    if (!dansLeBail(arrivee.date)) return 'HORS_LOCATION';
    if (location.colocataireIds.length >= COLOCATAIRES_MAX) return 'LIMITE_ATTEINTE';
  }
  return null;
}

/**
 * Fin de la solidarité du colocataire qui part (art. 8-1 VI) : quand un nouveau colocataire figure au
 * bail, et au plus tard six mois après son départ.
 */
export function finSolidarite(departLe: string, arriveeLe: string | null): string {
  const auPlusTard = ajouterMoisAuJour(departLe, SOLIDARITE_COLOCATAIRE.moisMax);
  if (arriveeLe === null) return auPlusTard;
  const avecRemplacant = arriveeLe > departLe ? arriveeLe : departLe;
  return avecRemplacant < auPlusTard ? avecRemplacant : auPlusTard;
}
