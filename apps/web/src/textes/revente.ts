import type { MethodeValorisation } from '@loupe/moteur';

import { euros } from '@/formatage/nombres';

export const TEXTES_PRIX_VENTE = {
  estime: 'Prix de vente estimé',
  saisi: 'Prix de vente saisi',
  revenir: 'Revenir à l’estimation',
} as const;

/** La précision entre parenthèses de la ligne « Valeur ajoutée par les travaux ». */
export const PRECISION_VALORISATION: Readonly<
  Record<Exclude<MethodeValorisation, 'aucune'>, string>
> = {
  etat: 'selon l’état du bien',
  repli: 'moitié des travaux, état du bien inconnu',
};

/** Phrase sous le champ « Prix de vente » : ce que vaut l'estimation. */
export function aidePrixVente(saisi: boolean, valeurEstimee: number): string {
  return saisi
    ? `Estimation : ${euros(valeurEstimee)}. Ce prix vaut quel que soit l’horizon.`
    : `Vide : ${euros(valeurEstimee)}, estimé à partir du prix, des travaux et de l’évolution du prix.`;
}
