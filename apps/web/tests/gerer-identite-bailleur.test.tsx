import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { IdentiteBailleur } from '@/ecrans/gerer/IdentiteBailleur';
import { ERREURS_BAILLEUR, TEXTES_BAILLEUR as T } from '@/textes/gerer-bailleur';

const PIERRE = { nom: 'Pierre Georgel', adresse: '3 rue Paradis, 13006 Marseille' };

function monter(props: Partial<Parameters<typeof IdentiteBailleur>[0]> = {}): {
  onEnregistrer: ReturnType<typeof vi.fn>;
  onAnnuler: ReturnType<typeof vi.fn>;
} {
  const onEnregistrer = vi.fn(() => Promise.resolve());
  const onAnnuler = vi.fn();
  render(
    <IdentiteBailleur
      occupe={false}
      onEnregistrer={onEnregistrer}
      onAnnuler={onAnnuler}
      {...props}
    />,
  );
  return { onEnregistrer, onAnnuler };
}

describe('identité du bailleur', () => {
  it('nom et adresse saisis : « Enregistrer et ouvrir » les envoie, espaces retirés', async () => {
    const utilisateur = userEvent.setup();
    const { onEnregistrer } = monter();
    await utilisateur.type(screen.getByLabelText(T.nom), '  Pierre Georgel ');
    await utilisateur.type(screen.getByLabelText(T.adresse), PIERRE.adresse);
    await utilisateur.click(screen.getByRole('button', { name: T.enregistrer }));
    expect(onEnregistrer).toHaveBeenCalledWith(PIERRE);
  });

  it('champs vides : un message par champ, focus sur le nom, rien n’est envoyé', async () => {
    const utilisateur = userEvent.setup();
    const { onEnregistrer } = monter();
    await utilisateur.click(screen.getByRole('button', { name: T.enregistrer }));
    const nom = screen.getByLabelText(T.nom);
    expect(nom).toHaveFocus();
    expect(nom).toHaveAccessibleDescription(ERREURS_BAILLEUR.nom);
    expect(screen.getByLabelText(T.adresse)).toHaveAccessibleDescription(ERREURS_BAILLEUR.adresse);
    expect(onEnregistrer).not.toHaveBeenCalled();
  });

  it('seule l’adresse manque : focus sur l’adresse', async () => {
    const utilisateur = userEvent.setup();
    monter({ initiale: { nom: PIERRE.nom, adresse: '' } });
    expect(screen.getByLabelText(T.nom)).toHaveValue(PIERRE.nom);
    await utilisateur.click(screen.getByRole('button', { name: T.enregistrer }));
    expect(screen.getByLabelText(T.adresse)).toHaveFocus();
    expect(screen.getByLabelText(T.nom)).not.toHaveAccessibleDescription(ERREURS_BAILLEUR.nom);
  });

  it('une erreur de l’API s’affiche ; « Annuler » referme', async () => {
    const utilisateur = userEvent.setup();
    const { onAnnuler } = monter({ erreur: 'Impossible de joindre Deklic.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Impossible de joindre Deklic.');
    await utilisateur.click(screen.getByRole('button', { name: T.annuler }));
    expect(onAnnuler).toHaveBeenCalledTimes(1);
  });

  it('pendant l’envoi, « Annuler » et « Enregistrer et ouvrir » sont inactifs', () => {
    monter({ occupe: true, initiale: PIERRE });
    expect(screen.getByRole('button', { name: T.annuler })).toBeDisabled();
    expect(screen.getByRole('button', { name: T.enregistrer })).toBeDisabled();
  });
});
