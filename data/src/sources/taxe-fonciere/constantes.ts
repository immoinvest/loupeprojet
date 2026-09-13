import type { Source } from '../../schemas/meta.ts';

export const SOURCE_TAXE_FONCIERE: Source = {
  nom: "Recensement des éléments d'imposition à la fiscalité directe locale (REI, DGFiP), rediffusé par l'OFGL",
  url: 'https://data.ofgl.fr/explore/dataset/rei/',
  licence: 'Licence Ouverte 2.0',
};

export const API_REI = 'https://data.ofgl.fr/api/explore/v2.1/catalog/datasets/rei';

/** Postes du taux de taxe foncière sur les propriétés bâties ; la TEOM est suivie à part (récupérable sur le locataire). */
export type PosteTaxeFonciere =
  'commune' | 'syndicats' | 'intercommunalite' | 'gemapi' | 'tse' | 'teom';

/** Variables REI de catégorie « Taux » retenues et le poste qu'elles alimentent. */
export const VARIABLES_REI: Readonly<Record<string, PosteTaxeFonciere>> = {
  E12: 'commune',
  E22: 'syndicats',
  E32: 'intercommunalite',
  E52gGEMAPI: 'gemapi',
  E52: 'tse',
  E52A: 'tse',
  E52TASA: 'tse',
  F22: 'teom',
};

/** Export CSV filtré d'un département et d'une année : quelques centaines de lignes au lieu de 22 millions. */
export function urlExportRei(departement: string, annee: string): string {
  const variables = Object.keys(VARIABLES_REI)
    .map((variable) => `"${variable}"`)
    .join(',');
  const parametres = new URLSearchParams({
    where: `dep="${departement}" and annee="${annee}" and categorie="Taux" and var in (${variables})`,
    select: 'annee,dep,idcom,libcom,var,varlib,valeur,destinataire,dispositif_fiscal,optepci,z08',
    use_labels: 'false',
    delimiter: ';',
  });
  return `${API_REI}/exports/csv?${parametres.toString()}`;
}

export function urlAnneesRei(): string {
  return `${API_REI}/facets?facet=annee`;
}
