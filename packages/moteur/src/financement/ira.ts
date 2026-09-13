import type { Regles } from '../regles/types';

/** Indemnité de remboursement anticipé : min(6 mois d'intérêts, 3 % du capital restant dû). */
export function ira(crd: number, tauxAnnuel: number, regles: Regles): number {
  const { moisInterets, plafondCapital } = regles.credit.ira;
  const sixMoisInterets = ((crd * tauxAnnuel) / 12) * moisInterets;
  return Math.max(0, Math.min(sixMoisInterets, crd * plafondCapital));
}
