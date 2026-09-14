import {
  changementRefuse,
  chevauche,
  type LocationGeree,
  type ModificationLocation,
} from '@loupe/gestion';

import { ErreurGestion } from './depot';
import type { Outils } from './depot-documents';
import { lignes, lireLocation } from './lecture';
import { versPeriode } from './lignes';

const SQL = {
  // Insertion conditionnelle (ADR-G15) : aucun paiement pour ce mois ni après, sinon rien n'est écrit.
  // Un changement du même mois remplace le précédent.
  changement:
    'insert into gestion_changement (locationId, userId, aPartirDe, loyerHorsCharges, charges, apl, modifieLe) select ?, ?, ?, ?, ?, ?, ? where not exists (select 1 from gestion_paiement where userId = ? and locationId = ? and periode >= ?) on conflict (locationId, aPartirDe) do update set loyerHorsCharges = excluded.loyerHorsCharges, charges = excluded.charges, apl = excluded.apl, modifieLe = excluded.modifieLe',
  location:
    'update gestion_location set jourLoyer = ?, depot = ?, libelle = ? where userId = ? and id = ?',
  autresLocationsDuBien:
    'select debut, fin, libelle from gestion_location where userId = ? and bienId = ? and id <> ?',
} as const;

export interface DepotModifications {
  readonly modifierLocation: (
    userId: string,
    locationId: string,
    modification: ModificationLocation,
  ) => Promise<LocationGeree>;
}

/** « Modifier » une location : montants à partir d'un mois, jour du loyer, dépôt, libellé. */
export function depotModifications(outils: Outils): DepotModifications {
  const { lier, maintenant } = outils;

  /** Un libellé ne doit pas faire chevaucher une autre location du bien au même libellé (ADR-G13). */
  const verifierLibelle = async (
    userId: string,
    location: LocationGeree,
    libelle: string | null,
  ): Promise<void> => {
    const autres = await lignes(
      lier,
      SQL.autresLocationsDuBien,
      userId,
      location.bienId,
      location.id,
    );
    const nouvelle = {
      debut: location.debut,
      ...(location.fin === undefined ? {} : { fin: location.fin }),
      ...(libelle === null ? {} : { libelle }),
    };
    if (chevauche(autres.map(versPeriode), nouvelle)) throw new ErreurGestion('BIEN_OCCUPE');
  };

  return {
    modifierLocation: async (userId, locationId, modification) => {
      const location = await lireLocation(lier, userId, locationId);
      const { montants, jourLoyer, depot, libelle } = modification;
      if (montants !== undefined) {
        // Les bornes seulement : le mois déjà payé se décide à l'écriture, sans course possible.
        const hors = changementRefuse(location, [], montants.aPartirDe, maintenant().slice(0, 10));
        if (hors !== null) throw new ErreurGestion(hors);
      }
      if (libelle !== undefined) await verifierLibelle(userId, location, libelle);

      if (montants !== undefined) {
        const ecrit = await lier(
          SQL.changement,
          locationId,
          userId,
          montants.aPartirDe,
          montants.loyerHorsCharges,
          montants.charges,
          montants.apl,
          maintenant(),
          userId,
          locationId,
          montants.aPartirDe,
        ).run();
        if (ecrit.meta.changes === 0) throw new ErreurGestion('PERIODE_PAYEE');
      }
      if (jourLoyer !== undefined || depot !== undefined || libelle !== undefined) {
        await lier(
          SQL.location,
          jourLoyer ?? location.jourLoyer,
          depot ?? location.depot,
          libelle === undefined ? location.libelle : (libelle ?? undefined),
          userId,
          locationId,
        ).run();
      }
      return lireLocation(lier, userId, locationId);
    },
  };
}
