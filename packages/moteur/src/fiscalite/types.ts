import type { ResultatCashflow } from '../cashflow';
import type { ResultatFinancement } from '../financement';
import type { Regles } from '../regles/types';
import type { ModeLocation, Regime } from '../schema/hypotheses';
import type { Projet } from '../schema/projet';

export type MotifIneligibilite = 'PLAFOND_MICRO_DEPASSE';

export interface StocksFiscaux {
  /** Déficits reportables (10 ans) non encore imputés. */
  readonly deficitReportable: number;
  /** Amortissements différés (art. 39 C), reportables sans limite. */
  readonly amortissementsReportes: number;
}

export interface AnneeFiscale {
  readonly annee: number;
  readonly recettes: number;
  readonly chargesDeductibles: number;
  readonly interetsDeductibles: number;
  readonly amortissementsDeduits: number;
  /** Déficits antérieurs imputés sur le résultat de l'année. */
  readonly deficitImpute: number;
  /** Déficit foncier imputé sur le revenu global (nu réel uniquement). */
  readonly deficitImputeRevenuGlobal: number;
  readonly baseImposable: number;
  /** Négatif quand un déficit foncier fait économiser de l'impôt sur le revenu global. */
  readonly impotRevenu: number;
  readonly prelevementsSociaux: number;
  readonly impot: number;
  readonly cashflowApresImpot: number;
  readonly stocks: StocksFiscaux;
}

export interface ResultatRegime {
  readonly regime: Regime;
  readonly mode: ModeLocation;
  readonly eligible: boolean;
  readonly motifIneligibilite: MotifIneligibilite | null;
  /** Cash-flow avant impôt propre à ce régime (loyer et charges du régime). */
  readonly cashflow: ResultatCashflow;
  readonly annees: readonly AnneeFiscale[];
  readonly impotTotal: number;
  readonly cashflowApresImpotTotal: number;
  readonly premiereAnneeImposable: number | null;
  /** Dotations sur l'immeuble (bâti + travaux) effectivement déduites : réintégrées à la plus-value. */
  readonly amortissementsImmeubleDeduits: number;
}

export interface ContexteFiscal {
  readonly projet: Projet;
  readonly financement: ResultatFinancement;
  readonly cashflow: ResultatCashflow;
  readonly regles: Regles;
}

export interface ResultatFiscalite {
  readonly regimes: Readonly<Record<Regime, ResultatRegime>>;
  /** Régime choisi dans les hypothèses : alimente revente, TRI et verdict. */
  readonly retenu: Regime;
  /** Régime éligible au meilleur cash-flow cumulé après impôt. */
  readonly meilleur: Regime;
  /** Régime éligible à l'impôt cumulé le plus faible (peut différer : les loyers nus sont plus bas). */
  readonly meilleurImpot: Regime;
}
