import { dateEnLettres } from '@/gestion/format';
import type { ChampLocataire } from '@/gestion/saisie';

import { ERREURS_SAISIE } from './gerer-saisie';

/** Textes de la page « Mes locataires » (tutoiement). */
export const TEXTES_LOCATAIRES = {
  titre: 'Mes locataires',
  enCeMoment: 'En ce moment',
  anciens: 'Anciens locataires',
  emailManquant: 'E-mail manquant',
  aucun: 'Aucun locataire pour le moment : ils apparaissent ici dès que tu loues un bien.',
  modifier: 'Modifier',
  formulaire: 'Modifier le locataire',
  nom: 'Prénom et nom',
  email: 'E-mail',
  enregistrer: 'Enregistrer',
  fermer: 'Fermer',
} as const;

export const ERREURS_LOCATAIRE: Readonly<Record<ChampLocataire, string>> = {
  locataire: ERREURS_SAISIE.locataire,
  email: ERREURS_SAISIE.email,
};

/** « 1 locataire », « 3 locataires » : le titre de la page. */
export function nombreDeLocataires(nombre: number): string {
  return `${String(nombre)} locataire${nombre > 1 ? 's' : ''}`;
}

/** « Depuis le 1er octobre 2025 », « Entrée le 1er octobre 2026 », « Du 1er octobre 2025 au 31 août 2026 ». */
export function periodeDuLocataire(
  entree: string,
  sortie: string | undefined,
  aujourdhui: string,
): string {
  if (sortie !== undefined) return `Du ${dateEnLettres(entree)} au ${dateEnLettres(sortie)}`;
  return entree > aujourdhui
    ? `Entrée le ${dateEnLettres(entree)}`
    : `Depuis le ${dateEnLettres(entree)}`;
}
