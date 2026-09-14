import { z } from 'zod';

import { JourSchema, periodeDe } from './dates';
import {
  ColocatairesSchema,
  LocataireSchema,
  LocationGereeSchema,
  NouveauLocataireSchema,
  NouvelleLocationSchema,
  type LocationGeree,
  type Paiement,
} from './schemas';

/** La date de sortie d'un locataire. */
export const FinLocationSchema = z.object({ fin: JourSchema });

/** Louer un bien (vacant, ou une autre chambre) : le locataire, ses colocataires et la location. */
export const NouvelleOccupationSchema = z.object({
  locataire: NouveauLocataireSchema,
  location: NouvelleLocationSchema,
  colocataires: ColocatairesSchema.optional(),
});

/** Ce que rend la location d'un bien : le locataire, la location et les colocataires, écrits ensemble. */
export const OccupationCreeeSchema = z.object({
  locataire: LocataireSchema,
  location: LocationGereeSchema,
  colocataires: z.array(LocataireSchema),
});

export type FinLocation = z.infer<typeof FinLocationSchema>;
export type NouvelleOccupation = z.infer<typeof NouvelleOccupationSchema>;
export type OccupationCreee = z.infer<typeof OccupationCreeeSchema>;

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
  readonly libelle?: string | undefined;
}

/** « Chambre 2 » et « chambre 2 » désignent la même chambre ; sans libellé, le bien entier. */
function memeLibelle(a: Periode, b: Periode): boolean {
  return (a.libelle ?? '').toLocaleLowerCase('fr') === (b.libelle ?? '').toLocaleLowerCase('fr');
}

/**
 * La nouvelle location chevauche-t-elle une location du bien au même libellé ? (bornes comprises)
 * Deux chambres différentes se louent aux mêmes dates (ADR-G13).
 */
export function chevauche(existantes: readonly Periode[], nouvelle: Periode): boolean {
  const finNouvelle = nouvelle.fin ?? SANS_FIN;
  return existantes.some(
    (l) =>
      memeLibelle(l, nouvelle) && l.debut <= finNouvelle && nouvelle.debut <= (l.fin ?? SANS_FIN),
  );
}
