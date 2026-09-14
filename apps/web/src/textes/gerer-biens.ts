import { montant } from '@/gestion/format';

import { nomsDesLocataires } from './gerer-loyers';

/** Textes de la page « Mes biens » (tutoiement). */
export const TEXTES_BIENS = {
  titre: 'Mes biens',
  ajouter: 'Ajouter un bien',
  sansLocataire: 'Sans locataire',
  ceMois: 'Ce mois-ci',
} as const;

/** « 1 bien », « 4 biens » : le titre de la page. */
export function nombreDeBiens(nombre: number): string {
  return `${String(nombre)} bien${nombre > 1 ? 's' : ''}`;
}

/**
 * Qui occupe le bien : « Julie Martin », « Julie Martin et Léa Bernard » (colocation à bail unique),
 * « 2 locations en cours » (location à la chambre), « Sans locataire ».
 */
export function occupantsDuBien(
  noms: readonly string[],
  locations: number,
  aVenir: boolean,
): string {
  if (noms.length === 0) return TEXTES_BIENS.sansLocataire;
  if (locations > 1) return `${String(locations)} locations ${aVenir ? 'à venir' : 'en cours'}`;
  return nomsDesLocataires(noms);
}

/** « 700 € par mois ». */
export function loyerParMois(centimes: number): string {
  return `${montant(centimes)} par mois`;
}
