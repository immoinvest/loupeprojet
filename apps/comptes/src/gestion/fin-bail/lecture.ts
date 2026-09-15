import {
  locatairesDuMois,
  type IdentitesDecompte,
  type LocationGeree,
  type MouvementColocation,
} from '@loupe/gestion';

import { lignes } from '../lecture';
import { versBailleur, type Ligne, type Lier } from '../lignes';
import { ErreurFinBail, estTableFinBailAbsente } from './depot';
import { versMouvement } from './lignes';

/** Lectures partagées par les écritures de la fin du bail et par l'émission des quittances. */

const SQL = {
  mouvements:
    'select * from gestion_colocation_mouvement where userId = ? and locationId = ? order by date, id',
  bailleur: 'select nom, adresse from gestion_bailleur where userId = ?',
  bien: 'select b.nom, b.adresse from gestion_location l join gestion_bien b on b.id = l.bienId where l.userId = ? and l.id = ?',
  locataires: 'select id, prenom, nom from gestion_locataire where userId = ?',
} as const;

/** La première ligne, ou INTROUVABLE. */
export function premiere(resultat: readonly Ligne[]): Ligne {
  const [ligne] = resultat;
  if (ligne === undefined) throw new ErreurFinBail('INTROUVABLE');
  return ligne;
}

export async function lireMouvements(
  lier: Lier,
  userId: string,
  locationId: string,
): Promise<MouvementColocation[]> {
  return (await lignes(lier, SQL.mouvements, userId, locationId)).map(versMouvement);
}

/**
 * Les mouvements de colocataires, ou aucun tant que la migration 0011 manque (ADR-G38) : la route des
 * quittances de G1b les lit sans jamais dépendre de la nouvelle table.
 */
export async function mouvementsSiDisponibles(
  lier: Lier,
  userId: string,
  locationId: string,
): Promise<MouvementColocation[]> {
  try {
    return await lireMouvements(lier, userId, locationId);
  } catch (erreur) {
    if (estTableFinBailAbsente(erreur)) return [];
    throw erreur;
  }
}

/**
 * Qui et où pour un décompte : le bailleur (BAILLEUR_MANQUANT sinon), le bien, et les locataires présents
 * pendant le mois indiqué, dans l'ordre du bail.
 */
export async function identitesDecompte(
  lier: Lier,
  userId: string,
  location: LocationGeree,
  periode: string,
  emisLe: string,
): Promise<IdentitesDecompte> {
  const [bailleurs, biens, locataires, mouvements] = await Promise.all([
    lignes(lier, SQL.bailleur, userId),
    lignes(lier, SQL.bien, userId, location.id),
    lignes(lier, SQL.locataires, userId),
    lireMouvements(lier, userId, location.id),
  ]);
  const bailleur = versBailleur(bailleurs[0]);
  if (bailleur === null) throw new ErreurFinBail('BAILLEUR_MANQUANT');
  const bien = premiere(biens);
  const noms = new Map(
    locataires.map((l) => [String(l.id), { prenom: String(l.prenom), nom: String(l.nom) }]),
  );
  return {
    bailleur,
    locataires: locatairesDuMois(location, mouvements, periode)
      .map((id) => noms.get(id))
      .filter((nom) => nom !== undefined),
    logement: {
      nom: String(bien.nom),
      adresse: String(bien.adresse),
      ...(location.libelle === undefined ? {} : { libelle: location.libelle }),
    },
    emisLe,
  };
}
