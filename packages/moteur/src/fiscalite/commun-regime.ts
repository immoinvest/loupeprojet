import type { Regime } from '../schema/hypotheses';
import type {
  AnneeFiscale,
  ContexteFiscal,
  MotifIneligibilite,
  ResultatRegime,
  StocksFiscaux,
} from './types';

export interface BrouillonAnnee {
  readonly annee: number;
  readonly recettes: number;
  readonly chargesDeductibles: number;
  readonly interetsDeductibles: number;
  readonly amortissementsDeduits: number;
  readonly deficitImpute: number;
  readonly deficitImputeRevenuGlobal: number;
  readonly baseImposable: number;
  readonly impotRevenu: number;
  readonly prelevementsSociaux: number;
  readonly avantImpot: number;
  readonly stocks: StocksFiscaux;
}

export const SANS_STOCKS: StocksFiscaux = { deficitReportable: 0, amortissementsReportes: 0 };

export function construireAnnee(b: BrouillonAnnee): AnneeFiscale {
  const impot = b.impotRevenu + b.prelevementsSociaux;
  return {
    annee: b.annee,
    recettes: b.recettes,
    chargesDeductibles: b.chargesDeductibles,
    interetsDeductibles: b.interetsDeductibles,
    amortissementsDeduits: b.amortissementsDeduits,
    deficitImpute: b.deficitImpute,
    deficitImputeRevenuGlobal: b.deficitImputeRevenuGlobal,
    baseImposable: b.baseImposable,
    impotRevenu: b.impotRevenu,
    prelevementsSociaux: b.prelevementsSociaux,
    impot,
    cashflowApresImpot: b.avantImpot - impot,
    stocks: b.stocks,
  };
}

export type Eligibilite =
  | { readonly eligible: true }
  | { readonly eligible: false; readonly motifIneligibilite: MotifIneligibilite };

export type OptionsFinalisation = Eligibilite & {
  readonly amortissementsImmeubleDeduits?: number;
};

/** Les régimes micro ne sont ouverts que sous un plafond de recettes. */
export function eligibiliteMicro(recettes: number, plafond: number): Eligibilite {
  return recettes <= plafond
    ? { eligible: true }
    : { eligible: false, motifIneligibilite: 'PLAFOND_MICRO_DEPASSE' };
}

export function finaliserRegime(
  regime: Regime,
  ctx: ContexteFiscal,
  annees: readonly AnneeFiscale[],
  options: OptionsFinalisation,
): ResultatRegime {
  return {
    regime,
    mode: ctx.cashflow.recettes.mode,
    eligible: options.eligible,
    motifIneligibilite: options.eligible ? null : options.motifIneligibilite,
    cashflow: ctx.cashflow,
    annees,
    impotTotal: annees.reduce((acc, a) => acc + a.impot, 0),
    cashflowApresImpotTotal: annees.reduce((acc, a) => acc + a.cashflowApresImpot, 0),
    premiereAnneeImposable: annees.find((a) => a.impot > 0)?.annee ?? null,
    amortissementsImmeubleDeduits: options.amortissementsImmeubleDeduits ?? 0,
  };
}
