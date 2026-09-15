import type { D1PreparedStatement } from '@cloudflare/workers-types';
import {
  LocataireSchema,
  LocationGereeSchema,
  type Locataire,
  type LocationGeree,
  type NouveauLocataire,
  type Occupation,
} from '@loupe/gestion';

import type { Lier } from './lignes';

const SQL = {
  insererLocataire:
    'insert into gestion_locataire (id, userId, prenom, nom, email, creeLe) values (?, ?, ?, ?, ?, ?)',
  insererLocation:
    'insert into gestion_location (id, userId, bienId, locataireId, libelle, type, debut, fin, jourLoyer, loyerHorsCharges, charges, apl, depot, creeLe) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  insererColocataire:
    'insert into gestion_colocataire (locationId, locataireId, userId, ordre) values (?, ?, ?, ?)',
} as const;

export interface ContexteEcriture {
  readonly lier: Lier;
  readonly userId: string;
  readonly bienId: string;
  readonly horodatage: string;
  readonly genererId: () => string;
}

/** Ce qui sera enregistré, et les instructions qui l'écrivent d'un bloc (`D1Database.batch`). */
export interface OccupationAEcrire {
  readonly locataire: Locataire;
  readonly location: LocationGeree;
  readonly colocataires: Locataire[];
  readonly instructions: D1PreparedStatement[];
}

/**
 * Le locataire en titre, ses colocataires et la location d'un bien, partagés par la création d'un
 * bien loué et la location d'un bien existant (ADR-G13 : les colocataires dans gestion_colocataire).
 * La location rendue a la forme que l'état relira : aide à 0 si absente, aucun changement (ADR-G14).
 */
export function ecrireOccupation(
  contexte: ContexteEcriture,
  occupation: Occupation,
): OccupationAEcrire {
  const { lier, userId, bienId, horodatage, genererId } = contexte;
  const enregistrer = (nouveau: NouveauLocataire): Locataire =>
    LocataireSchema.parse({ id: genererId(), ...nouveau, creeLe: horodatage });
  const locataire = enregistrer(occupation.locataire);
  const colocataires = occupation.colocataires.map(enregistrer);
  const location = LocationGereeSchema.parse({
    id: genererId(),
    bienId,
    locataireId: locataire.id,
    colocataireIds: colocataires.map((c) => c.id),
    ...occupation.location,
    apl: occupation.location.apl ?? 0,
    changements: [],
    creeLe: horodatage,
  });
  return {
    locataire,
    location,
    colocataires,
    instructions: [
      ...[locataire, ...colocataires].map((l) =>
        lier(SQL.insererLocataire, l.id, userId, l.prenom, l.nom, l.email, l.creeLe),
      ),
      lier(
        SQL.insererLocation,
        location.id,
        userId,
        location.bienId,
        location.locataireId,
        location.libelle,
        location.type,
        location.debut,
        location.fin,
        location.jourLoyer,
        location.loyerHorsCharges,
        location.charges,
        location.apl,
        location.depot,
        location.creeLe,
      ),
      ...colocataires.map((c, i) => lier(SQL.insererColocataire, location.id, c.id, userId, i + 1)),
    ],
  };
}
