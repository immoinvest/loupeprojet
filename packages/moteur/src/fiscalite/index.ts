import { calculerCashflow, type ResultatCashflow } from '../cashflow';
import { estMeuble } from '../cashflow/charges';
import type { ResultatFinancement } from '../financement';
import { loyerMensuelReference } from '../location/equivalents';
import type { Regles } from '../regles/types';
import { reventeParRegime } from '../revente/par-regime';
import {
  regimesCompatibles,
  type HypothesesCompletes,
  type LocationComplete,
  type Regime,
} from '../schema/hypotheses';
import type { ProjetComplet } from '../schema/projet';
import { projeterLmnpReel } from './lmnp-reel';
import { projeterMicroBic } from './micro-bic';
import { projeterMicroFoncier } from './micro-foncier';
import { projeterNuReel } from './nu-reel';
import { bilanRegime } from './bilan';
import type { ContexteFiscal, ProjectionRegime, ResultatFiscalite, ResultatRegime } from './types';

export const REGIMES: readonly Regime[] = ['micro_bic', 'lmnp_reel', 'micro_foncier', 'nu_reel'];

const PROJECTEURS: Readonly<Record<Regime, (ctx: ContexteFiscal) => ProjectionRegime>> = {
  micro_bic: projeterMicroBic,
  lmnp_reel: projeterLmnpReel,
  micro_foncier: projeterMicroFoncier,
  nu_reel: projeterNuReel,
};

/**
 * La location à projeter pour un régime : les régimes du meublé prennent la location du projet
 * (ou une meublée au loyer majoré de la prime pour une location nue) ; les régimes fonciers prennent
 * une location nue (loyer nu saisi, sinon loyer meublé de référence ÷ (1 + prime)), avec la vacance
 * et la gestion du projet quand le type les porte.
 */
export function locationPourRegime(
  hypotheses: HypothesesCompletes,
  regime: Regime,
  regles: Regles,
): LocationComplete {
  const { location } = hypotheses;
  const prime = 1 + regles.exploitation.primeMeuble;
  if (estMeuble(regime)) {
    if (location.mode !== 'nu') return location;
    return {
      mode: 'meuble',
      loyerHc: location.loyerHc * prime,
      chargesLocataire: location.chargesLocataire,
      vacanceSemaines: location.vacanceSemaines,
      gestionTaux: location.gestionTaux,
    };
  }
  if (location.mode === 'nu') return location;
  const defauts = regles.exploitation.parType.nu;
  if (location.mode === 'meuble') {
    return {
      mode: 'nu',
      loyerHc: location.loyerHcNu ?? location.loyerHc / prime,
      chargesLocataire: location.chargesLocataire,
      vacanceSemaines: location.vacanceSemaines,
      gestionTaux: location.gestionTaux,
    };
  }
  const courteDuree = location.mode === 'courte_duree';
  return {
    mode: 'nu',
    loyerHc: loyerMensuelReference(location, regles) / prime,
    chargesLocataire: 0,
    vacanceSemaines: courteDuree ? defauts.vacanceSemaines : location.vacanceSemaines,
    gestionTaux: courteDuree ? defauts.gestionTaux : location.gestionTaux,
  };
}

/** Cash-flow avant impôt d'un régime, avec le loyer et les charges de sa location. */
export function cashflowDuRegime(
  projet: ProjetComplet,
  financement: ResultatFinancement,
  regime: Regime,
  regles: Regles,
): ResultatCashflow {
  const location = locationPourRegime(projet.hypotheses, regime, regles);
  return calculerCashflow(projet, financement, { regime, location });
}

function meilleurSelon(
  regimes: readonly ResultatRegime[],
  compatibles: readonly Regime[],
  score: (r: ResultatRegime) => number,
): Regime {
  const candidats = regimes.filter((r) => r.eligible && compatibles.includes(r.regime));
  return candidats.reduce((meilleur, r) => (score(r) > score(meilleur) ? r : meilleur)).regime;
}

export function calculerFiscalite(
  projet: ProjetComplet,
  financement: ResultatFinancement,
  regles: Regles,
): ResultatFiscalite {
  const projections = REGIMES.map((regime) => {
    const cashflow = cashflowDuRegime(projet, financement, regime, regles);
    return PROJECTEURS[regime]({ projet, financement, cashflow, regles });
  });
  const reventes = reventeParRegime(projet, financement, projections, regles);
  const resultats = projections.map((p) => bilanRegime(p, reventes[p.regime]));
  const regimes = Object.fromEntries(resultats.map((r) => [r.regime, r])) as Record<
    Regime,
    ResultatRegime
  >;
  const compatibles = regimesCompatibles(projet.hypotheses.location.mode);
  return {
    regimes,
    compatibles,
    retenu: projet.hypotheses.fiscalite.regime,
    meilleur: meilleurSelon(resultats, compatibles, (r) => r.cashflowApresImpotTotal),
    meilleurImpot: meilleurSelon(resultats, compatibles, (r) => -r.impotTotal),
    meilleurAuTotal: meilleurSelon(resultats, compatibles, (r) => r.enrichissementFinal),
  };
}

export { baseAmortissableBati, dotationsAnnee, type DotationsAnnee } from './amortissements';
export { bilanRegime } from './bilan';
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
  ProjectionRegime,
  ResultatFiscalite,
  ResultatRegime,
  StocksFiscaux,
} from './types';
