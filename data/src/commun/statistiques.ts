import { elementA } from './listes.ts';

export interface Quartiles {
  readonly q1: number;
  readonly mediane: number;
  readonly q3: number;
}

/**
 * Quantile par interpolation linéaire entre les deux valeurs voisines
 * (méthode 7 de Hyndman et Fan : celle de R par défaut et de QUARTILE.INC dans Excel).
 */
export function quantile(valeursTriees: readonly number[], probabilite: number): number {
  if (valeursTriees.length === 0) {
    throw new RangeError('quantile impossible sur une liste vide');
  }
  if (probabilite < 0 || probabilite > 1) {
    throw new RangeError(`probabilité hors de [0, 1] : ${String(probabilite)}`);
  }
  const position = (valeursTriees.length - 1) * probabilite;
  const bas = Math.floor(position);
  const haut = Math.ceil(position);
  const valeurBasse = elementA(valeursTriees, bas);
  const valeurHaute = elementA(valeursTriees, haut);
  return valeurBasse + (valeurHaute - valeurBasse) * (position - bas);
}

/** Premier quartile, médiane et troisième quartile ; `null` sans valeur. */
export function quartiles(valeurs: readonly number[]): Quartiles | null {
  if (valeurs.length === 0) {
    return null;
  }
  const triees = [...valeurs].sort((a, b) => a - b);
  return {
    q1: quantile(triees, 0.25),
    mediane: quantile(triees, 0.5),
    q3: quantile(triees, 0.75),
  };
}

/** Arrondi décimal explicite, sans « -0 ». */
export function arrondir(valeur: number, decimales: number): number {
  const facteur = 10 ** decimales;
  const resultat = Math.round((valeur + Number.EPSILON) * facteur) / facteur;
  return resultat === 0 ? 0 : resultat;
}
