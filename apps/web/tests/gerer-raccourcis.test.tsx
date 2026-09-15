import type { EtatGestion } from '@loupe/gestion';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import { clientMemoire } from '@/compte/memoire';
import type { Utilisateur } from '@/compte/types';
import { clientGestionMemoire } from '@/gestion/memoire';
import type { ClientGestion } from '@/gestion/types';
import { TEXTES_MODIFIER as M } from '@/textes/gerer-biens';

import { BAILLEUR, ETAT_SEPTEMBRE, PAIEMENT_JULIE } from './gestion-exemples';

const CAMILLE: Utilisateur = {
  id: 'u1',
  nom: 'Camille Roux',
  email: 'camille@example.org',
  image: null,
};

/** Julie a aussi payé mars 2026 ; l'identité du bailleur est connue : une quittance s'ouvre d'un clic. */
const ETAT: EtatGestion = {
  ...ETAT_SEPTEMBRE,
  bailleur: BAILLEUR,
  paiements: [
    ...ETAT_SEPTEMBRE.paiements,
    { ...PAIEMENT_JULIE, id: 'paiement-mars', periode: '2026-03', date: '2026-03-05' },
  ],
};

function monter(gestion: ClientGestion, chemin: string): () => void {
  const { unmount } = render(
    <AppEnMemoire
      chemin={chemin}
      compte={clientMemoire({ utilisateur: CAMILLE })}
      gestion={gestion}
    />,
  );
  return unmount;
}

/** La ligne du loyer d'un bien sur une page de loyers. */
function ligne(nomDuBien: string): HTMLElement {
  const element = screen.getByText(nomDuBien, { selector: 'li span' }).closest('li');
  if (element === null) throw new Error(`ligne ${nomDuBien} absente`);
  return element;
}

async function quittanceOuverte(): Promise<void> {
  expect(
    await screen.findByRole(
      'heading',
      { level: 1, name: 'Quittance de loyer' },
      { timeout: 10_000 },
    ),
  ).toBeInTheDocument();
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 14, 10, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Retour des documents', () => {
  it('depuis les loyers de mars 2026 : « ← Loyers de mars 2026 » y ramène', async () => {
    const utilisateur = userEvent.setup();
    monter(clientGestionMemoire({ etat: ETAT }), '/gerer/loyers?mois=2026-03');
    await screen.findByRole('heading', { level: 1, name: 'Mars 2026' }, { timeout: 10_000 });
    await utilisateur.click(within(ligne('T2 Lices')).getByRole('button', { name: 'Quittance' }));

    await quittanceOuverte();
    const retour = screen.getByRole('link', { name: /Loyers de mars 2026/ });
    expect(retour).toHaveAttribute('href', '/gerer/loyers?mois=2026-03');
    await utilisateur.click(retour);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Mars 2026' }, { timeout: 10_000 }),
    ).toBeInTheDocument();
  });

  it('depuis la fiche d’un bien, d’un locataire, ou les loyers du mois : chacun son retour', async () => {
    const utilisateur = userEvent.setup();
    const gestion = clientGestionMemoire({ etat: ETAT });

    let demonter = monter(gestion, '/gerer/biens/bien-lices');
    const frise = await screen.findByRole(
      'list',
      { name: 'Les 12 derniers mois' },
      { timeout: 10_000 },
    );
    const septembre = within(frise).getAllByRole('listitem').at(-1);
    await utilisateur.click(within(septembre!).getByRole('button', { name: 'Quittance' }));
    await quittanceOuverte();
    expect(screen.getByRole('link', { name: /T2 Lices/ })).toHaveAttribute(
      'href',
      '/gerer/biens/bien-lices',
    );
    demonter();

    demonter = monter(gestion, '/gerer/locataires/locataire-julie');
    const loyers = await screen.findByRole(
      'list',
      { name: 'Ses 12 derniers loyers' },
      { timeout: 10_000 },
    );
    const dernier = within(loyers).getAllByRole('listitem').at(-1);
    await utilisateur.click(within(dernier!).getByRole('button', { name: 'Quittance' }));
    await quittanceOuverte();
    expect(screen.getByRole('link', { name: /Julie Martin/ })).toHaveAttribute(
      'href',
      '/gerer/locataires/locataire-julie',
    );
    demonter();

    monter(gestion, '/gerer');
    await screen.findByText('T2 Lices', { selector: 'li span' }, { timeout: 10_000 });
    await utilisateur.click(within(ligne('T2 Lices')).getByRole('button', { name: 'Quittance' }));
    await quittanceOuverte();
    expect(screen.getByRole('link', { name: /Loyers du mois/ })).toHaveAttribute('href', '/gerer');
  });
});

describe('Raccourcis vers les loyers et « Modifier »', () => {
  it('deux clics depuis la fiche : le mois de la frise, puis « Quittance » ; la ligne du bien est mise en évidence', async () => {
    const utilisateur = userEvent.setup();
    let clics = 0;
    const cliquer = async (element: HTMLElement): Promise<void> => {
      clics += 1;
      await utilisateur.click(element);
    };
    monter(clientGestionMemoire({ etat: ETAT }), '/gerer/biens/bien-lices');
    const frise = await screen.findByRole(
      'list',
      { name: 'Les 12 derniers mois' },
      { timeout: 10_000 },
    );
    const mars = within(frise).getByRole('link', { name: 'mars 2026' });
    expect(mars).toHaveAttribute('href', '/gerer/loyers?mois=2026-03&bien=bien-lices');
    await cliquer(mars);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Mars 2026' }, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(ligne('T2 Lices')).toHaveAttribute('aria-current', 'true');
    expect(ligne('Studio Baille')).not.toHaveAttribute('aria-current');
    await cliquer(within(ligne('T2 Lices')).getByRole('button', { name: 'Quittance' }));
    await quittanceOuverte();
    expect(clics).toBe(2);
  });

  it('deux clics depuis la liste des loyers : le montant ouvre « Modifier la location », puis « Enregistrer »', async () => {
    const utilisateur = userEvent.setup();
    let clics = 0;
    const cliquer = async (element: HTMLElement): Promise<void> => {
      clics += 1;
      await utilisateur.click(element);
    };
    const gestion = clientGestionMemoire({ etat: ETAT_SEPTEMBRE });
    monter(gestion, '/gerer/loyers');
    const montant = await screen.findByRole(
      'link',
      { name: /^700\s€ — modifier la location de T2 Lices$/ },
      { timeout: 10_000 },
    );
    expect(montant).toHaveAttribute('href', '/gerer/biens/bien-lices?modifier=location-julie');
    await cliquer(montant);

    const formulaire = await screen.findByRole('form', { name: M.titre }, { timeout: 10_000 });
    expect(screen.getByRole('heading', { level: 1, name: 'T2 Lices' })).toBeInTheDocument();
    const loyer = within(formulaire).getByLabelText(M.loyer);
    await utilisateur.clear(loyer);
    await utilisateur.type(loyer, '680');
    await cliquer(within(formulaire).getByRole('button', { name: M.enregistrer }));

    await waitFor(() => {
      expect(screen.queryByRole('form', { name: M.titre })).toBeNull();
    });
    expect(clics).toBe(2);
    expect(gestion.donnees().locations[0]?.changements).toEqual([
      { aPartirDe: '2026-10', loyerHorsCharges: 68_000, charges: 5_000, apl: 0 },
    ]);
  });

  it('« modifier » d’une location inconnue : rien ne s’ouvre', async () => {
    monter(
      clientGestionMemoire({ etat: ETAT_SEPTEMBRE }),
      '/gerer/biens/bien-lices?modifier=autre',
    );
    expect(
      await screen.findByRole('button', { name: M.modifier }, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: M.titre })).toBeNull();
  });
});
