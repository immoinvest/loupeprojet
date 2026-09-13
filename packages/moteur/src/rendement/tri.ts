import { van } from '../commun/flux';
import { resoudreOuNull } from '../commun/resolution';

const TAUX_MIN = -0.99;
const TAUX_MAX = 10;

/**
 * Taux de rendement interne d'une série de flux annuels (`flux[0]` à l'instant 0).
 * `null` s'il n'existe pas de taux qui annule la VAN (flux tous de même signe, par exemple).
 */
export function tri(flux: readonly number[]): number | null {
  const aDesEntrees = flux.some((f) => f > 0);
  const aDesSorties = flux.some((f) => f < 0);
  if (!aDesEntrees || !aDesSorties) return null;
  return resoudreOuNull((taux) => van(flux, taux), TAUX_MIN, TAUX_MAX, { tolerance: 1e-10 });
}
