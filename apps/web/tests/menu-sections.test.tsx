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

  it('lisible : icône et nombre en pastille, projets en retrait, titres contrastés, logo sans survol, outils regroupés', async () => {
    render(<AppEnMemoire chemin="/projets" compte={clientMemoire()} />);
    await screen.findByRole('heading', { level: 1, name: 'Mes projets' });
    const barre = barreLaterale();
    const analyser = section('Analyser');

    // Icône bleue, libellé, nombre dans sa pastille ; le nom accessible garde « · 1 ».
    const ligne = within(analyser).getByRole('link', { name: 'Mes projets · 1' });
    expect(ligne.querySelector('svg')).not.toBeNull();
    expect(ligne).toHaveClass('[&>svg]:text-accent', 'text-accent-fonce');
    expect(within(ligne).getByText('1')).toHaveClass('rounded-full', 'bg-surface');
    // Le « + » est un petit bouton bordé, secondaire.
    expect(within(analyser).getByRole('link', { name: 'Nouveau projet' })).toHaveClass(
      'border-accent-bordure',
      'bg-surface',
    );

    // Le projet récent : point de cash-flow à gauche, texte gris de 13 px.
    const projet = within(analyser).getByRole('link', { name: NOM_PROJET_EXEMPLE });
    expect(projet).toHaveClass('text-[13px]', 'text-encre-2');
    expect(projet.firstElementChild?.firstElementChild).toHaveAttribute('aria-hidden', 'true');

    // Titre de section en encre-3 (4,8 pour 1), plus en encre-4 (2,5 pour 1).
    expect(within(analyser).getByText('Analyser')).toHaveClass('text-encre-3');

    // Le logo mène à l'accueil sans effet de survol.
    const logo = within(barre).getByRole('link', { name: 'Deklic : accueil' });
    expect(logo).toHaveAttribute('data-logo');
    expect(logo.className).not.toMatch(/survol-/);

    // Sous « Outils », le simulateur seul : l'extension est dans Mon compte.
    const outils = within(barre).getByRole('navigation', { name: 'Outils' });
    expect(
      within(outils)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['Simulateur de prêt']);
    expect(within(barre).queryByRole('navigation', { name: 'Aide' })).toBeNull();
  });

  it('« Mes projets · N » puis les 3 projets les plus récents', async () => {
    const stockage = window.localStorage;
    ecrireProjets(
      stockage,
      Array.from({ length: 7 }, (_, i) => creerProjet({ nom: `Projet ${String(i + 1)}` })),
    );
    render(<AppEnMemoire chemin="/comparer" stockage={stockage} compte={clientMemoire()} />);
    const analyser = await screen.findByRole('navigation', { name: 'Analyser' });
    const liens = within(analyser).getAllByRole('link');
    expect(liens).toHaveLength(5);
    expect(liens[0]).toHaveAccessibleName('Mes projets · 7');
    expect(liens[1]).toHaveAccessibleName('Nouveau projet');
    expect(liens.slice(2).map((l) => l.textContent)).toEqual(['Projet 1', 'Projet 2', 'Projet 3']);
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
    expect(plus).toHaveClass('bg-accent', 'text-white');
    const ligne = within(analyser).getByRole('link', { name: /^Mes projets/ });
    expect(ligne).not.toHaveAttribute('aria-current');
    expect(ligne.parentElement).not.toHaveClass('bg-accent-doux');
  });

  it('connecté : « Mes biens · N » et son « + », Loyers du mois avec les retards, Tous les loyers, Mes locataires', async () => {
    render(
      <AppEnMemoire
        chemin="/projets"
        compte={clientMemoire({ utilisateur: CAMILLE })}
        gestion={clientGestionMemoire({ etat: ETAT_SEPTEMBRE })}
      />,
    );
    const gerer = await screen.findByRole('navigation', { name: 'Gérer' });
    // Une seule ligne en tête : le libellé ouvre Mes biens, le « + » ajoute un bien.
    await within(gerer).findByRole('link', { name: 'Mes biens · 2' });
    const liens = within(gerer).getAllByRole('link');
    expect(liens[0]).toHaveAccessibleName('Mes biens · 2');
    // Chaque page a sa propre icône : un calendrier pour les loyers du mois, plus la maison d'Accueil.
    expect(liens[2]?.querySelector('svg')).toHaveClass('lucide-calendar-check');
    expect(liens[1]).toHaveAccessibleName('Ajouter un bien');
    expect(liens[1]).toHaveAttribute('href', '/gerer/ajouter');
    expect(liens[1]).toHaveAttribute('title', 'Ajouter un bien');
    const loyers = await within(gerer).findByRole('link', { name: /Loyers du mois/ });
    expect(loyers).toHaveAttribute('href', '/gerer');
    expect(await within(loyers).findByLabelText('1 loyer en retard')).toHaveTextContent('1');
    // La page Loyers, mois par mois, a son propre lien.
    expect(within(gerer).getByRole('link', { name: 'Tous les loyers' })).toHaveAttribute(
      'href',
      '/gerer/loyers',
    );
    // Tous les biens, loués ou non, avec leur nombre.
    expect(within(gerer).getByRole('link', { name: 'Mes biens · 2' })).toHaveAttribute(
      'href',
      '/gerer/biens',
    );
    expect(within(gerer).getByRole('link', { name: 'Mes locataires' })).toHaveAttribute(
      'href',
      '/gerer/locataires',
    );
  });

  it('connecté, sur la fiche d’un bien : la ligne « Mes biens » reste surlignée', async () => {
    render(
      <AppEnMemoire
        chemin="/gerer/biens/bien-lices"
        compte={clientMemoire({ utilisateur: CAMILLE })}
        gestion={clientGestionMemoire({ etat: ETAT_SEPTEMBRE })}
      />,
    );
    const gerer = await screen.findByRole('navigation', { name: 'Gérer' });
    const ligne = await within(gerer).findByRole('link', { name: 'Mes biens · 2' });
    expect(ligne).toHaveAttribute('aria-current', 'page');
    expect(ligne.parentElement).toHaveClass('bg-accent-doux');
    expect(within(gerer).getByRole('link', { name: 'Ajouter un bien' })).not.toHaveAttribute(
      'aria-current',
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
