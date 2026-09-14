import { z } from 'zod';

import { JourSchema, periodeDe } from './dates';
import {
  NouveauLocataireSchema,
  NouvelleLocationSchema,
  type LocationGeree,
  type Paiement,
} from './schemas';

/** La date de sortie d'un locataire. */
export const FinLocationSchema = z.object({ fin: JourSchema });

/** Louer un bien vacant : le locataire et la location, sans la partie bien. */
export const NouvelleOccupationSchema = z.object({
  locataire: NouveauLocataireSchema,
  location: NouvelleLocationSchema,
});

export type FinLocation = z.infer<typeof FinLocationSchema>;
export type NouvelleOccupation = z.infer<typeof NouvelleOccupationSchema>;

export type RefusFin = 'FIN_AVANT_ENTREE' | 'PAIEMENTS_APRES_SORTIE';

/** Plus loin que toute date réelle : une location sans fin connue court jusque-là. */
const SANS_FIN = '9999-12-31';

/**
 * Pourquoi cette sortie est refusée, ou `null` si elle est acceptée : pas avant l'entrée, et aucun
 * loyer déjà reçu pour un mois qui suit la sortie (il faudrait l'annuler d'abord).
 */
export function refusFin(
  location: Pick<LocationGeree, 'id' | 'debut'>,
  fin: string,
  paiements: readonly Paiement[],
): RefusFin | null {
  if (fin < location.debut) return 'FIN_AVANT_ENTREE';
  const apres = paiements.some((p) => p.locationId === location.id && p.periode > periodeDe(fin));
  return apres ? 'PAIEMENTS_APRES_SORTIE' : null;
}

interface Periode {
  readonly debut: string;
  readonly fin?: string | undefined;
}

/** La nouvelle location chevauche-t-elle l'une de celles du bien ? (bornes comprises) */
export function chevauche(existantes: readonly Periode[], nouvelle: Periode): boolean {
  const finNouvelle = nouvelle.fin ?? SANS_FIN;
  return existantes.some((l) => l.debut <= finNouvelle && nouvelle.debut <= (l.fin ?? SANS_FIN));
}
