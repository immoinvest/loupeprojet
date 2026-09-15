import type { Changement, LocationGeree, Paiement } from '@loupe/gestion';

import { ErreurGestion } from './depot';
import { versChangement, versLocation, versPaiement, type Ligne, type Lier } from './lignes';

/** Lectures d'une location du compte, partagées par les paiements, les baux, les documents et les modifications. */

const SQL = {
  location: 'select * from gestion_location where userId = ? and id = ?',
  colocataires:
    'select locataireId from gestion_colocataire where userId = ? and locationId = ? order by ordre',
  changements:
    'select aPartirDe, loyerHorsCharges, charges, apl from gestion_changement where userId = ? and locationId = ? order by aPartirDe',
  paiements: 'select * from gestion_paiement where userId = ? and locationId = ?',
} as const;

export async function lignes(lier: Lier, sql: string, ...valeurs: string[]): Promise<Ligne[]> {
  return (await lier(sql, ...valeurs).all<Ligne>()).results;
}

/** Les changements de montants d'une location, dans l'ordre des mois (ADR-G14). */
export async function lireChangements(
  lier: Lier,
  userId: string,
  locationId: string,
): Promise<Changement[]> {
  return (await lignes(lier, SQL.changements, userId, locationId)).map(versChangement);
}

/** Une location du compte, avec ses colocataires et ses changements ; INTROUVABLE hors du compte. */
export async function lireLocation(
  lier: Lier,
  userId: string,
  locationId: string,
): Promise<LocationGeree> {
  const [ligne] = await lignes(lier, SQL.location, userId, locationId);
  if (ligne === undefined) throw new ErreurGestion('INTROUVABLE');
  const [colocataires, changements] = await Promise.all([
    lignes(lier, SQL.colocataires, userId, locationId),
    lireChangements(lier, userId, locationId),
  ]);
  return versLocation(
    ligne,
    colocataires.map((c) => String(c.locataireId)),
    changements,
  );
}

export async function lirePaiements(
  lier: Lier,
  userId: string,
  locationId: string,
): Promise<Paiement[]> {
  return (await lignes(lier, SQL.paiements, userId, locationId)).map(versPaiement);
}
