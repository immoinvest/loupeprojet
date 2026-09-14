import { ajouterJours, bornesPeriode } from './dates';
import { DELAI_RETARD_JOURS } from './regles';
import type { LocationGeree, Paiement } from './schemas';

/** Ce qu'une location doit pour un mois donné (au prorata des jours occupés). */
export interface LoyerDu {
  readonly locationId: string;
  readonly periode: string;
  /** Premier jour occupé du mois (l'entrée si elle tombe dans le mois). */
  readonly debut: string;
  /** Dernier jour occupé du mois (la sortie si elle tombe dans le mois). */
  readonly fin: string;
  /** Date due : le jour du loyer, ou l'entrée si elle vient après. */
  readonly echeance: string;
  readonly loyerHorsCharges: number;
  readonly charges: number;
  readonly total: number;
  readonly joursOccupes: number;
  readonly joursDuMois: number;
}

export type StatutLoyer = 'a_venir' | 'attendu' | 'en_retard' | 'partiel' | 'recu';

export interface SuiviLoyer {
  readonly statut: StatutLoyer;
  /** Somme des paiements de la période pour cette location. */
  readonly recu: number;
  /** Ce qui manque pour couvrir le loyer dû ; 0 dès qu'il est couvert. */
  readonly resteDu: number;
  readonly paiements: readonly Paiement[];
}

type Occupation = Pick<
  LocationGeree,
  'id' | 'debut' | 'fin' | 'jourLoyer' | 'loyerHorsCharges' | 'charges'
>;

function jourDuMois(jour: string): number {
  return Number(jour.slice(8, 10));
}

/**
 * Le loyer dû par la location pour la période, ou `null` si elle n'occupe aucun jour du mois.
 * Prorata au jour près : montant × jours occupés ÷ jours du mois, arrondi au centime le plus proche,
 * loyer et charges séparément (ils figurent séparément sur la quittance).
 */
export function loyerDuMois(location: Occupation, periode: string): LoyerDu | null {
  const mois = bornesPeriode(periode);
  const debut = location.debut > mois.debut ? location.debut : mois.debut;
  const fin = location.fin !== undefined && location.fin < mois.fin ? location.fin : mois.fin;
  if (debut > fin) return null;

  const joursOccupes = jourDuMois(fin) - jourDuMois(debut) + 1;
  const auProrata = (centimes: number): number =>
    Math.round((centimes * joursOccupes) / mois.jours);
  const loyerHorsCharges = auProrata(location.loyerHorsCharges);
  const charges = auProrata(location.charges);
  const echeanceDuBail = `${periode}-${String(location.jourLoyer).padStart(2, '0')}`;

  return {
    locationId: location.id,
    periode,
    debut,
    fin,
    echeance: echeanceDuBail < debut ? debut : echeanceDuBail,
    loyerHorsCharges,
    charges,
    total: loyerHorsCharges + charges,
    joursOccupes,
    joursDuMois: mois.jours,
  };
}

function statutDuLoyer(du: LoyerDu, recu: number, aujourdhui: string): StatutLoyer {
  if (recu >= du.total) return 'recu';
  // Un reçu est dû au locataire dès le premier centime (loi n° 89-462, art. 21) : on le montre.
  if (recu > 0) return 'partiel';
  if (aujourdhui < du.debut) return 'a_venir';
  return aujourdhui >= ajouterJours(du.echeance, DELAI_RETARD_JOURS) ? 'en_retard' : 'attendu';
}

/**
 * Où en est un loyer dû à une date : reçu dès que les paiements de la période le couvrent, partiel
 * s'ils en couvrent une part ; sinon à venir avant le premier jour occupé, attendu jusqu'à la date
 * due + 4 jours, en retard ensuite.
 */
export function suivreLoyer(
  du: LoyerDu,
  paiements: readonly Paiement[],
  aujourdhui: string,
): SuiviLoyer {
  const siens = paiements.filter((p) => p.locationId === du.locationId && p.periode === du.periode);
  const recu = siens.reduce((somme, p) => somme + p.montant, 0);
  return {
    statut: statutDuLoyer(du, recu, aujourdhui),
    recu,
    resteDu: Math.max(0, du.total - recu),
    paiements: siens,
  };
}

/** Un paiement de ce montant tient-il dans ce qui reste dû ? (au moins un centime, jamais au-delà) */
export function montantAcceptable(
  du: LoyerDu,
  paiements: readonly Paiement[],
  montant: number,
): boolean {
  const { resteDu } = suivreLoyer(du, paiements, du.debut);
  return Number.isInteger(montant) && montant >= 1 && montant <= resteDu;
}
