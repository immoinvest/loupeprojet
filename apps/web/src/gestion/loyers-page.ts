import {
  JourSchema,
  montantAcceptable,
  periodeDe,
  PeriodeSchema,
  type LigneLoyer,
  type NouveauPaiement,
} from '@loupe/gestion';

import { centimesDepuisTexte } from './saisie';

/** Les groupes de la page Loyers, dans l'ordre de l'écran ; « à venir » rejoint les attendus. */
export const GROUPES_LOYERS = ['en_retard', 'partiel', 'attendu', 'recu'] as const;
export type GroupeLoyer = (typeof GROUPES_LOYERS)[number];

export interface GroupeDuMois {
  readonly groupe: GroupeLoyer;
  readonly lignes: readonly LigneLoyer[];
}

/** `?mois=2026-10` s'il est valide, sinon le mois en cours. */
export function periodeDepuisRecherche(mois: string | null, aujourdhui: string): string {
  return mois !== null && PeriodeSchema.safeParse(mois).success ? mois : periodeDe(aujourdhui);
}

function groupeDe(ligne: LigneLoyer): GroupeLoyer {
  return ligne.statut === 'a_venir' ? 'attendu' : ligne.statut;
}

/** Les lignes du mois rangées par groupe ; un groupe vide n'apparaît pas. */
export function groupesDuMois(lignes: readonly LigneLoyer[]): readonly GroupeDuMois[] {
  return GROUPES_LOYERS.map((groupe) => ({
    groupe,
    lignes: lignes.filter((l) => groupeDe(l) === groupe),
  })).filter((g) => g.lignes.length > 0);
}

/** « En partie » tel que tapé : un montant en texte et la date du paiement. */
export interface SaisieEnPartie {
  readonly montant: string;
  readonly date: string;
}

export type ChampEnPartie = 'montant' | 'date';

export type ResultatEnPartie =
  | { readonly ok: true; readonly paiement: NouveauPaiement }
  | { readonly ok: false; readonly erreurs: readonly ChampEnPartie[] };

export function saisieEnPartie(aujourdhui: string): SaisieEnPartie {
  return { montant: '', date: aujourdhui };
}

/**
 * Le paiement à enregistrer, ou les champs à corriger : un montant d'au moins un centime et d'au
 * plus ce qui reste dû ; une date réelle qui n'est pas dans le futur (le serveur vérifie de même).
 */
export function paiementEnPartie(
  ligne: LigneLoyer,
  saisie: SaisieEnPartie,
  aujourdhui: string,
): ResultatEnPartie {
  const erreurs: ChampEnPartie[] = [];
  const montant = centimesDepuisTexte(saisie.montant);
  if (montant === null || !montantAcceptable(ligne.du, ligne.paiements, montant)) {
    erreurs.push('montant');
  }
  if (!JourSchema.safeParse(saisie.date).success || saisie.date > aujourdhui) erreurs.push('date');
  if (montant === null || erreurs.length > 0) return { ok: false, erreurs };
  return {
    ok: true,
    paiement: {
      locationId: ligne.location.id,
      periode: ligne.du.periode,
      montant,
      date: saisie.date,
    },
  };
}

/** « Quittance » : un loyer entièrement reçu, par au moins un paiement (un loyer nul n'en a pas). */
export function quittancePossible(ligne: LigneLoyer): boolean {
  return ligne.statut === 'recu' && ligne.paiements.length > 0;
}

/** Les paiements d'un loyer partiel, chacun avec son reçu (art. 21 : un reçu par paiement partiel). */
export function paiementsAvecRecu(ligne: LigneLoyer): LigneLoyer['paiements'] {
  return ligne.statut === 'partiel' ? ligne.paiements : [];
}
