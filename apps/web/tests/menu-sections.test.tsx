import { creerProjet, ecrireProjets, NOM_PROJET_EXEMPLE } from '@/stockage/projets';
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
    // Une seule ligne en tête : « Mes projets · N » puis son « + », avant les projets récents.
    const liens = within(analyser).getAllByRole('link');
    expect(liens[0]).toHaveAccessibleName('Mes projets · 1');
    expect(liens[0]).toHaveAttribute('href', '/projets');
    expect(liens[0]).toHaveAttribute('aria-current', 'page');
    expect(liens[1]).toHaveAccessibleName('Nouveau projet');
    expect(liens[1]).toHaveAttribute('href', '/projets/nouveau');
    expect(liens[1]).toHaveAttribute('title', 'Nouveau projet');
    expect(liens[1]).not.toHaveAttribute('aria-current');
    // Sur la liste, toute la ligne est surlignée.
    expect(liens[0]?.parentElement).toHaveClass('bg-accent-doux');
    // Comparer est dans la page Mes projets, plus dans le menu ; « Tous mes projets » a disparu.
    expect(within(analyser).queryByRole('link', { name: 'Comparer' })).toBeNull();
    expect(within(analyser).queryByRole('link', { name: /Tous mes projets/ })).toBeNull();
    const gerer = section('Gérer');
    expect(within(gerer).getAllByRole('link')).toHaveLength(1);
    expect(within(gerer).getByRole('link', { name: 'Gérer mes biens loués' })).toHaveAttribute(
      'href',
      '/gerer',
    );
    expect(within(barreLaterale()).queryByRole('button', { name: 'Nouveau projet' })).toBeNull();
  });

  it('« Mes projets · N » puis les 3 projets les plus récents', async () => {
    const stockage = window.localStorage;
    ecrireProjets(
      stockage,
      Array.from({ length: 7 }, (_, i) => creerProjet({ nom: `Projet ${String(i + 1)}` })),
    );
    render(<AppEnMemoire chemin="/comparer" stockage={stockage} compte={clientMemoire()} />);
    const analyser = await screen.findByRole('navigation', { name: 'Analyser' });
    expect(
      within(analyser)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['Mes projets · 7', '', 'Projet 1', 'Projet 2', 'Projet 3']);
    // Ailleurs que sur la liste, rien n'est surligné.
    const ligne = within(analyser).getByRole('link', { name: 'Mes projets · 7' });
    expect(ligne).not.toHaveAttribute('aria-current');
    expect(ligne.parentElement).not.toHaveClass('bg-accent-doux');
  });

  it('sans projet, la même ligne : « Mes projets · 0 » et son « + »', async () => {
    // Une liste vide est amorcée avec l'exemple au lancement : on le supprime depuis la page.
    const utilisateur = userEvent.setup();
    render(<AppEnMemoire chemin="/projets" compte={clientMemoire()} />);
    await utilisateur.click(
      await screen.findByRole('button', { name: `Supprimer ${NOM_PROJET_EXEMPLE}` }),
    );
    const analyser = section('Analyser');
    expect(within(analyser).getAllByRole('link')).toHaveLength(2);
    expect(within(analyser).getByRole('link', { name: 'Mes projets · 0' })).toBeInTheDocument();
    expect(within(analyser).getByRole('link', { name: 'Nouveau projet' })).toBeInTheDocument();
  });

  it('sur la page de création, seul le « + » est actif, en accent plein', async () => {
    render(<AppEnMemoire chemin="/projets/nouveau" compte={clientMemoire()} />);
    const analyser = await screen.findByRole('navigation', { name: 'Analyser' });
    const plus = within(analyser).getByRole('link', { name: 'Nouveau projet' });
    expect(plus).toHaveAttribute('aria-current', 'page');
    expect(plus).toHaveClass('bg-accent', 'w-11');
    const ligne = within(analyser).getByRole('link', { name: /^Mes projets/ });
    expect(ligne).not.toHaveAttribute('aria-current');
    expect(ligne.parentElement).not.toHaveClass('bg-accent-doux');
  });

  it('connecté : Ajouter un bien, Loyers du mois avec les retards, puis Tous les loyers', async () => {
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
    // La page Loyers, mois par mois, a son propre lien.
    expect(within(gerer).getByRole('link', { name: 'Tous les loyers' })).toHaveAttribute(
      'href',
      '/gerer/loyers',
    );
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
