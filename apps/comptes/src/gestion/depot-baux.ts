import type { D1PreparedStatement } from '@cloudflare/workers-types';
import {
  chevauche,
  LocataireSchema,
  LocationGereeSchema,
  refusFin,
  type LocationGeree,
  type NouvelleOccupation,
} from '@loupe/gestion';

import { ErreurGestion, type OccupationCreee } from './depot';
import type { Outils } from './depot-documents';
import { versLocation, versPaiement, type Ligne, type Lier } from './lignes';

/** Borne contre l'abus du quota D1 : au-delà, un bien n'a pas une vraie histoire de locations. */
export const LIMITE_LOCATIONS_PAR_BIEN = 50;

const SQL = {
  location: 'select * from gestion_location where userId = ? and id = ?',
  paiements: 'select * from gestion_paiement where userId = ? and locationId = ?',
  terminer: 'update gestion_location set fin = ? where userId = ? and id = ?',
  bien: 'select id from gestion_bien where userId = ? and id = ?',
  locationsDuBien: 'select debut, fin from gestion_location where userId = ? and bienId = ?',
  insererLocataire:
    'insert into gestion_locataire (id, userId, prenom, nom, email, creeLe) values (?, ?, ?, ?, ?, ?)',
  insererLocation:
    'insert into gestion_location (id, userId, bienId, locataireId, type, debut, fin, jourLoyer, loyerHorsCharges, charges, depot, creeLe) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
      const location = versLocation(ligne);
      const paiements = (await lignes(lier, SQL.paiements, userId, locationId)).map(versPaiement);
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
      }));
      if (existantes.length >= LIMITE_LOCATIONS_PAR_BIEN) {
        throw new ErreurGestion('LIMITE_ATTEINTE');
      }
      if (chevauche(existantes, occupation.location)) throw new ErreurGestion('BIEN_OCCUPE');

      const horodatage = maintenant();
      const locataire = LocataireSchema.parse({
        id: genererId(),
        ...occupation.locataire,
        creeLe: horodatage,
      });
      const location = LocationGereeSchema.parse({
        id: genererId(),
        bienId,
        locataireId: locataire.id,
        ...occupation.location,
        creeLe: horodatage,
      });
      await ensemble([
        lier(
          SQL.insererLocataire,
          locataire.id,
          userId,
          locataire.prenom,
          locataire.nom,
          locataire.email,
          locataire.creeLe,
        ),
        lier(
          SQL.insererLocation,
          location.id,
          userId,
          location.bienId,
          location.locataireId,
          location.type,
          location.debut,
          location.fin,
          location.jourLoyer,
          location.loyerHorsCharges,
          location.charges,
          location.depot,
          location.creeLe,
        ),
      ]);
      return { locataire, location };
    },
  };
}
