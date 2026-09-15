import type { StatutLoyer } from '@loupe/gestion';

import type { TonPastille } from '@/composants/ui';
import type { EtatDuBien, StatutBien } from '@/gestion/fiche';
import { dateEnLettres } from '@/gestion/format';

import { STATUTS_LOYER, TONS_LOYER } from './gerer-ecrans';

/** Textes de la fiche d'un bien (tutoiement). */
export const TEXTES_FICHE = {
  introuvable: 'Bien introuvable',
  introuvableTexte: 'Ce bien n’existe pas, ou il appartient à un autre compte.',
  voirLoyers: 'Voir les loyers',
  voirAnalyse: 'Voir l’analyse',
  aucuneLocation: 'Aucun locataire en ce moment.',
  locationEnCours: 'Location en cours',
  locationAVenir: 'Location à venir',
  loyer: 'Loyer hors charges',
  charges: 'Charges',
  depot: 'Dépôt de garantie',
  jourLoyer: 'Loyer attendu',
  entree: 'Entrée',
  sortie: 'Sortie',
  terminer: 'Terminer la location',
  dateSortie: 'Date de sortie',
  enregistrerSortie: 'Enregistrer la sortie',
  fermer: 'Fermer',
  douzeMois: 'Les 12 derniers mois',
  erreurDateSortie: 'Indique une date de sortie valide.',
  rappelCaf: 'Pense à prévenir la CAF du départ de ton locataire.',
} as const;

export const TONS_BIEN: Readonly<Record<StatutBien, TonPastille>> = {
  loue: 'bon',
  vacant: 'neutre',
  depart_prevu: 'surveiller',
  a_venir: 'accent',
};

/** « Loué », « Vacant », « Départ prévu le 14 mars 2027 », « Entrée le 1er octobre 2026 ». */
export function statutDuBien(etat: EtatDuBien): string {
  switch (etat.statut) {
    case 'loue':
      return 'Loué';
    case 'vacant':
      return 'Vacant';
    case 'depart_prevu':
      return `Départ prévu le ${dateEnLettres(etat.date)}`;
    case 'a_venir':
      return `Entrée le ${dateEnLettres(etat.date)}`;
  }
}

/** « Location en cours », « Location à venir · Chambre 2 ». */
export function titreLocation(libelle: string | undefined, aVenir: boolean): string {
  const titre = aVenir ? TEXTES_FICHE.locationAVenir : TEXTES_FICHE.locationEnCours;
  return libelle === undefined ? titre : `${titre} · ${libelle}`;
}

export const STATUTS_FRISE: Readonly<Record<StatutLoyer | 'vacant', string>> = {
  ...STATUTS_LOYER,
  vacant: 'Vacant',
};

export const TONS_FRISE: Readonly<Record<StatutLoyer | 'vacant', TonPastille>> = {
  ...TONS_LOYER,
  vacant: 'neutre',
};

const MOIS_COURT = new Intl.DateTimeFormat('fr-FR', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** « 2026-09 » → « sept. 2026 ». */
export function moisCourt(periode: string): string {
  return MOIS_COURT.format(new Date(`${periode}-01T00:00:00Z`));
}

/** « Quittance » pour le bien entier, « Quittance · Chambre 2 » pour une chambre. */
export function quittanceDuMois(libelle: string | undefined): string {
  return libelle === undefined ? 'Quittance' : `Quittance · ${libelle}`;
}
