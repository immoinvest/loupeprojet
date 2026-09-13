import type { ResultatFinancement } from '../financement';
import type { ModeLocation, Regime } from '../schema/hypotheses';
import type { Projet } from '../schema/projet';
import { chargesExploitation, totalCharges, type LigneCharge } from './charges';
import { recettesAnnuelles, type Recettes } from './recettes';

export interface CashflowAnnuel {
  readonly annee: number;
  readonly recettes: number;
  readonly charges: number;
  /** Mensualités + assurance réellement payées cette année (différés compris). */
  readonly credit: number;
  readonly avantImpot: number;
}

export interface ResultatCashflow {
  readonly regime: Regime;
  readonly recettes: Recettes;
  readonly charges: readonly LigneCharge[];
  readonly chargesAnnuelles: number;
  /** Cash-flow mensuel en régime de croisière, vacance et charges pleines déduites. */
  readonly mensuel: number;
  readonly mensuelHorsVacance: number;
  /** Ce qu'il faut sortir de sa poche chaque mois si le cash-flow est négatif. */
  readonly effortEpargne: number;
  /** Loyer HC mensuel qui équilibre le cash-flow ; `null` en courte durée. */
  readonly pointMort: number | null;
  /** Mensualité assurance comprise ÷ loyer HC ; `null` sans loyer. */
  readonly tauxCouverture: number | null;
  readonly parAnnee: readonly CashflowAnnuel[];
}

export interface OptionsCashflow {
  readonly regime?: Regime;
  readonly mode?: ModeLocation;
  readonly loyerHc?: number;
}

const SEMAINES_PAR_AN = 52;

function pointMort(
  projet: Projet,
  recettes: Recettes,
  chargesFixes: number,
  creditAnnuel: number,
): number | null {
  if (recettes.mode === 'courte_duree') return null;
  const { vacanceSemaines, gestionTaux } = projet.hypotheses.location;
  const partEncaissee = 12 * (1 - vacanceSemaines / SEMAINES_PAR_AN) * (1 - gestionTaux);
  return partEncaissee > 0 ? (chargesFixes + creditAnnuel) / partEncaissee : null;
}

function creditDeAnnee(financement: ResultatFinancement, annee: number): number {
  const a = financement.parAnnee.find((x) => x.annee === annee);
  return a === undefined ? 0 : a.mensualites + a.assurance;
}

export function calculerCashflow(
  projet: Projet,
  financement: ResultatFinancement,
  options: OptionsCashflow = {},
): ResultatCashflow {
  const { hypotheses } = projet;
  const regime = options.regime ?? hypotheses.fiscalite.regime;
  const surcharge = {
    ...(options.mode !== undefined ? { mode: options.mode } : {}),
    ...(options.loyerHc !== undefined ? { loyerHc: options.loyerHc } : {}),
  };
  const recettes = recettesAnnuelles(hypotheses.location, surcharge);
  const charges = chargesExploitation(hypotheses, regime, recettes.loyersNets);
  const chargesAnnuelles = totalCharges(charges);
  const chargesFixes = chargesAnnuelles - hypotheses.location.gestionTaux * recettes.loyersNets;
  const creditCroisiere = financement.mensualiteTotale * 12;

  const mensuel = (recettes.loyersNets - chargesAnnuelles - creditCroisiere) / 12;
  const mensuelHorsVacance = mensuel + recettes.vacance / 12;
  const loyerReference = options.loyerHc ?? hypotheses.location.loyerHc;

  const parAnnee: CashflowAnnuel[] = [];
  for (let annee = 1; annee <= hypotheses.revente.annees; annee += 1) {
    const credit = creditDeAnnee(financement, annee);
    parAnnee.push({
      annee,
      recettes: recettes.loyersNets,
      charges: chargesAnnuelles,
      credit,
      avantImpot: recettes.loyersNets - chargesAnnuelles - credit,
    });
  }

  return {
    regime,
    recettes,
    charges,
    chargesAnnuelles,
    mensuel,
    mensuelHorsVacance,
    effortEpargne: Math.max(0, -mensuel),
    pointMort: pointMort(projet, recettes, chargesFixes, creditCroisiere),
    tauxCouverture: loyerReference > 0 ? financement.mensualiteTotale / loyerReference : null,
    parAnnee,
  };
}

export {
  chargesExploitation,
  estMeuble,
  totalCharges,
  type CodeCharge,
  type LigneCharge,
} from './charges';
export {
  recettesAnnuelles,
  type DetailCourteDuree,
  type Recettes,
  type SurchargeRecettes,
} from './recettes';
