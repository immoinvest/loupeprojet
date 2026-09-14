import type { LocationComplete, ModeLocation } from '../schema/hypotheses';

/** Le loyer est un nombre : un projet sans loyer n'a pas de recettes calculables. */
type Location = LocationComplete;

export interface Recettes {
  readonly mode: ModeLocation;
  /**
   * Loyers annuels hors charges avant vacance : loyer × 12, chambres × loyer par chambre × 12,
   * nuitée × nuitées. Base du rendement brut.
   */
  readonly loyersBruts: number;
  /** Forfaits de charges et ménage facturés, avant vacance : des recettes imposables, pas des loyers. */
  readonly chargesRecuperees: number;
  /** Perte liée aux semaines vides, sur loyers et forfaits (0 en courte durée : les nuitées la portent). */
  readonly vacance: number;
  /** Recettes annuelles encaissées, base du cash-flow et de la fiscalité. */
  readonly loyersNets: number;
  /** Nuits louées dans l'année (courte durée seulement). */
  readonly nuitees: number | null;
  /** Séjours dans l'année (courte et moyenne durée) : autant de ménages. */
  readonly sejours: number | null;
}

const SEMAINES_PAR_AN = 52;
const MOIS_PAR_AN = 12;

function avecVacance(
  mode: ModeLocation,
  loyersBruts: number,
  chargesRecuperees: number,
  semainesVides: number,
  sejours: number | null = null,
): Recettes {
  const total = loyersBruts + chargesRecuperees;
  const vacance = total * (semainesVides / SEMAINES_PAR_AN);
  return {
    mode,
    loyersBruts,
    chargesRecuperees,
    vacance,
    loyersNets: total - vacance,
    nuitees: null,
    sejours,
  };
}

function recettesCourteDuree(location: Extract<Location, { mode: 'courte_duree' }>): Recettes {
  const nuitees = location.nuiteesParMois * MOIS_PAR_AN;
  const sejours = nuitees / location.dureeSejourNuits;
  const loyersBruts = location.nuitee * nuitees;
  const chargesRecuperees = sejours * location.menageFactureParSejour;
  return {
    mode: 'courte_duree',
    loyersBruts,
    chargesRecuperees,
    vacance: 0,
    loyersNets: loyersBruts + chargesRecuperees,
    nuitees,
    sejours,
  };
}

/** Recettes annuelles selon le type d'exploitation (stratégie par variante). */
export function recettesAnnuelles(location: Location): Recettes {
  switch (location.mode) {
    case 'nu':
    case 'meuble':
      return avecVacance(
        location.mode,
        location.loyerHc * MOIS_PAR_AN,
        0,
        location.vacanceSemaines,
      );
    case 'colocation':
      return avecVacance(
        'colocation',
        location.loyerChambre * location.chambres * MOIS_PAR_AN,
        location.forfaitChargesChambre * location.chambres * MOIS_PAR_AN,
        location.vacanceSemaines,
      );
    case 'moyenne_duree': {
      const partOccupee = 1 - location.vacanceSemaines / SEMAINES_PAR_AN;
      const sejours = (MOIS_PAR_AN * partOccupee) / location.dureeSejourMois;
      return avecVacance(
        'moyenne_duree',
        location.loyerHc * MOIS_PAR_AN,
        location.forfaitCharges * MOIS_PAR_AN,
        location.vacanceSemaines,
        sejours,
      );
    }
    case 'courte_duree':
      return recettesCourteDuree(location);
  }
}
