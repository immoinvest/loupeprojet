import type { CreationLocation, NouveauLocataire, NouvelleLocation } from './schemas';

export interface Occupation {
  readonly locataire: NouveauLocataire;
  readonly location: NouvelleLocation;
}

/**
 * Le locataire et la location d'une création, ou `null` pour un bien vacant. Le schéma de création
 * garantit « les deux ou aucun » ; un objet incohérent construit à la main donne un bien vacant.
 */
export function occupationDe(creation: CreationLocation): Occupation | null {
  const { locataire, location } = creation;
  return locataire === null || location === null ? null : { locataire, location };
}
