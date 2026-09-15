import type { TypeLocation } from './regles';

/*
 * Règles de la fin du bail, datées et sourcées : loi n° 89-462 du 6 juillet 1989, lue sur Légifrance le
 * 15/09/2026. Une valeur non relue sur sa source porte `aConfirmer: true` et le dit à l'écran.
 */

export const REGLES_FIN_BAIL_CONSULTEES_LE = '2026-09-15';

/**
 * Préavis du locataire, en mois : 3 en location vide, 1 en zone tendue (territoires de l'article 17) ou
 * pour un motif listé à l'article 15 I ; 1 en meublé (art. 25-8) ; 1 en bail mobilité (titre I ter).
 * Le délai court du jour de réception du congé.
 */
export const PREAVIS_LOCATAIRE = {
  nue: 3,
  reduit: 1,
  meublee: 1,
  mobilite: 1,
  sourceNue: 'Loi n° 89-462 du 6 juillet 1989, art. 15 I (version en vigueur depuis le 29/07/2023)',
  sourceMeublee: 'Loi n° 89-462 du 6 juillet 1989, art. 25-8',
  sourceMobilite:
    'Loi n° 89-462 du 6 juillet 1989, titre I ter ; service-public.gouv.fr, fiche F34759',
  /** Le mois de préavis du bail mobilité vient de la fiche Service-public : l'article n'a pas été relu. */
  mobiliteAConfirmer: true,
  /** Même quantième N mois plus tard, dernier jour du mois s'il n'existe pas (Service-public F32360). */
  calcul: 'service-public.gouv.fr, fiche F32360 (vérifiée le 14/04/2026)',
} as const;

/** Dépôt de garantie maximal, en mois de loyer hors charges (art. 22, art. 25-6, art. 25-13 I 11°). */
export const DEPOT_MAXIMUM_MOIS: Readonly<Record<TypeLocation | 'mobilite', number>> = {
  nue: 1,
  meublee: 2,
  mobilite: 0,
};

export const SOURCE_DEPOT_MAXIMUM =
  'Loi n° 89-462 du 6 juillet 1989, art. 22 (vide), art. 25-6 (meublé), art. 25-13 I 11° (bail mobilité)';

/**
 * Restitution du dépôt (art. 22, version en vigueur depuis le 27/03/2014) : 1 mois après la remise des clés
 * si l'état des lieux de sortie est conforme à celui d'entrée, 2 mois sinon ; au-delà, le dépôt restant dû
 * est majoré de 10 % du loyer mensuel en principal par période mensuelle commencée en retard (sauf si le
 * locataire n'a pas donné sa nouvelle adresse).
 */
export const RESTITUTION_DEPOT = {
  conformeMois: 1,
  retenuesMois: 2,
  majorationPourcent: 10,
  source: 'Loi n° 89-462 du 6 juillet 1989, art. 22',
  aConfirmer: false,
} as const;

/** Le rendu du dépôt est rappelé une semaine avant la date limite (choix Deklic, fiche B2). */
export const RAPPEL_DEPOT_JOURS = 7;

/** Bornes de saisie des retenues sur le dépôt. */
export const RETENUES_MAX = 20;
export const MOTIF_RETENUE_MAX = 120;

/**
 * Régularisation annuelle des charges (art. 23, version en vigueur depuis le 01/07/2021) : décompte par
 * nature de charges communiqué un mois avant la régularisation ; justificatifs à disposition six mois.
 */
export const REGULARISATION_CHARGES = {
  delaiDecompteMois: 1,
  justificatifsMois: 6,
  /** Années proposées en arrière (choix Deklic). */
  anneesProposees: 3,
  source: 'Loi n° 89-462 du 6 juillet 1989, art. 23',
  aConfirmer: false,
} as const;

/** Provisions régularisées chaque année, ou forfait qui ne se régularise jamais. */
export const MODES_CHARGES = ['provision', 'forfait'] as const;
export type ModeCharges = (typeof MODES_CHARGES)[number];

/**
 * Colocation (art. 8-1 VI, version en vigueur depuis le 01/07/2021) : la solidarité du colocataire qui part
 * prend fin quand un nouveau colocataire figure au bail, et au plus tard six mois après la date d'effet du
 * congé. Dans un bail mobilité, la solidarité est réputée non écrite (art. 25-13 II).
 */
export const SOLIDARITE_COLOCATAIRE = {
  moisMax: 6,
  source: 'Loi n° 89-462 du 6 juillet 1989, art. 8-1 VI',
  aConfirmer: false,
} as const;
