import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import { clientMemoire } from '@/compte/memoire';
import type { Utilisateur } from '@/compte/types';
import { clientGestionMemoire } from '@/gestion/memoire';
import type { ClientGestion } from '@/gestion/types';
import { TEXTES_GERER } from '@/textes/gerer-ecrans';

import { ETAT_SEPTEMBRE } from './gestion-exemples';

const CAMILLE: Utilisateur = {
  id: 'u1',
  nom: 'Camille Roux',
  email: 'camille@example.org',
  image: null,
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

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 14, 10, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Mes biens', () => {
  it('un clic depuis le menu : « 2 biens », une ligne par bien, son état et le loyer du mois', async () => {
    const utilisateur = userEvent.setup();
    monter(clientGestionMemoire({ etat: ETAT_SEPTEMBRE }), '/gerer');
    const gerer = await screen.findByRole('navigation', { name: 'Gérer' }, { timeout: 10_000 });
    await utilisateur.click(
      await within(gerer).findByRole('link', { name: 'Mes biens · 2' }, { timeout: 10_000 }),
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: '2 biens' }, { timeout: 10_000 }),
    ).toBeInTheDocument();
    const lignes = within(screen.getByRole('list', { name: 'Mes biens' })).getAllByRole('listitem');
    expect(lignes).toHaveLength(2);
    expect(lignes[0]).toHaveTextContent(/Studio Baille.*Antoine Dupont.*par mois.*Loué.*En retard/);
    expect(lignes[1]).toHaveTextContent(/T2 Lices.*Julie Martin.*par mois.*Loué.*Reçu/);
  });

  it('le nom d’un bien ouvre sa fiche ; « Ajouter un bien » est en haut de la page', async () => {
    const utilisateur = userEvent.setup();
    monter(clientGestionMemoire({ etat: ETAT_SEPTEMBRE }), '/gerer/biens');
    const lien = await screen.findByRole('link', { name: 'T2 Lices' }, { timeout: 10_000 });
    expect(lien).toHaveAttribute('href', '/gerer/biens/bien-lices');
    expect(
      within(screen.getByRole('main')).getByRole('link', { name: 'Ajouter un bien' }),
    ).toHaveAttribute('href', '/gerer/ajouter');

    await utilisateur.click(lien);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'T2 Lices' }, { timeout: 10_000 }),
    ).toBeInTheDocument();
  });

  it('sans bien : les portes de Gérer', async () => {
    monter(clientGestionMemoire(), '/gerer/biens');
    expect(
      await screen.findByRole('link', { name: TEXTES_GERER.porteMainTitre }, { timeout: 10_000 }),
    ).toBeInTheDocument();
  });
});
