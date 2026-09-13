import type { Source } from '../../schemas/meta.ts';

export const SOURCE_DVF: Source = {
  nom: 'Demandes de valeurs foncières géolocalisées (Etalab, à partir des données DGFiP)',
  url: 'https://www.data.gouv.fr/datasets/demandes-de-valeurs-foncieres-geolocalisees',
  licence: 'Licence Ouverte 2.0',
};

/** Fenêtre glissante des ventes publiées, en mois, se terminant à la dernière vente connue. */
export const FENETRE_MOIS = 24;

/**
 * Dossiers annuels lus : cinq ans pour mesurer la tendance des prix ; les CSV publiés ne gardent que
 * la fenêtre de 24 mois. Le plus récent ne contient parfois qu'un semestre.
 */
export const ANNEES_LUES = 5;

/** Un semestre compte dans la tendance à partir de 20 ventes : en dessous, la médiane est trop bruitée. */
export const SEUIL_VENTES_SEMESTRE = 20;

/** Une série de tendance a au moins deux semestres : un seul point ne dit rien de l'évolution. */
export const MINIMUM_POINTS_TENDANCE = 2;

/** Bornes de plausibilité d'une vente de logement ; en dehors, la ligne est écartée et comptée. */
export interface FiltresDvf {
  readonly surfaceMinM2: number;
  readonly surfaceMaxM2: number;
  readonly prixM2Min: number;
  readonly prixM2Max: number;
}

export const FILTRES_DVF: FiltresDvf = {
  surfaceMinM2: 9,
  surfaceMaxM2: 1000,
  prixM2Min: 300,
  prixM2Max: 40000,
};

export function urlDvf(annee: number, departement: string): string {
  return `https://files.data.gouv.fr/geo-dvf/latest/csv/${String(annee)}/departements/${departement}.csv.gz`;
}
