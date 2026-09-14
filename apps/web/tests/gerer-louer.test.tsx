import type { EtatGestion } from '@loupe/gestion';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import { clientMemoire } from '@/compte/memoire';
import type { Utilisateur } from '@/compte/types';
import { clientGestionMemoire } from '@/gestion/memoire';
import type { ClientGestion } from '@/gestion/types';
import { ERREURS_GESTION } from '@/textes/gerer';
import { ERREURS_LOUER, TEXTES_LOUER as T } from '@/textes/gerer-louer';
import { TEXTES_AJOUTER as A } from '@/textes/gerer-saisie';

import { BIEN_LICES, ETAT_SEPTEMBRE } from './gestion-exemples';

const CAMILLE: Utilisateur = {
  id: 'u1',
  nom: 'Camille Roux',
  email: 'camille@example.org',
  image: null,
};

/** Le T2 Lices et le Studio Baille de septembre, plus un parking vacant. */
const AVEC_PARKING: EtatGestion = {
  ...ETAT_SEPTEMBRE,
  biens: [
    ...ETAT_SEPTEMBRE.biens,
    { ...BIEN_LICES, id: 'parking', nom: 'Parking Prado', type: 'parking', meuble: false },
  ],
};

function monter(gestion: ClientGestion, chemin: string): void {
  render(
    <AppEnMemoire
      chemin={chemin}
      compte={clientMemoire({ utilisateur: CAMILLE })}
      gestion={gestion}
    />,
  );
}

function formulaire(): HTMLElement {
  return screen.getByRole('form', { name: T.formulaire });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 14, 10, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Louer un bien', () => {
  it('deux clics depuis l’accueil : le bien vacant, puis « Louer » ; le bien est loué', async () => {
    const utilisateur = userEvent.setup();
    let clics = 0;
    const cliquer = async (element: HTMLElement): Promise<void> => {
      clics += 1;
      await utilisateur.click(element);
    };
    const gestion = clientGestionMemoire({ etat: AVEC_PARKING });
    monter(gestion, '/gerer');

    await cliquer(await screen.findByRole('link', { name: 'Parking Prado' }, { timeout: 10_000 }));
    await screen.findByRole('form', { name: T.formulaire }, { timeout: 10_000 });
    // Saisies au clavier : elles ne comptent pas comme des clics.
    await utilisateur.type(within(formulaire()).getByLabelText(T.locataire), 'Léa Bernard');
    await utilisateur.type(within(formulaire()).getByLabelText(A.loyer), '120');
    await cliquer(within(formulaire()).getByRole('button', { name: T.louer }));

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Location en cours' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Léa Bernard')).toBeInTheDocument();
    expect(screen.getByText('Loué')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: T.formulaire })).toBeNull();
    expect(clics).toBe(2);
    expect(gestion.donnees().locations).toContainEqual(
      expect.objectContaining({ bienId: 'parking', loyerHorsCharges: 12_000, debut: '2026-09-01' }),
    );
  });

  it('une autre chambre en colocation : loyer repris, colocataire ajouté puis retiré, chambre nommée', async () => {
    const utilisateur = userEvent.setup();
    const gestion = clientGestionMemoire({ etat: ETAT_SEPTEMBRE });
    monter(gestion, '/gerer/biens/bien-lices');
    await utilisateur.click(await screen.findByRole('button', { name: 'Ajouter une location' }));
    const form = formulaire();
    // Repris de la location de Julie.
    expect(within(form).getByLabelText(A.loyer)).toHaveValue('650');
    expect(within(form).getByLabelText(A.charges)).toHaveValue('50');

    await utilisateur.type(within(form).getByLabelText(T.locataire), 'Hugo Petit');
    await utilisateur.click(within(form).getByRole('button', { name: T.ajouterColocataire }));
    await utilisateur.click(within(form).getByRole('button', { name: T.ajouterColocataire }));
    await utilisateur.type(within(form).getByLabelText('Colocataire 1'), 'Léa Bernard');
    await utilisateur.click(within(form).getAllByRole('button', { name: T.retirer })[1]!);
    expect(within(form).queryByLabelText('Colocataire 2')).toBeNull();
    await utilisateur.type(within(form).getByLabelText(T.libelle), 'Chambre 2');
    await utilisateur.click(within(form).getByRole('button', { name: T.louer }));

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Location en cours · Chambre 2' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Hugo Petit et Léa Bernard')).toBeInTheDocument();
    expect(gestion.donnees().locations).toContainEqual(
      expect.objectContaining({
        bienId: 'bien-lices',
        libelle: 'Chambre 2',
        loyerHorsCharges: 65_000,
      }),
    );
  });

  it('champs à corriger : message, focus sur le premier, rien n’est envoyé', async () => {
    const utilisateur = userEvent.setup();
    const gestion = clientGestionMemoire({ etat: AVEC_PARKING });
    monter(gestion, '/gerer/biens/parking?louer=1');
    const form = await screen.findByRole('form', { name: T.formulaire });
    await utilisateur.type(within(form).getByLabelText(T.locataire), 'Léa');
    await utilisateur.click(within(form).getByRole('button', { name: T.ajouterColocataire }));
    await utilisateur.type(within(form).getByLabelText('Colocataire 1'), 'Hugo');
    await utilisateur.click(within(form).getByRole('button', { name: T.louer }));

    const locataire = within(form).getByLabelText(T.locataire);
    expect(locataire).toHaveFocus();
    expect(locataire).toHaveAccessibleDescription(ERREURS_LOUER.locataire);
    expect(within(form).getByLabelText('Colocataire 1')).toHaveAccessibleDescription(
      ERREURS_LOUER.colocataires,
    );
    expect(within(form).getByLabelText(A.loyer)).toHaveAccessibleDescription(ERREURS_LOUER.loyer);
    expect(gestion.appels).not.toContain('louer');
  });

  it('le même bien déjà loué en entier : refus du serveur affiché ; « Fermer » referme', async () => {
    const utilisateur = userEvent.setup();
    monter(clientGestionMemoire({ etat: ETAT_SEPTEMBRE }), '/gerer/biens/bien-lices');
    await utilisateur.click(await screen.findByRole('button', { name: 'Ajouter une location' }));
    const form = formulaire();
    await utilisateur.type(within(form).getByLabelText(T.locataire), 'Hugo Petit');
    await utilisateur.click(within(form).getByRole('button', { name: T.louer }));
    expect(await within(form).findByRole('alert')).toHaveTextContent(ERREURS_GESTION.bien_occupe);

    await utilisateur.click(within(form).getByRole('button', { name: T.fermer }));
    expect(screen.queryByRole('form', { name: T.formulaire })).toBeNull();
    expect(screen.getByRole('button', { name: 'Ajouter une location' })).toBeInTheDocument();
  });
});
