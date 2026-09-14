import { creerProjet, ecrireProjets } from '@/stockage/projets';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import { clientMemoire } from '@/compte/memoire';
import type { Utilisateur } from '@/compte/types';
import { clientGestionMemoire } from '@/gestion/memoire';
import type { ClientGestion } from '@/gestion/types';
import { ERREURS_GESTION, TEXTES_MON_MENU } from '@/textes/gerer';

import { ETAT_SEPTEMBRE } from './gestion-exemples';

const CAMILLE: Utilisateur = {
  id: 'u1',
  nom: 'Camille Roux',
  email: 'camille@example.org',
  image: null,
};

function barreLaterale(): HTMLElement {
  const barre = document.getElementById('navigation-principale');
  if (barre === null) throw new Error('barre latérale absente');
  return barre;
}

function section(nom: 'Analyser' | 'Gérer'): HTMLElement {
  return within(barreLaterale()).getByRole('navigation', { name: nom });
}

beforeEach(() => {
  // Seule la date est simulée : les minuteurs restent réels pour user-event.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 14, 10, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('menu à deux sections', () => {
  it('sans compte : Analyser complet, Gérer réduit à une ligne, plus de grand bouton', async () => {
    render(<AppEnMemoire chemin="/projets" compte={clientMemoire()} />);
    await screen.findByRole('heading', { level: 1, name: 'Mes projets' });
    const analyser = section('Analyser');
    expect(within(analyser).getByRole('link', { name: 'Nouveau projet' })).toHaveAttribute(
      'href',
      '/projets/nouveau',
    );
    // Comparer est dans la page Tous mes projets, plus dans le menu.
    expect(within(analyser).queryByRole('link', { name: 'Comparer' })).toBeNull();
    expect(within(analyser).getByRole('link', { name: 'Tous mes projets · 1' })).toHaveAttribute(
      'href',
      '/projets',
    );
    const gerer = section('Gérer');
    expect(within(gerer).getAllByRole('link')).toHaveLength(1);
    expect(within(gerer).getByRole('link', { name: 'Gérer mes biens loués' })).toHaveAttribute(
      'href',
      '/gerer',
    );
    expect(within(barreLaterale()).queryByRole('button', { name: 'Nouveau projet' })).toBeNull();
  });

  it('les 3 projets les plus récents puis « Tous mes projets · N »', async () => {
    const stockage = window.localStorage;
    ecrireProjets(
      stockage,
      Array.from({ length: 7 }, (_, i) => creerProjet({ nom: `Projet ${String(i + 1)}` })),
    );
    render(<AppEnMemoire chemin="/comparer" stockage={stockage} compte={clientMemoire()} />);
    const analyser = await screen.findByRole('navigation', { name: 'Analyser' });
    expect(within(analyser).queryByRole('link', { name: /Projet 3/ })).toBeInTheDocument();
    expect(within(analyser).queryByRole('link', { name: /Projet 4/ })).toBeNull();
    expect(within(analyser).getByRole('link', { name: 'Tous mes projets · 7' })).toHaveAttribute(
      'href',
      '/projets',
    );
  });

  it('connecté : Ajouter un bien, Loyers du mois et le nombre de loyers en retard', async () => {
    render(
      <AppEnMemoire
        chemin="/projets"
        compte={clientMemoire({ utilisateur: CAMILLE })}
        gestion={clientGestionMemoire({ etat: ETAT_SEPTEMBRE })}
      />,
    );
    const gerer = await screen.findByRole('navigation', { name: 'Gérer' });
    expect(within(gerer).getByRole('link', { name: 'Ajouter un bien' })).toHaveAttribute(
      'href',
      '/gerer/ajouter',
    );
    const loyers = await within(gerer).findByRole('link', { name: /Loyers du mois/ });
    expect(loyers).toHaveAttribute('href', '/gerer');
    expect(await within(loyers).findByLabelText('1 loyer en retard')).toHaveTextContent('1');
  });
});

describe('Mon menu (page Mon compte)', () => {
  function monter(gestion: ClientGestion): void {
    render(
      <AppEnMemoire
        chemin="/compte"
        compte={clientMemoire({ utilisateur: CAMILLE })}
        gestion={gestion}
      />,
    );
  }

  it('trois choix : Gérer seulement, Analyser seulement, puis les deux ; le logo reste sur l’accueil', async () => {
    const utilisateur = userEvent.setup();
    const gestion = clientGestionMemoire();
    monter(gestion);
    const lesDeux = await screen.findByRole('radio', { name: /Analyser et Gérer/ });
    const gererSeul = screen.getByRole('radio', { name: /Gérer seulement/ });
    const analyserSeul = screen.getByRole('radio', { name: /Analyser seulement/ });
    expect(lesDeux).toBeChecked();

    await utilisateur.click(gererSeul);
    expect(gererSeul).toBeChecked();
    expect(within(barreLaterale()).queryByRole('navigation', { name: 'Analyser' })).toBeNull();
    expect(within(barreLaterale()).getAllByRole('link')[0]).toHaveAttribute('href', '/');
    expect(gestion.donnees().preferences).toEqual({ analyser: false, gerer: true });

    await utilisateur.click(analyserSeul);
    expect(analyserSeul).toBeChecked();
    expect(within(barreLaterale()).queryByRole('navigation', { name: 'Gérer' })).toBeNull();
    expect(gestion.donnees().preferences).toEqual({ analyser: true, gerer: false });

    await utilisateur.click(lesDeux);
    expect(section('Analyser')).toBeInTheDocument();
    expect(section('Gérer')).toBeInTheDocument();
    expect(gestion.donnees().preferences).toEqual({ analyser: true, gerer: true });
  });

  it('un enregistrement refusé remet le choix précédent et le dit', async () => {
    const utilisateur = userEvent.setup();
    monter(clientGestionMemoire({ erreurs: { enregistrerPreferences: 'reseau' } }));
    await utilisateur.click(await screen.findByRole('radio', { name: /Analyser seulement/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(ERREURS_GESTION.reseau);
    expect(screen.getByRole('radio', { name: /Analyser et Gérer/ })).toBeChecked();
    expect(section('Gérer')).toBeInTheDocument();
  });

  it('pendant le chargement puis en cas d’erreur, la carte le dit sans choix', async () => {
    const enAttente: ClientGestion = {
      ...clientGestionMemoire(),
      etat: () => new Promise(() => undefined),
    };
    monter(enAttente);
    expect(await screen.findByText(TEXTES_MON_MENU.chargement)).toBeInTheDocument();
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('API indisponible : la carte le dit', async () => {
    monter(clientGestionMemoire({ erreurs: { etat: 'indisponible' } }));
    const carte = (await screen.findByRole('heading', { name: 'Mon menu' })).closest('section');
    expect(await within(carte!).findByText(ERREURS_GESTION.indisponible)).toBeInTheDocument();
  });
});
