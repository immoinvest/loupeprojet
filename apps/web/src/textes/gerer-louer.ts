import type { ChampLouer } from '@/gestion/saisie-louer';

import { ERREURS_SAISIE, TEXTES_AJOUTER } from './gerer-saisie';

/** Textes du formulaire « Louer » de la fiche d'un bien (tutoiement). */
export const TEXTES_LOUER = {
  formulaire: 'Louer le bien',
  locataire: TEXTES_AJOUTER.locataire,
  email: TEXTES_AJOUTER.email,
  ajouterColocataire: '+ Ajouter un colocataire',
  retirer: 'Retirer',
  libelle: 'Chambre',
  aideLibelle: 'Facultatif : pour une location à la chambre, par exemple « Chambre 2 ».',
  louer: 'Louer',
  fermer: 'Fermer',
} as const;

/** Le bouton qui ouvre le formulaire : le locataire d'un bien vacant, ou une location de plus. */
export function titreLouer(vacant: boolean): string {
  return vacant ? 'Ajouter le locataire' : 'Ajouter une location';
}

/** « Colocataire 1 », « Colocataire 2 »… (le locataire en titre est saisi au-dessus). */
export function colocataireNumero(rang: number): string {
  return `Colocataire ${String(rang)}`;
}

export const ERREURS_LOUER: Readonly<Record<ChampLouer, string>> = {
  locataire: ERREURS_SAISIE.locataire,
  email: ERREURS_SAISIE.email,
  colocataires: 'Indique le prénom et le nom de chaque colocataire, ou retire la ligne.',
  libelle: 'Un nom de chambre de 40 caractères au plus.',
  loyer: ERREURS_SAISIE.loyer,
  charges: ERREURS_SAISIE.charges,
  entree: ERREURS_SAISIE.entree,
  jourLoyer: ERREURS_SAISIE.jourLoyer,
  depot: ERREURS_SAISIE.depot,
  apl: ERREURS_SAISIE.apl,
};
