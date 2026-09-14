import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import { clientMemoire } from '@/compte/memoire';
import type { Utilisateur } from '@/compte/types';
import { clientGestionMemoire, ETAT_GESTION_VIDE } from '@/gestion/memoire';
import type { ClientGestion } from '@/gestion/types';
import { creerProjet, ecrireProjets, lireProjets } from '@/stockage/projets';
import { ERREURS_GESTION } from '@/textes/gerer';

import { ETAT_SEPTEMBRE } from './gestion-exemples';

const CAMILLE: Utilisateur = {
  id: 'u1',
  nom: 'Camille Roux',
  email: 'camille@example.org',
  image: null,
};

const n = (s: string | null): string => (s ?? '').replace(/\s/g, ' ');

function bloc(nom: 'Analyser' | 'Gérer'): HTMLElement {
  const titre = within(screen.getByRole('main')).getByRole('heading', { level: 2, name: nom });
  const section = titre.closest('section');
  if (section === null) throw new Error(`bloc ${nom} absent`);
  return section;
}

function connectee(gestion: ClientGestion): void {
  render(
    <AppEnMemoire chemin="/" compte={clientMemoire({ utilisateur: CAMILLE })} gestion={gestion} />,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 14, 10, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Accueil sans compte', () => {
  it('la racine est l’accueil ; le logo et « Accueil » y mènent', async () => {
    render(<AppEnMemoire chemin="/" compte={clientMemoire()} />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bienvenue sur Deklic' }),
    ).toBeInTheDocument();
    const barre = document.getElementById('navigation-principale')!;
    expect(within(barre).getByRole('link', { name: 'Deklic : accueil' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(
      within(within(barre).getByRole('navigation', { name: 'Accueil' })).getByRole('link', {
        name: 'Accueil',
      }),
    ).toHaveAttribute('href', '/');
  });

  it('deux blocs : Analyser propose l’annonce et l’exemple, Gérer la connexion', async () => {
    render(<AppEnMemoire chemin="/" compte={clientMemoire()} />);
    await screen.findByRole('heading', { level: 1, name: 'Bienvenue sur Deklic' });
    const exemple = lireProjets(window.localStorage)[0]!;

    const analyser = bloc('Analyser');
    expect(within(analyser).getByRole('link', { name: 'Analyser une annonce' })).toHaveAttribute(
      'href',
      '/projets/nouveau',
    );
    expect(within(analyser).getByRole('link', { name: 'Voir l’exemple' })).toHaveAttribute(
      'href',
      `/projets/${exemple.id}`,
    );
    expect(within(bloc('Gérer')).getByRole('link', { name: 'Se connecter' })).toHaveAttribute(
      'href',
      '/connexion?retour=/',
    );
  });

  it('avec des projets : à l’étude, étapes, meilleur cash-flow et prochaine étape', async () => {
    ecrireProjets(window.localStorage, [
      creerProjet({ nom: 'T2 Lyon', statut: 'offre' }),
      creerProjet({ nom: 'Studio Nice', statut: 'ecarte' }),
    ]);
    render(<AppEnMemoire chemin="/" compte={clientMemoire()} />);
    await screen.findByRole('heading', { level: 1, name: 'Bienvenue sur Deklic' });
    const analyser = bloc('Analyser');
    const lyon = lireProjets(window.localStorage)[0]!;

    expect(within(analyser).getByText('projet à l’étude')).toBeInTheDocument();
    const etapes = within(analyser).getByRole('list', { name: 'Où en sont tes projets' });
    expect(
      within(etapes)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['0En analyse', '0Visite prévue', '1Offre faite', '0Acheté']);
    const meilleur = within(analyser).getByRole('link', { name: /Meilleur cash-flow/ });
    expect(meilleur).toHaveAttribute('href', `/projets/${lyon.id}`);
    expect(n(meilleur.textContent)).toContain('−210 €/mois');
    expect(
      within(analyser).getByText('Offre faite sur T2 Lyon : sécurise ton financement.'),
    ).toBeInTheDocument();
    expect(within(analyser).getByRole('link', { name: 'Vérifier le financement' })).toHaveAttribute(
      'href',
      `/projets/${lyon.id}/financement`,
    );
    expect(within(analyser).getByRole('link', { name: 'Tous mes projets' })).toHaveAttribute(
      'href',
      '/projets',
    );
  });

  it('tout écarté : « Analyser une annonce » à la place de la prochaine étape', async () => {
    ecrireProjets(window.localStorage, [creerProjet({ nom: 'Studio Nice', statut: 'ecarte' })]);
    render(<AppEnMemoire chemin="/" compte={clientMemoire()} />);
    await screen.findByRole('heading', { level: 1, name: 'Bienvenue sur Deklic' });
    const analyser = bloc('Analyser');
    expect(within(analyser).queryByText('Prochaine étape')).toBeNull();
    expect(
      within(analyser).getByRole('link', { name: 'Analyser une annonce' }),
    ).toBeInTheDocument();
  });
});

describe('Accueil connecté', () => {
  it('Gérer avec des biens : le mois, les loyers reçus, le retard', async () => {
    connectee(clientGestionMemoire({ etat: ETAT_SEPTEMBRE }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bonjour Camille' }),
    ).toBeInTheDocument();
    const gerer = bloc('Gérer');
    expect(await within(gerer).findByText('1 loyer sur 2 reçu')).toBeInTheDocument();
    expect(within(gerer).getByText('Septembre 2026 · 2 biens')).toBeInTheDocument();
    expect(n(within(gerer).getByRole('img').getAttribute('aria-label'))).toBe(
      '700 € reçus sur 1 130 €',
    );
    expect(within(gerer).getByText('1 loyer en retard')).toBeInTheDocument();
    expect(within(gerer).getByRole('link', { name: 'Voir les loyers du mois' })).toHaveAttribute(
      'href',
      '/gerer',
    );
    expect(within(gerer).getByRole('link', { name: 'Ajouter un bien' })).toHaveAttribute(
      'href',
      '/gerer/ajouter',
    );
  });

  it('Gérer tous loyers reçus : « Aucun retard »', async () => {
    const { paiements, ...reste } = ETAT_SEPTEMBRE;
    connectee(
      clientGestionMemoire({
        etat: {
          ...reste,
          paiements: [
            ...paiements,
            { ...paiements[0]!, id: 'p2', locationId: 'location-antoine', montant: 43_000 },
          ],
        },
      }),
    );
    const gerer = await screen.findByText('Tous les loyers sont reçus.');
    expect(within(gerer.closest('section')!).getByText('Aucun retard')).toBeInTheDocument();
  });

  it('Gérer sans bien : « Ajouter mon premier bien »', async () => {
    connectee(clientGestionMemoire({ etat: ETAT_GESTION_VIDE }));
    // Le premier rendu de l'application peut dépasser une seconde : on attend d'abord le titre.
    await screen.findByRole('heading', { level: 1, name: 'Bonjour Camille' });
    const lien = await screen.findByRole('link', { name: 'Ajouter mon premier bien' });
    expect(lien).toHaveAttribute('href', '/gerer');
  });

  it('Gérer seulement : un seul bloc, pas d’Analyser', async () => {
    connectee(
      clientGestionMemoire({
        etat: { ...ETAT_SEPTEMBRE, preferences: { analyser: false, gerer: true } },
      }),
    );
    await screen.findByText('1 loyer sur 2 reçu');
    expect(
      within(screen.getByRole('main')).queryByRole('heading', { level: 2, name: 'Analyser' }),
    ).toBeNull();
    expect(screen.getByText('Tes biens loués, tes loyers, sous contrôle.')).toBeInTheDocument();
  });

  it('Analyser seulement : un seul bloc, pas de Gérer', async () => {
    connectee(
      clientGestionMemoire({
        etat: { ...ETAT_SEPTEMBRE, preferences: { analyser: true, gerer: false } },
      }),
    );
    expect(
      await screen.findByText('Trouve le bien rentable, annonce après annonce.'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('main')).queryByRole('heading', { level: 2, name: 'Gérer' }),
    ).toBeNull();
  });

  it('Gérer en chargement, puis en erreur avec « Réessayer »', async () => {
    const utilisateur = userEvent.setup();
    const base = clientGestionMemoire({ etat: ETAT_GESTION_VIDE });
    let lectures = 0;
    connectee({
      ...base,
      etat: () => {
        lectures += 1;
        return lectures === 1 ? Promise.resolve({ ok: false, code: 'indisponible' }) : base.etat();
      },
    });
    expect(await within(bloc('Gérer')).findByRole('alert')).toHaveTextContent(
      ERREURS_GESTION.indisponible,
    );
    await utilisateur.click(within(bloc('Gérer')).getByRole('button', { name: 'Réessayer' }));
    expect(
      await screen.findByRole('link', { name: 'Ajouter mon premier bien' }),
    ).toBeInTheDocument();
  });

  it('pendant le chargement de Gérer', async () => {
    connectee({ ...clientGestionMemoire(), etat: () => new Promise(() => undefined) });
    await screen.findByRole('heading', { level: 1, name: 'Bonjour Camille' });
    expect(within(bloc('Gérer')).getByText('Chargement de tes biens…')).toBeInTheDocument();
  });
});
