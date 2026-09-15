import type { EtatGestion, Locataire } from '@loupe/gestion';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import { clientMemoire } from '@/compte/memoire';
import type { Utilisateur } from '@/compte/types';
import { clientGestionMemoire } from '@/gestion/memoire';
import type { ClientGestion } from '@/gestion/types';
import { TEXTES_FICHE_LOCATAIRE as T } from '@/textes/gerer-locataire';
import { TEXTES_LOCATAIRES } from '@/textes/gerer-locataires';

import { ETAT_SEPTEMBRE, HORODATAGE, LOCATION_ANTOINE, LOCATION_JULIE } from './gestion-exemples';

const CAMILLE: Utilisateur = {
  id: 'u1',
  nom: 'Camille Roux',
  email: 'camille@example.org',
  image: null,
};

const LEA: Locataire = { id: 'locataire-lea', prenom: 'Léa', nom: 'Bernard', creeLe: HORODATAGE };

/** Léa en colocation avec Julie sur T2 Lices (APL), et une ancienne location de Studio Baille. */
const COLOCATION: EtatGestion = {
  ...ETAT_SEPTEMBRE,
  locataires: [...ETAT_SEPTEMBRE.locataires, LEA],
  locations: [
    { ...LOCATION_JULIE, colocataireIds: [LEA.id], apl: 18_000 },
    LOCATION_ANTOINE,
    {
      ...LOCATION_ANTOINE,
      id: 'location-lea-baille',
      locataireId: LEA.id,
      debut: '2025-10-01',
      fin: '2026-03-31',
    },
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

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 14, 10, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Fiche d’un locataire', () => {
  it('un clic depuis les loyers du mois : fil d’Ariane, e-mail manquant, sa location, ses loyers', async () => {
    const utilisateur = userEvent.setup();
    let clics = 0;
    monter(clientGestionMemoire({ etat: ETAT_SEPTEMBRE }), '/gerer');
    clics += 1;
    await utilisateur.click(
      await screen.findByRole('link', { name: 'Antoine Dupont' }, { timeout: 10_000 }),
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Antoine Dupont' }, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(clics).toBe(1);
    const fil = screen.getByRole('navigation', { name: 'Fil d’Ariane' });
    expect(within(fil).getByRole('link', { name: 'Gérer' })).toHaveAttribute('href', '/gerer');
    expect(within(fil).getByRole('link', { name: 'Mes locataires' })).toHaveAttribute(
      'href',
      '/gerer/locataires',
    );
    expect(within(fil).getByText('Antoine Dupont')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText(T.emailManquant)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: T.ajouterEmail })).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Studio Baille' })).toHaveAttribute(
      'href',
      '/gerer/biens/bien-baille',
    );
    expect(screen.getByText('En cours')).toBeInTheDocument();
    expect(screen.getByText('Depuis le 1er octobre 2025')).toBeInTheDocument();
    const loyers = within(screen.getByRole('list', { name: T.sesLoyers })).getAllByRole('listitem');
    expect(loyers).toHaveLength(12);
    expect(loyers[11]).toHaveTextContent(/sept\. 2026.*En retard/);
    // « Mes locataires » reste la page active du menu.
    const menu = screen.getByRole('navigation', { name: 'Gérer' });
    expect(within(menu).getByRole('link', { name: 'Mes locataires' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('« Ajouter l’e-mail » puis « Enregistrer » (deux clics) : l’e-mail s’affiche', async () => {
    const utilisateur = userEvent.setup();
    let clics = 0;
    const cliquer = async (element: HTMLElement): Promise<void> => {
      clics += 1;
      await utilisateur.click(element);
    };
    const gestion = clientGestionMemoire({ etat: ETAT_SEPTEMBRE });
    monter(gestion, '/gerer/locataires/locataire-antoine');

    await cliquer(await screen.findByRole('button', { name: T.ajouterEmail }, { timeout: 10_000 }));
    const formulaire = screen.getByRole('form', { name: TEXTES_LOCATAIRES.formulaire });
    const email = within(formulaire).getByLabelText(TEXTES_LOCATAIRES.email);
    expect(email).toHaveFocus();
    await utilisateur.type(email, 'antoine@exemple.fr');
    await cliquer(within(formulaire).getByRole('button', { name: TEXTES_LOCATAIRES.enregistrer }));

    expect(await screen.findByText('antoine@exemple.fr')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: TEXTES_LOCATAIRES.formulaire })).toBeNull();
    expect(screen.queryByText(T.emailManquant)).toBeNull();
    expect(screen.getByRole('button', { name: T.modifier })).toBeInTheDocument();
    expect(clics).toBe(2);
    expect(gestion.donnees().locataires.find((l) => l.id === 'locataire-antoine')?.email).toBe(
      'antoine@exemple.fr',
    );
  });

  it('?modifier=1 : formulaire déjà ouvert, curseur sur l’e-mail ; « Fermer »', async () => {
    const utilisateur = userEvent.setup();
    monter(
      clientGestionMemoire({ etat: ETAT_SEPTEMBRE }),
      '/gerer/locataires/locataire-julie?modifier=1',
    );
    const formulaire = await screen.findByRole(
      'form',
      { name: TEXTES_LOCATAIRES.formulaire },
      { timeout: 10_000 },
    );
    expect(within(formulaire).getByLabelText(TEXTES_LOCATAIRES.email)).toHaveFocus();
    expect(screen.queryByRole('button', { name: T.modifier })).toBeNull();

    await utilisateur.click(
      within(formulaire).getByRole('button', { name: TEXTES_LOCATAIRES.fermer }),
    );
    expect(screen.queryByRole('form', { name: TEXTES_LOCATAIRES.formulaire })).toBeNull();
    expect(screen.getByText('julie.martin@exemple.fr')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: T.modifier })).toBeInTheDocument();
  });

  it('colocation avec APL, puis location terminée ; quittance du mois reçu', async () => {
    monter(clientGestionMemoire({ etat: COLOCATION }), '/gerer/locataires/locataire-lea');
    const cartes = await screen.findAllByRole('heading', { level: 2 }, { timeout: 10_000 });
    expect(cartes.map((c) => c.textContent)).toEqual(['T2 Lices', 'Studio Baille', T.sesLoyers]);

    expect(screen.getByText('En cours')).toBeInTheDocument();
    // Julie, titulaire du bail, mène à sa fiche.
    expect(screen.getByRole('link', { name: 'Julie Martin' })).toHaveAttribute(
      'href',
      '/gerer/locataires/locataire-julie',
    );
    expect(screen.getByText(T.apl).parentElement).toHaveTextContent(/180\s€/);
    expect(screen.getByText('Terminée')).toBeInTheDocument();
    expect(screen.getByText('Du 1er octobre 2025 au 31 mars 2026')).toBeInTheDocument();

    const loyers = within(screen.getByRole('list', { name: T.sesLoyers })).getAllByRole('listitem');
    expect(loyers).toHaveLength(12);
    expect(within(loyers[11]!).getByRole('button', { name: 'Quittance' })).toBeInTheDocument();
  });

  it('sans location ni loyer : les deux phrases', async () => {
    const seule: EtatGestion = {
      ...ETAT_SEPTEMBRE,
      locataires: [...ETAT_SEPTEMBRE.locataires, LEA],
    };
    monter(clientGestionMemoire({ etat: seule }), '/gerer/locataires/locataire-lea');
    expect(await screen.findByText(T.aucuneLocation, {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.getByText(T.aucunLoyer)).toBeInTheDocument();
  });

  it('introuvable : le dit, avec le lien vers Mes locataires', async () => {
    monter(clientGestionMemoire({ etat: ETAT_SEPTEMBRE }), '/gerer/locataires/inconnu');
    expect(
      await screen.findByRole('heading', { level: 1, name: T.introuvable }, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: T.voirLocataires })).toHaveAttribute(
      'href',
      '/gerer/locataires',
    );
  });
});

describe('Noms en liens et fil d’Ariane', () => {
  it('Mes biens, Mes locataires, fiche d’un bien : chaque nom mène à la fiche du locataire', async () => {
    const gestion = clientGestionMemoire({ etat: COLOCATION });
    let demonter = monter(gestion, '/gerer/biens');
    const lea = await screen.findByRole('link', { name: 'Léa Bernard' }, { timeout: 10_000 });
    expect(lea).toHaveAttribute('href', '/gerer/locataires/locataire-lea');
    expect(lea.parentElement).toHaveTextContent('Julie Martin et Léa Bernard');
    demonter();

    demonter = monter(gestion, '/gerer/locataires');
    expect(
      await screen.findByRole('link', { name: 'Antoine Dupont' }, { timeout: 10_000 }),
    ).toHaveAttribute('href', '/gerer/locataires/locataire-antoine');
    demonter();

    monter(gestion, '/gerer/biens/bien-lices');
    const fil = await screen.findByRole(
      'navigation',
      { name: 'Fil d’Ariane' },
      { timeout: 10_000 },
    );
    expect(within(fil).getByRole('link', { name: 'Mes biens' })).toHaveAttribute(
      'href',
      '/gerer/biens',
    );
    expect(within(fil).getByText('T2 Lices')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Julie Martin' })).toHaveAttribute(
      'href',
      '/gerer/locataires/locataire-julie',
    );
  });
});
