import type { D1PreparedStatement } from '@cloudflare/workers-types';
import {
  chevauche,
  LocationGereeSchema,
  refusFin,
  type LocationGeree,
  type NouvelleOccupation,
} from '@loupe/gestion';

import { ErreurGestion, type OccupationCreee } from './depot';
import type { Outils } from './depot-documents';
import { ecrireOccupation } from './ecritures';
import { lignes, lireLocation, lirePaiements } from './lecture';
import { versPeriode } from './lignes';

/** Borne contre l'abus du quota D1 : au-delà, un bien n'a pas une vraie histoire de locations. */
export const LIMITE_LOCATIONS_PAR_BIEN = 50;

const SQL = {
  terminer: 'update gestion_location set fin = ? where userId = ? and id = ?',
  bien: 'select id from gestion_bien where userId = ? and id = ?',
  locationsDuBien:
    'select debut, fin, libelle from gestion_location where userId = ? and bienId = ?',
} as const;

export interface OutilsBaux extends Outils {
  /** Écrit plusieurs instructions ensemble ou aucune (`D1Database.batch`). */
  readonly ensemble: (instructions: D1PreparedStatement[]) => Promise<unknown>;
}

export interface DepotBaux {
  readonly terminerLocation: (
    userId: string,
    locationId: string,
    fin: string,
  ) => Promise<LocationGeree>;
  readonly louer: (
    userId: string,
    bienId: string,
    occupation: NouvelleOccupation,
  ) => Promise<OccupationCreee>;
}

/** Fin d'une location et location d'un bien vacant. */
export function depotBaux(outils: OutilsBaux): DepotBaux {
  const { lier, maintenant, genererId, ensemble } = outils;

  return {
    terminerLocation: async (userId, locationId, fin) => {
      const location = await lireLocation(lier, userId, locationId);
      const refus = refusFin(location, fin, await lirePaiements(lier, userId, locationId));
      if (refus !== null) throw new ErreurGestion(refus);
      await lier(SQL.terminer, fin, userId, locationId).run();
      return LocationGereeSchema.parse({ ...location, fin });
    },

    louer: async (userId, bienId, occupation) => {
      const [bien] = await lignes(lier, SQL.bien, userId, bienId);
      if (bien === undefined) throw new ErreurGestion('INTROUVABLE');
      const existantes = (await lignes(lier, SQL.locationsDuBien, userId, bienId)).map(versPeriode);
      if (existantes.length >= LIMITE_LOCATIONS_PAR_BIEN) {
        throw new ErreurGestion('LIMITE_ATTEINTE');
      }
      if (chevauche(existantes, occupation.location)) throw new ErreurGestion('BIEN_OCCUPE');

      const { instructions, ...occupee } = ecrireOccupation(
        { lier, userId, bienId, horodatage: maintenant(), genererId },
        { ...occupation, colocataires: occupation.colocataires ?? [] },
      );
      await ensemble(instructions);
      return occupee;
    },
  };
}
