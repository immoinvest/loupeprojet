import type { ResultatRevente } from '../revente/par-regime';
import type { ProjectionRegime, ResultatRegime } from './types';

/** Ajoute à la projection d'un régime sa revente : impôt à la revente, impôt total, ce qu'il reste. */
export function bilanRegime(
  projection: ProjectionRegime,
  revente: ResultatRevente,
): ResultatRegime {
  const impotRevente = revente.plusValue.impotTotal;
  return {
    ...projection,
    revente,
    impotRevente,
    impotGlobal: projection.impotTotal + impotRevente,
    enrichissementFinal: projection.cashflowApresImpotTotal + revente.cashNetVendeur,
  };
}
