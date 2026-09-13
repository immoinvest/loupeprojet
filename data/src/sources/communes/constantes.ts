import type { Source } from '../../schemas/meta.ts';

export const SOURCE_COMMUNES: Source = {
  nom: 'Découpage administratif communal : API Géo (Etalab, à partir du code officiel géographique de l’INSEE)',
  url: 'https://geo.api.gouv.fr/decoupage-administratif/communes',
  licence: 'Licence Ouverte 2.0',
};

export const API_GEO = 'https://geo.api.gouv.fr';

/** Villes à arrondissements municipaux : département → code INSEE de la commune parente. */
export const COMMUNES_A_ARRONDISSEMENTS: Readonly<Record<string, string>> = {
  '75': '75056',
  '69': '69123',
  '13': '13055',
};

export function urlCommunes(departement: string): string {
  return `${API_GEO}/departements/${departement}/communes?fields=nom,code,codesPostaux,population,codeEpci&format=json`;
}

export function urlArrondissements(departement: string): string {
  return `${API_GEO}/communes?codeDepartement=${departement}&type=arrondissement-municipal&fields=nom,code,codesPostaux,population&format=json`;
}
