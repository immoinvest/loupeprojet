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
import { versLocation, versPaiement, type Ligne, type Lier } from './lignes';

/** Borne contre l'abus du quota D1 : au-delà, un bien n'a pas une vraie histoire de locations. */
export const LIMITE_LOCATIONS_PAR_BIEN = 50;

const SQL = {
  location: 'select * from gestion_location where userId = ? and id = ?',
  paiements: 'select * from gestion_paiement where userId = ? and locationId = ?',
  colocataires:
    'select locataireId from gestion_colocataire where userId = ? and locationId = ? order by ordre',
  terminer: 'update gestion_location set fin = ? where userId = ? and id = ?',
  bien: 'select id from gestion_bien where userId = ? and id = ?',
  locationsDuBien:
    'select debut, fin, libelle from gestion_location where userId = ? and bienId = ?',
} as const;

async function lignes(lier: Lier, sql: string, ...valeurs: string[]): Promise<Ligne[]> {
  return (await lier(sql, ...valeurs).all<Ligne>()).results;
}

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
      const [ligne] = await lignes(lier, SQL.location, userId, locationId);
      if (ligne === undefined) throw new ErreurGestion('INTROUVABLE');
      const [colocataires, lus] = await Promise.all([
        lignes(lier, SQL.colocataires, userId, locationId),
        lignes(lier, SQL.paiements, userId, locationId),
      ]);
      const location = versLocation(
        ligne,
        colocataires.map((c) => String(c.locataireId)),
      );
      const paiements = lus.map(versPaiement);
      const refus = refusFin(location, fin, paiements);
      if (refus !== null) throw new ErreurGestion(refus);
      await lier(SQL.terminer, fin, userId, locationId).run();
      return LocationGereeSchema.parse({ ...location, fin });
    },

    louer: async (userId, bienId, occupation) => {
      const [bien] = await lignes(lier, SQL.bien, userId, bienId);
      if (bien === undefined) throw new ErreurGestion('INTROUVABLE');
      const existantes = (await lignes(lier, SQL.locationsDuBien, userId, bienId)).map((l) => ({
        debut: String(l.debut),
        ...(typeof l.fin === 'string' ? { fin: l.fin } : {}),
        ...(typeof l.libelle === 'string' ? { libelle: l.libelle } : {}),
      }));
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
