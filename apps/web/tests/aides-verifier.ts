import { screen, within } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';

type Utilisateur = ReturnType<typeof userEvent.setup>;

/** Les résumés repliables du formulaire Vérifier. */
export const LUS = /^Lu dans l'annonce/;
export const ESTIMES = /^Estimé pour vous/;
export const PRECISER = /^Préciser pour une analyse plus juste/;

/** Déplie un résumé s'il est replié. */
export async function ouvrirGroupe(u: Utilisateur, nom: RegExp): Promise<void> {
  const bouton = screen.getByRole('button', { name: nom });
  if (bouton.getAttribute('aria-expanded') !== 'true') await u.click(bouton);
}

/** Le bouton radio `nom` du groupe (tuiles, échelle) nommé `groupe`. */
export function radioDans(groupe: string | RegExp, nom: string | RegExp): HTMLElement {
  return within(screen.getByRole('radiogroup', { name: groupe })).getByRole('radio', { name: nom });
}

/** Le champ unique « Commune » : « 69003 Lyon » suffit sans Worker. */
export async function saisirCommune(u: Utilisateur, texte: string): Promise<void> {
  await u.type(screen.getByRole('combobox', { name: 'Commune' }), texte);
}

/** Ouvre « Estimé pour vous » et remplace l'apport par un montant. */
export async function saisirApport(u: Utilisateur, montant: string): Promise<void> {
  await ouvrirGroupe(u, ESTIMES);
  const champ = screen.getByLabelText(/^Apport/);
  await u.clear(champ);
  await u.type(champ, montant);
}
