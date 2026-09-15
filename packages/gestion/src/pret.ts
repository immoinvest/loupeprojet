import { calculerMensualite, tableauAmortissement } from '@loupe/moteur';

import { ajouterMois } from './dates';
import type { PretBien } from './depenses';

/*
 * Le prêt d'un bien, calculé par le tableau d'amortissement du moteur (ADR-G27) : les montants du
 * moteur sont en euros décimaux, ceux de la gestion en centimes entiers, arrondis ligne par ligne.
 * Rien n'est stocké : mensualité du mois et capital restant dû se recalculent à l'affichage.
 */

/** Une mensualité du prêt, en centimes. */
export interface EcheancePret {
  readonly periode: string;
  /** Mensualité hors assurance. */
  readonly mensualite: number;
  readonly interets: number;
  readonly capitalRembourse: number;
  readonly assurance: number;
  /** Mensualité assurance comprise : ce qui sort du compte ce mois-là. */
  readonly total: number;
  /** Capital restant dû après cette échéance. */
  readonly capitalRestantDu: number;
}

function enCentimes(euros: number): number {
  return Math.round(euros * 100);
}

/** Le nombre de mois de `depart` à `periode` : 0 pour le même mois, négatif avant. */
export function moisEntre(depart: string, periode: string): number {
  const rang = (p: string): number => Number(p.slice(0, 4)) * 12 + Number(p.slice(5, 7));
  return rang(periode) - rang(depart);
}

// Un même prêt (objet de l'état) est relu pour chaque mois d'une courbe : son tableau est gardé.
const TABLEAUX = new WeakMap<PretBien, readonly EcheancePret[]>();

/** Toutes les échéances, de la première (mois `debut`) à la dernière. */
export function tableauDuPret(pret: PretBien): readonly EcheancePret[] {
  const garde = TABLEAUX.get(pret);
  if (garde !== undefined) return garde;
  const lignes = tableauAmortissement({
    capital: pret.capital / 100,
    tauxAnnuel: pret.tauxAnnuel,
    dureeMois: pret.dureeMois,
    differeTotalMois: 0,
    differePartielMois: 0,
    tauxAssurance: 0,
  });
  const tableau = lignes.map((l, rang): EcheancePret => {
    const mensualite = enCentimes(l.mensualite);
    return {
      periode: ajouterMois(pret.debut, rang),
      mensualite,
      interets: enCentimes(l.interets),
      capitalRembourse: enCentimes(l.capital),
      assurance: pret.assuranceMensuelle,
      total: mensualite + pret.assuranceMensuelle,
      // Le dernier reste dû du moteur vaut 0 à une poussière de calcul près.
      capitalRestantDu: Math.max(0, enCentimes(l.crdFin)),
    };
  });
  TABLEAUX.set(pret, tableau);
  return tableau;
}

/** L'échéance du mois, ou `null` avant la première et après la dernière. */
export function echeanceDuMois(pret: PretBien, periode: string): EcheancePret | null {
  const rang = moisEntre(pret.debut, periode);
  if (rang < 0) return null;
  return tableauDuPret(pret)[rang] ?? null;
}

/** Le capital restant dû à la fin du mois : tout le capital avant la première échéance, 0 après la dernière. */
export function capitalRestantDu(pret: PretBien, periode: string): number {
  const rang = moisEntre(pret.debut, periode);
  if (rang < 0) return pret.capital;
  return tableauDuPret(pret)[rang]?.capitalRestantDu ?? 0;
}

/** La mensualité constante, assurance comprise. */
export function mensualiteDuPret(pret: PretBien): number {
  const mensualite = calculerMensualite(pret.capital / 100, pret.tauxAnnuel, pret.dureeMois);
  return enCentimes(mensualite) + pret.assuranceMensuelle;
}

/** Le mois de la dernière échéance. */
export function finDuPret(pret: PretBien): string {
  return ajouterMois(pret.debut, pret.dureeMois - 1);
}
