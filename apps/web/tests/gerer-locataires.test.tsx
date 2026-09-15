import type { EtatGestion } from '@loupe/gestion';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import { clientMemoire } from '@/compte/memoire';
import type { Utilisateur } from '@/compte/types';
import { clientGestionMemoire } from '@/gestion/memoire';
import type { ClientGestion } from '@/gestion/types';
import { ERREURS_GESTION, TEXTES_MENU } from '@/textes/gerer';
import { ERREURS_LOCATAIRE, TEXTES_LOCATAIRES as T } from '@/textes/gerer-locataires';

import { ETAT_SEPTEMBRE, LOCATION_ANTOINE, LOCATION_JULIE } from './gestion-exemples';

const CAMILLE: Utilisateur = {
  id: 'u1',
  nom: 'Camille Roux',
  email: 'camille@example.org',
  image: null,
};

/** Julie loue toujours ; Antoine est parti fin août. */
const ETAT: EtatGestion = {
  ...ETAT_SEPTEMBRE,
  locations: [LOCATION_JULIE, { ...LOCATION_ANTOINE, fin: '2026-08-31' }],
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

async function premiereLigne(groupe: string): Promise<HTMLElement> {
  const liste = await screen.findByRole('list', { name: groupe }, { timeout: 10_000 });
  const [ligne] = within(liste).getAllByRole('listitem');
  if (ligne === undefined) throw new Error(`groupe vide : ${groupe}`);
  return ligne;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 14, 10, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Mes locataires', () => {
  it('un clic depuis le menu : en ce moment, puis anciens ; e-mail manquant signalé ; le bien ouvre sa fiche', async () => {
    const utilisateur = userEvent.setup();
    monter(clientGestionMemoire({ etat: ETAT }), '/gerer');
    const gerer = await screen.findByRole('navigation', { name: 'Gérer' }, { timeout: 10_000 });
    await utilisateur.click(
      await within(gerer).findByRole(
        'link',
        { name: TEXTES_MENU.mesLocataires },
        { timeout: 10_000 },
      ),
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: '2 locataires' }, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(await premiereLigne(T.enCeMoment)).toHaveTextContent(
      /Julie Martin.*julie\.martin@exemple\.fr.*T2 Lices.*Depuis le 1er octobre 2025/,
    );
    const antoine = await premiereLigne(T.anciens);
    expect(antoine).toHaveTextContent(
      /Antoine Dupont.*E-mail manquant.*Studio Baille.*Du 1er octobre 2025 au 31 août 2026/,
    );
    expect(within(antoine).getByRole('link', { name: 'Studio Baille' })).toHaveAttribute(
      'href',
      '/gerer/biens/bien-baille',
    );
  });

  it('« Modifier » puis « Enregistrer » (deux clics) : l’e-mail d’Antoine ; un e-mail invalide est signalé', async () => {
    const utilisateur = userEvent.setup();
    const gestion = clientGestionMemoire({ etat: ETAT });
    monter(gestion, '/gerer/locataires');
    await utilisateur.click(
      within(await premiereLigne(T.anciens)).getByRole('button', { name: T.modifier }),
    );
    const formulaire = screen.getByRole('form', { name: T.formulaire });
    const email = within(formulaire).getByLabelText(T.email);
    await utilisateur.type(email, 'pas-un-email');
    await utilisateur.click(within(formulaire).getByRole('button', { name: T.enregistrer }));
    expect(email).toHaveFocus();
    expect(email).toHaveAccessibleDescription(ERREURS_LOCATAIRE.email);
    expect(gestion.appels).not.toContain('modifierLocataire');

    await utilisateur.clear(email);
    await utilisateur.type(email, 'antoine@exemple.fr');
    await utilisateur.click(within(formulaire).getByRole('button', { name: T.enregistrer }));
    expect(
      await within(await premiereLigne(T.anciens)).findByText('antoine@exemple.fr'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: T.formulaire })).toBeNull();
    expect(gestion.donnees().locataires.find((l) => l.id === 'locataire-antoine')?.email).toBe(
      'antoine@exemple.fr',
    );
  });

  it('refus du serveur affiché dans le formulaire ; « Fermer »', async () => {
    const utilisateur = userEvent.setup();
    monter(
      clientGestionMemoire({ etat: ETAT, erreurs: { modifierLocataire: 'reseau' } }),
      '/gerer/locataires',
    );
    await utilisateur.click(
      within(await premiereLigne(T.enCeMoment)).getByRole('button', { name: T.modifier }),
    );
    const formulaire = screen.getByRole('form', { name: T.formulaire });
    await utilisateur.click(within(formulaire).getByRole('button', { name: T.enregistrer }));
    expect(await within(formulaire).findByRole('alert')).toHaveTextContent(ERREURS_GESTION.reseau);
    await utilisateur.click(within(formulaire).getByRole('button', { name: T.fermer }));
    expect(screen.queryByRole('form', { name: T.formulaire })).toBeNull();
  });

  it('sans bien : les portes de Gérer', async () => {
    monter(clientGestionMemoire(), '/gerer/locataires');
    expect(
      await screen.findByRole('link', { name: 'Ajouter à la main' }, { timeout: 10_000 }),
    ).toBeInTheDocument();
  });
});
