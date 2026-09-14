import type { CreationLocation, NouveauLocataire, NouvelleLocation } from './schemas';

export interface Occupation {
  readonly locataire: NouveauLocataire;
  readonly location: NouvelleLocation;
  /** Les autres locataires du bail, dans l'ordre ; vide hors colocation. */
  readonly colocataires: readonly NouveauLocataire[];
}

/**
 * Le locataire et la location d'une création, ou `null` pour un bien vacant. Le schéma de création
 * garantit « les deux ou aucun » ; un objet incohérent construit à la main donne un bien vacant.
 */
export function occupationDe(creation: CreationLocation): Occupation | null {
  const { locataire, location } = creation;
  if (locataire === null || location === null) return null;
  return { locataire, location, colocataires: creation.colocataires ?? [] };
}
