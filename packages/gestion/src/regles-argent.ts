/*
 * Dépenses et prêt d'un bien géré (G5-4, G5-1). Aucune règle légale ici : des listes fixes et des
 * bornes contre la saisie absurde ou l'abus du quota de la base.
 */

/** Catégories d'une dépense : la liste fixe des specs de l'épic (§ 2, Dépense). */
export const CATEGORIES_DEPENSE = [
  'credit',
  'taxe_fonciere',
  'copropriete',
  'assurance',
  'travaux',
  'entretien',
  'gestion',
  'autre',
] as const;
export type CategorieDepense = (typeof CATEGORIES_DEPENSE)[number];

/** Récurrence facultative d'une dépense (ADR-G26 : une ligne, occurrences calculées à l'affichage). */
export const FREQUENCES = ['mensuelle', 'trimestrielle', 'annuelle'] as const;
export type Frequence = (typeof FREQUENCES)[number];

/** L'écart en mois entre deux occurrences. */
export const MOIS_PAR_FREQUENCE: Readonly<Record<Frequence, number>> = {
  mensuelle: 1,
  trimestrielle: 3,
  annuelle: 12,
};

/** Dépenses gardées par compte : largement au-delà d'un investisseur particulier (borne contre l'abus). */
export const DEPENSES_MAX = 2_000;

export const LIBELLE_DEPENSE_MAX = 80;

/** Capital d'un prêt : 5 millions d'euros au plus, en centimes. */
export const CAPITAL_MAX_CENTIMES = 500_000_000;

/** Taux nominal annuel d'un prêt, en décimal : 20 % au plus (au-delà, une erreur de saisie). */
export const TAUX_PRET_MAX = 0.2;

/** Durée d'un prêt : 40 ans au plus, en mois. */
export const DUREE_PRET_MAX_MOIS = 480;
