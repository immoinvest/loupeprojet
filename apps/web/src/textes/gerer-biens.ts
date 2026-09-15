import { moisEnLettres, montant } from '@/gestion/format';
import type { ChampModification } from '@/gestion/saisie-modifier';

import { de } from './gerer-ecrans';
import { nomsDesLocataires } from './gerer-loyers';

/** Textes de la page « Mes biens » (tutoiement). */
export const TEXTES_BIENS = {
  titre: 'Mes biens',
  ajouter: 'Ajouter un bien',
  sansLocataire: 'Sans locataire',
  ceMois: 'Ce mois-ci',
} as const;

/** « 1 bien », « 4 biens » : le titre de la page. */
export function nombreDeBiens(nombre: number): string {
  return `${String(nombre)} bien${nombre > 1 ? 's' : ''}`;
}

/**
 * Qui occupe le bien : « Julie Martin », « Julie Martin et Léa Bernard » (colocation à bail unique),
 * « 2 locations en cours » (location à la chambre), « Sans locataire ».
 */
export function occupantsDuBien(
  noms: readonly string[],
  locations: number,
  aVenir: boolean,
): string {
  if (noms.length === 0) return TEXTES_BIENS.sansLocataire;
  if (locations > 1) return `${String(locations)} locations ${aVenir ? 'à venir' : 'en cours'}`;
  return nomsDesLocataires(noms);
}

/** « 700 € par mois ». */
export function loyerParMois(centimes: number): string {
  return `${montant(centimes)} par mois`;
}

/** « Modifier » une location, sur sa carte dans la fiche du bien. */
export const TEXTES_MODIFIER = {
  modifier: 'Modifier',
  titre: 'Modifier la location',
  aPartirDe: 'Nouveaux montants à partir de',
  loyer: 'Loyer hors charges',
  charges: 'Charges',
  apl: 'APL versée par la CAF',
  jourLoyer: 'Jour du loyer',
  depot: 'Dépôt de garantie',
  libelle: 'Chambre (facultatif)',
  tousRegles:
    'Les loyers de cette location sont tous réglés : seuls le jour du loyer, le dépôt et la chambre se modifient.',
  enregistrer: 'Enregistrer',
  fermer: 'Fermer',
} as const;

export const ERREURS_MODIFIER: Readonly<Record<ChampModification, string>> = {
  loyer: 'Indique un loyer en euros, par exemple 650.',
  charges: 'Indique des charges en euros, ou laisse vide.',
  apl: 'Une aide en euros par mois, au plus le loyer charges comprises.',
  jourLoyer: 'Indique un jour entre 1 et 28.',
  depot:
    'Indique un dépôt en euros, au plus 1 mois de loyer en location vide et 2 mois en meublé (loi du 6 juillet 1989).',
  libelle: '40 caractères au plus.',
};

/** « depuis octobre 2026 », à côté d'un loyer changé. */
export function depuisLe(periode: string): string {
  return `depuis ${moisEnLettres(periode)}`;
}

/** Le prochain loyer changé, sur la carte de la location : « Loyer hors charges à partir de mars 2027 ». */
export function loyerAPartirDe(periode: string): string {
  return `Loyer hors charges à partir ${de(moisEnLettres(periode))}`;
}

/** « Supprimer ce bien », en bas de sa fiche. */
export const TEXTES_SUPPRIMER = {
  supprimer: 'Supprimer ce bien',
  titre: 'Supprimer ce bien ?',
  explication:
    'Ses locations, ses paiements, ses quittances et ses reçus disparaissent aussi, pour de bon. Garde-les trois ans : exporte-les d’abord.',
  exporter: 'Exporter mes données d’abord',
  supprimerDefinitivement: 'Supprimer définitivement',
  annuler: 'Annuler',
} as const;

export function confirmationSuppression(nom: string): string {
  return `Tape « ${nom} » pour confirmer`;
}

export function bienSupprime(nom: string): string {
  return `${nom} a été supprimé.`;
}
