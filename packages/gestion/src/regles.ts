/*
 * Règles de gestion et valeurs par défaut, datées. Sources à vérifier sur Légifrance (loi n° 89-462
 * du 6 juillet 1989) : dépôt de garantie art. 22 (vide) et 25-6 (meublé).
 */

export const VERSION_REGLES_GESTION = '2026-09';

export const TYPES_BIEN = ['appartement', 'maison', 'studio', 'parking'] as const;
export type TypeBien = (typeof TYPES_BIEN)[number];

export const TYPES_LOCATION = ['nue', 'meublee'] as const;
export type TypeLocation = (typeof TYPES_LOCATION)[number];

/** Jour du mois où le loyer est attendu, quand rien ne dit mieux (la banque le dira en G3). */
export const JOUR_LOYER_DEFAUT = 5;
/** Au-delà du 28, un mois de février n'aurait pas ce jour. */
export const JOUR_LOYER_MAX = 28;

/** Jours après la date due au bout desquels un loyer non reçu est « en retard ». */
export const DELAI_RETARD_JOURS = 5;

/** Colocataires d'une location en plus du locataire en titre (borne de saisie et contre l'abus). */
export const COLOCATAIRES_MAX = 10;

/** Plafond de tout montant saisi : 100 000 €, en centimes. */
export const MONTANT_MAX_CENTIMES = 10_000_000;

/** Dépôt de garantie maximal, en mois de loyer hors charges : 1 en location vide, 2 en meublé. */
export const MOIS_DE_DEPOT: Readonly<Record<TypeLocation, number>> = { nue: 1, meublee: 2 };

/** Le dépôt proposé par défaut : le maximum légal du type de location. */
export function depotParDefaut(type: TypeLocation, loyerHorsCharges: number): number {
  return loyerHorsCharges * MOIS_DE_DEPOT[type];
}
