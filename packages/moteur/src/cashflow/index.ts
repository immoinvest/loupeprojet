import type { ResultatFinancement } from '../financement';
import { tauxProportionnel, vacanceSemaines } from '../location/equivalents';
import type { Location, Regime } from '../schema/hypotheses';
import type { Projet } from '../schema/projet';
import {
  CODES_PROPORTIONNELS,
  chargesExploitation,
  totalCharges,
  type LigneCharge,
} from './charges';
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
  /** Loyer HC mensuel (total en colocation) qui équilibre le cash-flow ; `null` en courte durée. */
  readonly pointMort: number | null;
  /** Mensualité assurance comprise ÷ loyer mensuel hors charges ; `null` sans loyer. */
  readonly tauxCouverture: number | null;
  readonly parAnnee: readonly CashflowAnnuel[];
}

export interface OptionsCashflow {
  readonly regime?: Regime;
  /** Location à projeter à la place de celle du projet (régime d'un autre type, scénarios). */
  readonly location?: Location;
}

const SEMAINES_PAR_AN = 52;
const MOIS_PAR_AN = 12;

/**
 * Loyer mensuel hors charges qui annule le cash-flow : (fixes + crédit) ÷ ((1 − vacance)(1 − frais
 * proportionnels)), moins les forfaits déjà encaissés, ramené au mois.
 */
function pointMort(
  location: Location,
  recettes: Recettes,
  chargesFixes: number,
  creditAnnuel: number,
): number | null {
  if (location.mode === 'courte_duree') return null;
  const part =
    (1 - vacanceSemaines(location) / SEMAINES_PAR_AN) * (1 - tauxProportionnel(location));
  if (part <= 0) return null;
  return ((chargesFixes + creditAnnuel) / part - recettes.chargesRecuperees) / MOIS_PAR_AN;
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
  const location = options.location ?? hypotheses.location;
  const recettes = recettesAnnuelles(location);
  const charges = chargesExploitation(hypotheses, location, regime, recettes);
  const chargesAnnuelles = totalCharges(charges);
  const chargesFixes = totalCharges(charges.filter((l) => !CODES_PROPORTIONNELS.includes(l.code)));
  const creditCroisiere = financement.mensualiteTotale * MOIS_PAR_AN;

  const mensuel = (recettes.loyersNets - chargesAnnuelles - creditCroisiere) / MOIS_PAR_AN;
  const mensuelHorsVacance = mensuel + recettes.vacance / MOIS_PAR_AN;
  const loyerMensuel = recettes.loyersBruts / MOIS_PAR_AN;

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
    pointMort: pointMort(location, recettes, chargesFixes, creditCroisiere),
    tauxCouverture: loyerMensuel > 0 ? financement.mensualiteTotale / loyerMensuel : null,
    parAnnee,
  };
}

export {
  CODES_CHARGES,
  CODES_PROPORTIONNELS,
  chargesExploitation,
  estMeuble,
  totalCharges,
  type CodeCharge,
  type LigneCharge,
} from './charges';
export { recettesAnnuelles, type Recettes } from './recettes';
