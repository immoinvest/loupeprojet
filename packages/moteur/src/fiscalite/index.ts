import { calculerCashflow, type ResultatCashflow } from '../cashflow';
import { estMeuble } from '../cashflow/charges';
import type { ResultatFinancement } from '../financement';
import type { Regles } from '../regles/types';
import type { HypothesesCompletes, ModeLocation, Regime } from '../schema/hypotheses';
import type { ProjetComplet } from '../schema/projet';
import { projeterLmnpReel } from './lmnp-reel';
import { projeterMicroBic } from './micro-bic';
import { projeterMicroFoncier } from './micro-foncier';
import { projeterNuReel } from './nu-reel';
import type { ContexteFiscal, ResultatFiscalite, ResultatRegime } from './types';

export const REGIMES: readonly Regime[] = ['micro_bic', 'lmnp_reel', 'micro_foncier', 'nu_reel'];

const PROJECTEURS: Readonly<Record<Regime, (ctx: ContexteFiscal) => ResultatRegime>> = {
  micro_bic: projeterMicroBic,
  lmnp_reel: projeterLmnpReel,
  micro_foncier: projeterMicroFoncier,
  nu_reel: projeterNuReel,
};

export interface LocationPourRegime {
  readonly mode: ModeLocation;
  readonly loyerHc: number;
}

/**
 * Chaque régime est projeté avec le loyer de son mode : les régimes nus avec le loyer nu
 * (hypothèse, sinon déduit de la prime meublé), les régimes meublés avec le loyer meublé.
 */
export function locationPourRegime(
  hypotheses: HypothesesCompletes,
  regime: Regime,
  regles: Regles,
): LocationPourRegime {
  const { location } = hypotheses;
  const prime = 1 + regles.exploitation.primeMeuble;
  if (estMeuble(regime)) {
    return location.mode === 'nu'
      ? { mode: 'meuble_lld', loyerHc: location.loyerHc * prime }
      : { mode: location.mode, loyerHc: location.loyerHc };
  }
  const loyerNu =
    location.loyerHcNu ?? (location.mode === 'nu' ? location.loyerHc : location.loyerHc / prime);
  return { mode: 'nu', loyerHc: loyerNu };
}

/** Cash-flow avant impôt d'un régime, avec le loyer et les charges de son mode. */
export function cashflowDuRegime(
  projet: ProjetComplet,
  financement: ResultatFinancement,
  regime: Regime,
  regles: Regles,
): ResultatCashflow {
  const { mode, loyerHc } = locationPourRegime(projet.hypotheses, regime, regles);
  return calculerCashflow(projet, financement, { regime, mode, loyerHc });
}

function meilleurSelon(
  regimes: readonly ResultatRegime[],
  score: (r: ResultatRegime) => number,
): Regime {
  const eligibles = regimes.filter((r) => r.eligible);
  return eligibles.reduce((meilleur, r) => (score(r) > score(meilleur) ? r : meilleur)).regime;
}

export function calculerFiscalite(
  projet: ProjetComplet,
  financement: ResultatFinancement,
  regles: Regles,
): ResultatFiscalite {
  const resultats = REGIMES.map((regime) => {
    const cashflow = cashflowDuRegime(projet, financement, regime, regles);
    return PROJECTEURS[regime]({ projet, financement, cashflow, regles });
  });
  const regimes = Object.fromEntries(resultats.map((r) => [r.regime, r])) as Record<
    Regime,
    ResultatRegime
  >;
  return {
    regimes,
    retenu: projet.hypotheses.fiscalite.regime,
    meilleur: meilleurSelon(resultats, (r) => r.cashflowApresImpotTotal),
    meilleurImpot: meilleurSelon(resultats, (r) => -r.impotTotal),
  };
}

export { baseAmortissableBati, dotationsAnnee, type DotationsAnnee } from './amortissements';
export {
  STOCK_VIDE,
  ajouterDeficit,
  imputerDeficits,
  totalDeficits,
  type Imputation,
  type LotDeficit,
  type StockDeficits,
} from './deficits';
export { assuranceAnnee, interetsPayesAnnee } from './interets';
export { fraisDeductiblesAnnee1, projeterLmnpReel } from './lmnp-reel';
export { projeterMicroBic } from './micro-bic';
export { projeterMicroFoncier } from './micro-foncier';
export { projeterNuReel } from './nu-reel';
export type {
  AnneeFiscale,
  ContexteFiscal,
  MotifIneligibilite,
  ResultatFiscalite,
  ResultatRegime,
  StocksFiscaux,
} from './types';
