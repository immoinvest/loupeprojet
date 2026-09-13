import type { ResultatFinancement } from '../financement';

/**
 * Intérêts effectivement payés une année donnée. Pendant un différé total les intérêts
 * sont capitalisés, pas payés : ils ne sont pas déduits (simplification déclarée).
 */
export function interetsPayesAnnee(financement: ResultatFinancement, annee: number): number {
  return financement.tableau
    .filter((l) => l.annee === annee)
    .reduce((acc, l) => acc + Math.min(l.interets, l.mensualite), 0);
}

/** Assurance emprunteur payée une année donnée (déductible au réel). */
export function assuranceAnnee(financement: ResultatFinancement, annee: number): number {
  return financement.parAnnee.find((a) => a.annee === annee)?.assurance ?? 0;
}
