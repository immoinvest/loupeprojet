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

/** Un nouveau loyer vaut au plus tard 12 mois après le mois en cours (ADR-G15). */
export const HORIZON_MODIFICATION_MOIS = 12;

/** Changements de montants gardés par location : dix ans de changements mensuels (borne contre l'abus). */
export const CHANGEMENTS_MAX = 120;

/**
 * Aide au logement versée au bailleur (tiers payant) : il la déduit du loyer demandé au locataire
 * (CAF, « Rappel sur le tiers payant » ; CCH art. D832-1 à D832-4). La quittance indique la part de la
 * CAF et celle du locataire : formulation reprise du guide du bailleur de la CAF, à confirmer.
 */
export const APL_QUITTANCE = {
  aConfirmer: true,
  source: 'Guide du bailleur de la CAF (résumé consulté le 14/09/2026)',
} as const;

/** Dépôt de garantie maximal, en mois de loyer hors charges : 1 en location vide, 2 en meublé. */
export const MOIS_DE_DEPOT: Readonly<Record<TypeLocation, number>> = { nue: 1, meublee: 2 };

/** Le dépôt proposé par défaut : le maximum légal du type de location. */
export function depotParDefaut(type: TypeLocation, loyerHorsCharges: number): number {
  return loyerHorsCharges * MOIS_DE_DEPOT[type];
}
