import type { EtatGestion } from '@loupe/gestion';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import { clientMemoire } from '@/compte/memoire';
import type { Utilisateur } from '@/compte/types';
import { clientGestionMemoire } from '@/gestion/memoire';
import type { ClientGestion } from '@/gestion/types';
import { TEXTES_A_FAIRE as T } from '@/textes/gerer-a-faire';
import { TEXTES_LOCATAIRES } from '@/textes/gerer-locataires';
import { TEXTES_LOUER } from '@/textes/gerer-louer';

import {
  BIEN_LICES,
  ETAT_SEPTEMBRE,
  JULIE,
  LOCATION_ANTOINE,
  LOCATION_JULIE,
} from './gestion-exemples';

const CAMILLE: Utilisateur = {
  id: 'u1',
  nom: 'Camille Roux',
  email: 'camille@example.org',
  image: null,
};

/** Antoine en retard et sans e-mail, un parking vacant. */
const AVEC_PARKING: EtatGestion = {
  ...ETAT_SEPTEMBRE,
  biens: [...ETAT_SEPTEMBRE.biens, { ...BIEN_LICES, id: 'parking', nom: 'Parking Prado' }],
};

function monter(gestion: ClientGestion, chemin = '/gerer'): void {
  render(
    <AppEnMemoire
      chemin={chemin}
      compte={clientMemoire({ utilisateur: CAMILLE })}
      gestion={gestion}
    />,
  );
}

async function lignes(): Promise<HTMLElement[]> {
  const liste = await screen.findByRole('list', { name: T.titre }, { timeout: 10_000 });
  return within(liste).getAllByRole('listitem');
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 14, 10, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('À faire', () => {
  it('retard, bien vacant, e-mail manquant, dans cet ordre ; « Louer » en un clic', async () => {
    const utilisateur = userEvent.setup();
    let clics = 0;
    monter(clientGestionMemoire({ etat: AVEC_PARKING }));

    const [retard, vacant, email] = await lignes();
    expect(retard).toHaveTextContent(/Loyer d’Antoine en retard.*Studio Baille/);
    expect(within(retard!).getByRole('link')).toHaveAttribute(
      'href',
      '/gerer/locataires/locataire-antoine',
    );
    expect(within(vacant!).getByRole('link', { name: 'Louer Parking Prado' })).toHaveAttribute(
      'href',
      '/gerer/locataires/nouveau?bien=parking&retour=%2Fgerer',
    );
    expect(
      within(email!).getByRole('link', { name: 'Ajouter l’e-mail d’Antoine Dupont' }),
    ).toHaveAttribute('href', '/gerer/locataires/locataire-antoine?modifier=1');
    // La phrase « Sans locataire : … » a laissé la place au bloc.
    expect(screen.queryByText(/^Sans locataire/)).toBeNull();

    clics += 1;
    await utilisateur.click(within(vacant!).getByRole('link'));
    const formulaire = await screen.findByRole(
      'form',
      { name: TEXTES_LOUER.formulaire },
      { timeout: 10_000 },
    );
    expect(
      within(formulaire).getByRole('button', { name: `${TEXTES_LOUER.bien} Parking Prado` }),
    ).toBeInTheDocument();
    expect(within(formulaire).getByRole('link', { name: TEXTES_LOUER.annuler })).toHaveAttribute(
      'href',
      '/gerer',
    );
    expect(clics).toBe(1);
  });

  it('« Ajouter l’e-mail » : la fiche du locataire, formulaire ouvert, curseur sur l’e-mail', async () => {
    const utilisateur = userEvent.setup();
    monter(clientGestionMemoire({ etat: AVEC_PARKING }));
    const [, , email] = await lignes();
    await utilisateur.click(within(email!).getByRole('link'));

    const formulaire = await screen.findByRole(
      'form',
      { name: TEXTES_LOCATAIRES.formulaire },
      { timeout: 10_000 },
    );
    expect(within(formulaire).getByLabelText(TEXTES_LOCATAIRES.email)).toHaveFocus();
    expect(screen.getByRole('heading', { level: 1, name: 'Antoine Dupont' })).toBeInTheDocument();
  });

  it('au-delà de trois : « Voir les 2 autres » montre la suite', async () => {
    const utilisateur = userEvent.setup();
    const cinq: EtatGestion = {
      ...AVEC_PARKING,
      biens: [
        ...AVEC_PARKING.biens,
        { ...BIEN_LICES, id: 'p10', nom: 'Parking 10' },
        { ...BIEN_LICES, id: 'p2', nom: 'Parking 2' },
      ],
    };
    monter(clientGestionMemoire({ etat: cinq }));

    const visibles = await lignes();
    expect(visibles.map((l) => l.textContent)).toEqual([
      expect.stringMatching(/^Loyer d’Antoine en retard/),
      'Louer Parking 2',
      'Louer Parking 10',
    ]);
    await utilisateur.click(screen.getByRole('button', { name: 'Voir les 2 autres' }));
    expect((await lignes()).map((l) => l.textContent)).toEqual([
      expect.stringMatching(/^Loyer d’Antoine en retard/),
      'Louer Parking 2',
      'Louer Parking 10',
      'Louer Parking Prado',
      'Ajouter l’e-mail d’Antoine Dupont',
    ]);
    expect(screen.queryByRole('button', { name: /^Voir les/ })).toBeNull();
  });

  it('tout va bien : pas de bloc', async () => {
    const calme: EtatGestion = {
      ...ETAT_SEPTEMBRE,
      biens: [BIEN_LICES],
      locataires: [JULIE],
      locations: [LOCATION_JULIE],
    };
    monter(clientGestionMemoire({ etat: calme }));
    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: 'Le loyer est reçu.' },
        { timeout: 10_000 },
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: T.titre })).toBeNull();
  });

  it('un loyer en retard sans locataire retrouvé : la ligne mène au bien', async () => {
    const orphelin: EtatGestion = {
      ...ETAT_SEPTEMBRE,
      locations: [LOCATION_JULIE, { ...LOCATION_ANTOINE, locataireId: 'inconnu' }],
    };
    monter(clientGestionMemoire({ etat: orphelin }));
    const [retard] = await lignes();
    expect(retard).toHaveTextContent(/Loyer de ton locataire en retard/);
    expect(within(retard!).getByRole('link')).toHaveAttribute('href', '/gerer/biens/bien-baille');
  });
});
