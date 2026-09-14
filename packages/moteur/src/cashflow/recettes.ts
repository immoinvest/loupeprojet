import type { LocationComplete, ModeLocation } from '../schema/hypotheses';

/** Le loyer est un nombre : un projet sans loyer n'a pas de recettes calculables. */
type Location = LocationComplete;

export interface DetailCourteDuree {
  readonly nuitees: number;
  readonly recettesBrutes: number;
  readonly menage: number;
  readonly conciergerie: number;
}

export interface Recettes {
  readonly mode: ModeLocation;
  /** Loyers annuels hors charges avant vacance (ou recettes brutes en courte durée). */
  readonly loyersBruts: number;
  /** Perte de loyer liée à la vacance (0 en courte durée : l'occupation la porte déjà). */
  readonly vacance: number;
  /** Recettes annuelles encaissées, base du cash-flow et de la fiscalité. */
  readonly loyersNets: number;
  readonly courteDuree: DetailCourteDuree | null;
}

export interface SurchargeRecettes {
  readonly mode?: ModeLocation;
  readonly loyerHc?: number;
}

const JOURS_PAR_AN = 365;
const SEMAINES_PAR_AN = 52;

function recettesLongueDuree(
  mode: ModeLocation,
  loyerHc: number,
  vacanceSemaines: number,
): Recettes {
  const loyersBruts = loyerHc * 12;
  const vacance = loyersBruts * (vacanceSemaines / SEMAINES_PAR_AN);
  return { mode, loyersBruts, vacance, loyersNets: loyersBruts - vacance, courteDuree: null };
}

function recettesCourteDuree(cd: NonNullable<Location['courteDuree']>): Recettes {
  const nuitees = JOURS_PAR_AN * cd.tauxOccupation;
  const recettesBrutes = cd.nuitee * nuitees;
  const menage = cd.fraisMenageParNuit * nuitees;
  const conciergerie = cd.conciergerieTaux * recettesBrutes;
  return {
    mode: 'courte_duree',
    loyersBruts: recettesBrutes,
    vacance: 0,
    loyersNets: recettesBrutes - menage - conciergerie,
    courteDuree: { nuitees, recettesBrutes, menage, conciergerie },
  };
}

/**
 * Recettes annuelles selon le mode d'exploitation. La surcharge permet de
 * simuler un autre mode ou un autre loyer (régimes nus, point mort, scénarios).
 */
export function recettesAnnuelles(location: Location, surcharge: SurchargeRecettes = {}): Recettes {
  const mode = surcharge.mode ?? location.mode;
  if (mode === 'courte_duree' && location.courteDuree !== undefined) {
    return recettesCourteDuree(location.courteDuree);
  }
  const loyerHc = surcharge.loyerHc ?? location.loyerHc;
  return recettesLongueDuree(mode, loyerHc, location.vacanceSemaines);
}
