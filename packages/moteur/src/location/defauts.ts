import type { Regles } from '../regles/types';
import type { Location, ModeLocation } from '../schema/hypotheses';
import { JOURS_PAR_MOIS } from './equivalents';

export interface ContexteDefauts {
  /** Loyer mensuel hors charges d'une location meublée longue durée équivalente (le pivot). */
  readonly loyerMensuel: number;
  /** Chambres louables (colocation) ; 1 au moins. */
  readonly chambres: number;
}

/** Charges d'abonnement à la charge du propriétaire, proposées avec le type. */
export interface ChargesProprietaire {
  readonly energieMensuel: number;
  readonly internetMensuel: number;
}

export interface DefautsLocation {
  readonly location: Location;
  readonly charges: ChargesProprietaire;
}

const NUITEE_MINIMALE = 30;
const SANS_CHARGES: ChargesProprietaire = { energieMensuel: 0, internetMensuel: 0 };

/**
 * La variante complète d'un type, avec les valeurs de départ des règles datées : la seule source
 * des défauts (écran Vérifier, changement de type dans Hypothèses, scénario colocation).
 * Le forfait de charges comprises couvre exactement les abonnements du propriétaire (choix neutre).
 */
export function defautsPourMode(
  mode: ModeLocation,
  regles: Regles,
  contexte: ContexteDefauts,
): DefautsLocation {
  const { parType, primeMeuble, primeColocation } = regles.exploitation;
  const chambres = Math.max(1, Math.round(contexte.chambres));
  switch (mode) {
    case 'nu':
      return {
        location: {
          mode: 'nu',
          loyerHc: Math.round(contexte.loyerMensuel / (1 + primeMeuble)),
          chargesLocataire: 0,
          vacanceSemaines: parType.nu.vacanceSemaines,
          gestionTaux: parType.nu.gestionTaux,
        },
        charges: SANS_CHARGES,
      };
    case 'meuble':
      return {
        location: {
          mode: 'meuble',
          loyerHc: Math.round(contexte.loyerMensuel),
          chargesLocataire: 0,
          vacanceSemaines: parType.meuble.vacanceSemaines,
          gestionTaux: parType.meuble.gestionTaux,
        },
        charges: SANS_CHARGES,
      };
    case 'colocation': {
      const d = parType.colocation;
      const charges = { energieMensuel: d.energieMensuel, internetMensuel: d.internetMensuel };
      return {
        location: {
          mode: 'colocation',
          chambres,
          loyerChambre: Math.round((contexte.loyerMensuel * (1 + primeColocation)) / chambres),
          forfaitChargesChambre: Math.round((d.energieMensuel + d.internetMensuel) / chambres),
          vacanceSemaines: d.vacanceSemaines,
          gestionTaux: d.gestionTaux,
        },
        charges,
      };
    }
    case 'courte_duree': {
      const d = parType.courte_duree;
      return {
        location: {
          mode: 'courte_duree',
          nuitee: Math.max(
            NUITEE_MINIMALE,
            Math.round((contexte.loyerMensuel / JOURS_PAR_MOIS) * d.nuiteeEnLoyersJournaliers),
          ),
          nuiteesParMois: d.nuiteesParMois,
          dureeSejourNuits: d.dureeSejourNuits,
          menageFactureParSejour: d.menageParSejour,
          menageCoutParSejour: d.menageParSejour,
          plateformeTaux: d.plateformeTaux,
          conciergerieTaux: d.conciergerieTaux,
          tourismeClasse: false,
        },
        charges: { energieMensuel: d.energieMensuel, internetMensuel: d.internetMensuel },
      };
    }
    case 'moyenne_duree': {
      const d = parType.moyenne_duree;
      return {
        location: {
          mode: 'moyenne_duree',
          loyerHc: Math.round(contexte.loyerMensuel),
          forfaitCharges: d.energieMensuel + d.internetMensuel,
          dureeSejourMois: d.dureeSejourMois,
          vacanceSemaines: d.vacanceSemaines,
          menageCoutParSejour: d.menageParSejour,
          plateformeTaux: d.plateformeTaux,
          gestionTaux: d.gestionTaux,
        },
        charges: { energieMensuel: d.energieMensuel, internetMensuel: d.internetMensuel },
      };
    }
  }
}
