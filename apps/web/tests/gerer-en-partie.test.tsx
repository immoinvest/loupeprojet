import { resumeDuMois, type LigneLoyer } from '@loupe/gestion';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EnPartie } from '@/ecrans/gerer/EnPartie';
import { ERREURS_EN_PARTIE, TEXTES_LOYERS as T } from '@/textes/gerer-loyers';

import { ETAT_SEPTEMBRE } from './gestion-exemples';

const AUJOURDHUI = '2026-09-14';

/** Le loyer d'Antoine en septembre : 430 € dus le 3, rien de reçu. */
function antoine(): LigneLoyer {
  const ligne = resumeDuMois(ETAT_SEPTEMBRE, '2026-09', AUJOURDHUI).lignes.find(
    (l) => l.location.id === 'location-antoine',
  );
  if (ligne === undefined) throw new Error('loyer d’Antoine absent');
  return ligne;
}

function monter(options: { occupe?: boolean } = {}): {
  onEnregistrer: ReturnType<typeof vi.fn>;
  onFermer: ReturnType<typeof vi.fn>;
} {
  const onEnregistrer = vi.fn(() => Promise.resolve());
  const onFermer = vi.fn();
  render(
    <EnPartie
      ligne={antoine()}
      aujourdhui={AUJOURDHUI}
      occupe={options.occupe ?? false}
      onEnregistrer={onEnregistrer}
      onFermer={onFermer}
    />,
  );
  return { onEnregistrer, onFermer };
}

describe('« En partie »', () => {
  it('saisie juste : le paiement part au clic « Enregistrer », date du jour par défaut', async () => {
    const utilisateur = userEvent.setup();
    const { onEnregistrer } = monter();
    const montant = screen.getByLabelText(T.montantRecu);
    expect(screen.getByLabelText(T.dateDuPaiement)).toHaveValue(AUJOURDHUI);
    expect(montant).toHaveAccessibleDescription(/restent/);

    await utilisateur.type(montant, '300');
    await utilisateur.click(screen.getByRole('button', { name: T.enregistrer }));
    expect(onEnregistrer).toHaveBeenCalledWith({
      locationId: 'location-antoine',
      periode: '2026-09',
      montant: 30_000,
      date: AUJOURDHUI,
    });
  });

  it('plus que le reste dû : message sur le montant, focus dessus, rien n’est envoyé', async () => {
    const utilisateur = userEvent.setup();
    const { onEnregistrer } = monter();
    const montant = screen.getByLabelText(T.montantRecu);
    await utilisateur.type(montant, '500');
    await utilisateur.click(screen.getByRole('button', { name: T.enregistrer }));
    expect(montant).toHaveFocus();
    expect(montant).toHaveAccessibleDescription(ERREURS_EN_PARTIE.montant);
    expect(onEnregistrer).not.toHaveBeenCalled();
  });

  it('date dans le futur : message sur la date ; corrigée, le paiement part', async () => {
    const utilisateur = userEvent.setup();
    const { onEnregistrer } = monter();
    const date = screen.getByLabelText(T.dateDuPaiement);
    await utilisateur.type(screen.getByLabelText(T.montantRecu), '430');
    fireEvent.change(date, { target: { value: '2026-09-20' } });
    await utilisateur.click(screen.getByRole('button', { name: T.enregistrer }));
    expect(date).toHaveFocus();
    expect(date).toHaveAccessibleDescription(ERREURS_EN_PARTIE.date);
    expect(onEnregistrer).not.toHaveBeenCalled();

    fireEvent.change(date, { target: { value: '2026-09-03' } });
    await utilisateur.click(screen.getByRole('button', { name: T.enregistrer }));
    expect(onEnregistrer).toHaveBeenCalledWith(
      expect.objectContaining({ montant: 43_000, date: '2026-09-03' }),
    );
  });

  it('« Fermer » referme le formulaire', async () => {
    const utilisateur = userEvent.setup();
    const { onFermer } = monter();
    await utilisateur.click(screen.getByRole('button', { name: T.fermer }));
    expect(onFermer).toHaveBeenCalledTimes(1);
  });

  it('pendant un envoi, « Fermer » et « Enregistrer » sont inactifs', () => {
    monter({ occupe: true });
    expect(screen.getByRole('button', { name: T.fermer })).toBeDisabled();
    expect(screen.getByRole('button', { name: T.enregistrer })).toBeDisabled();
  });
});
