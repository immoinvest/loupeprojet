import type { Source } from '../../schemas/meta.ts';

export const SOURCE_DVF: Source = {
  nom: 'Demandes de valeurs foncières géolocalisées (Etalab, à partir des données DGFiP)',
  url: 'https://www.data.gouv.fr/datasets/demandes-de-valeurs-foncieres-geolocalisees',
  licence: 'Licence Ouverte 2.0',
};

/** Fenêtre glissante des ventes publiées, en mois, se terminant à la dernière vente connue. */
export const FENETRE_MOIS = 24;

/** Dossiers annuels lus pour couvrir la fenêtre : le plus récent ne contient parfois qu'un semestre. */
export const ANNEES_LUES = 3;

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
