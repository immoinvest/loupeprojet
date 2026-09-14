import type { Regles } from '../regles/types';
import type { Location, LocationComplete, ModeLocation } from '../schema/hypotheses';

/** Jours retenus pour passer d'un loyer mensuel à un loyer journalier. */
export const JOURS_PAR_MOIS = 30;

/** Tout type sauf la location nue relève du meublé (BIC, mobilier, CFE). */
export function estModeMeuble(mode: ModeLocation): boolean {
  return mode !== 'nu';
}

/**
 * Loyer mensuel hors charges équivalent, quel que soit le type : sert au taux de couverture,
 * à l'effort HCSF et au plafond d'encadrement. En courte durée : nuitée × nuitées par mois.
 */
export function loyerMensuelHc(location: LocationComplete): number {
  switch (location.mode) {
    case 'nu':
    case 'meuble':
    case 'moyenne_duree':
      return location.loyerHc;
    case 'colocation':
      return location.loyerChambre * location.chambres;
    case 'courte_duree':
      return location.nuitee * location.nuiteesParMois;
  }
}

/**
 * Loyer mensuel d'une location meublée longue durée équivalente : le pivot commun à tous les
 * types (défauts d'un type, scénarios de changement de type, régimes nus). Inverse de `defautsPourMode`.
 */
export function loyerMensuelReference(location: LocationComplete, regles: Regles): number {
  const { primeMeuble, primeColocation, parType } = regles.exploitation;
  switch (location.mode) {
    case 'nu':
      return location.loyerHc * (1 + primeMeuble);
    case 'meuble':
    case 'moyenne_duree':
      return location.loyerHc;
    case 'colocation':
      return (location.loyerChambre * location.chambres) / (1 + primeColocation);
    case 'courte_duree':
      return (location.nuitee * JOURS_PAR_MOIS) / parType.courte_duree.nuiteeEnLoyersJournaliers;
  }
}

/** Semaines vides par an ; la courte durée n'en a pas (les nuitées la portent déjà). */
export function vacanceSemaines(location: Location): number {
  return location.mode === 'courte_duree' ? 0 : location.vacanceSemaines;
}

/** Part des loyers encaissés qui repart en frais proportionnels : gestion, conciergerie, plateforme. */
export function tauxProportionnel(location: Location): number {
  switch (location.mode) {
    case 'nu':
    case 'meuble':
    case 'colocation':
      return location.gestionTaux;
    case 'courte_duree':
      return location.conciergerieTaux + location.plateformeTaux;
    case 'moyenne_duree':
      return location.gestionTaux + location.plateformeTaux;
  }
}
