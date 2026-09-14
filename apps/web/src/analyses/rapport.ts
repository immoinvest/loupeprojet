import type { ResultatsComplets } from '@loupe/moteur';

/**
 * La cascade de l'autofinancement, en euros par mois : ce que le loyer laisse après le crédit,
 * après les charges (le cash-flow du feu, avant impôt) et après l'impôt. Tout vient des
 * résultats du moteur ; les seuls dérivés sont les soustractions et la moyenne mensuelle de l'impôt.
 */
export interface CascadeAutofinancement {
  /** Loyers bruts ÷ 12 (recettes brutes en courte durée). */
  readonly loyer: number;
  /** Mensualité, assurance comprise. */
  readonly credit: number;
  readonly apresCredit: number;
  /** Charges d'exploitation ÷ 12 : taxe foncière, copropriété, PNO, comptable, CFE, gestion, entretien. */
  readonly charges: number;
  /** Perte de loyer des semaines sans locataire ÷ 12 (0 en courte durée). */
  readonly vacance: number;
  /** Ménage et conciergerie ÷ 12 en courte durée, 0 sinon. */
  readonly fraisCourteDuree: number;
  /** = `r.cashflow.mensuel` : le « reste chaque mois », avant impôt. */
  readonly apresCharges: number;
  /** Impôt total du régime retenu ÷ années de détention ÷ 12. */
  readonly impot: number;
  readonly apresImpot: number;
}

export function cascadeAutofinancement(r: ResultatsComplets): CascadeAutofinancement {
  const c = r.cashflow;
  const loyer = c.recettes.loyersBruts / 12;
  const credit = r.financement.mensualiteTotale;
  const cd = c.recettes.courteDuree;
  const annees = r.projet.hypotheses.revente.annees;
  const impot = r.fiscalite.regimes[r.fiscalite.retenu].impotTotal / annees / 12;
  return {
    loyer,
    credit,
    apresCredit: loyer - credit,
    charges: c.chargesAnnuelles / 12,
    vacance: c.recettes.vacance / 12,
    fraisCourteDuree: cd === null ? 0 : (cd.menage + cd.conciergerie) / 12,
    apresCharges: c.mensuel,
    impot,
    apresImpot: c.mensuel - impot,
  };
}

/**
 * Multiple sur apport : gain total sur la période ÷ mise de départ (l'indicateur de l'Excel de
 * Pierre). `null` sans mise de départ : le rapport n'aurait pas de sens.
 */
export function multipleSurApport(r: ResultatsComplets): number | null {
  const e = r.rendement.enrichissement;
  return e.miseDeDepart > 0 ? e.total / e.miseDeDepart : null;
}
