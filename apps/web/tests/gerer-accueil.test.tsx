import { PREFERENCES_PAR_DEFAUT, type EtatGestion } from '@loupe/gestion';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import { clientMemoire } from '@/compte/memoire';
import type { Utilisateur } from '@/compte/types';
import { clientGestionMemoire, ETAT_GESTION_VIDE } from '@/gestion/memoire';
import type { ClientGestion } from '@/gestion/types';
import { ERREURS_GESTION } from '@/textes/gerer';
import { TEXTES_GERER } from '@/textes/gerer-ecrans';

import { BIEN_LICES, ETAT_SEPTEMBRE } from './gestion-exemples';

const CAMILLE: Utilisateur = {
  id: 'u1',
  nom: 'Camille Roux',
  email: 'camille@example.org',
  image: null,
};

function monter(gestion: ClientGestion, compte = clientMemoire({ utilisateur: CAMILLE })): void {
  render(<AppEnMemoire chemin="/gerer" compte={compte} gestion={gestion} />);
}

/** La ligne du loyer d'un bien, dans la liste du mois. */
function ligne(nomDuBien: string): HTMLElement {
  const element = screen.getByText(nomDuBien, { selector: 'li span' }).closest('li');
  if (element === null) throw new Error(`ligne ${nomDuBien} absente`);
  return element;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 14, 10, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Gérer : états de la page', () => {
  it('sans compte : pourquoi un compte, « Se connecter » revient sur Gérer', async () => {
    monter(clientGestionMemoire(), clientMemoire());
    expect(
      await screen.findByRole('heading', { level: 1, name: TEXTES_GERER.sansCompteTitre }),
    ).toBeInTheDocument();
    // La barre latérale a aussi son « Se connecter » : on lit celui de la page.
    const page = screen.getByRole('main');
    expect(within(page).getByRole('link', { name: 'Se connecter' })).toHaveAttribute(
      'href',
      '/connexion?retour=/gerer',
    );
    expect(within(page).getByRole('link', { name: 'Continuer à analyser' })).toHaveAttribute(
      'href',
      '/projets',
    );
  });

  it('pendant le chargement', async () => {
    monter({ ...clientGestionMemoire(), etat: () => new Promise(() => undefined) });
    expect(await screen.findByText(TEXTES_GERER.chargement)).toBeInTheDocument();
  });

  it('en erreur : le message, puis « Réessayer » relit', async () => {
    const utilisateur = userEvent.setup();
    const base = clientGestionMemoire();
    let lectures = 0;
    monter({
      ...base,
      etat: () => {
        lectures += 1;
        return lectures === 1 ? Promise.resolve({ ok: false, code: 'indisponible' }) : base.etat();
      },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(ERREURS_GESTION.indisponible);
    await utilisateur.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: TEXTES_GERER.portesTitre }),
    ).toBeInTheDocument();
  });
});

describe('Gérer : premier accès, les trois portes', () => {
  it('propose le projet d’exemple, la banque bientôt, et l’ajout à la main', async () => {
    monter(clientGestionMemoire({ etat: ETAT_GESTION_VIDE }));
    expect(
      await screen.findByRole('heading', { level: 1, name: TEXTES_GERER.portesTitre }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gérer ce bien' })).toHaveAttribute(
      'title',
      'Gérer ce bien : T3 · 65 m² · Marseille 5e',
    );
    expect(screen.getByText(TEXTES_GERER.bientot)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: TEXTES_GERER.porteMainTitre })).toHaveAttribute(
      'href',
      '/gerer/ajouter',
    );
  });
});

describe('Gérer : les loyers du mois', () => {
  it('« 1 loyer sur 2 reçu », la barre en euros, le statut en mot', async () => {
    monter(clientGestionMemoire({ etat: ETAT_SEPTEMBRE }));
    expect(
      await screen.findByRole('heading', { level: 1, name: '1 loyer sur 2 reçu' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Septembre 2026')).toBeInTheDocument();
    const barre = screen.getByRole('img', { name: /reçus sur/ });
    expect(barre.getAttribute('aria-label')?.replace(/\s/g, ' ')).toBe('700 € reçus sur 1 130 €');

    const baille = ligne('Studio Baille');
    expect(within(baille).getByText('En retard')).toBeInTheDocument();
    expect(within(baille).getByText('Antoine Dupont')).toBeInTheDocument();
    expect(within(baille).getByText('le 3')).toBeInTheDocument();
    const lices = ligne('T2 Lices');
    expect(within(lices).getByText('Reçu')).toBeInTheDocument();
    expect(within(lices).queryByRole('button')).toBeNull();
  });

  it('« Reçu » en un clic, puis « Annuler » ramène le loyer en retard', async () => {
    const utilisateur = userEvent.setup();
    const gestion = clientGestionMemoire({ etat: ETAT_SEPTEMBRE });
    monter(gestion);
    const bouton = within(
      await screen
        .findByText('Studio Baille', { selector: 'li span' })
        .then((el) => el.closest('li')!),
    ).getByRole('button', { name: 'Reçu' });
    expect(bouton).toHaveAttribute('title', 'Marquer reçu le loyer d’Antoine');

    await utilisateur.click(bouton);
    expect(await screen.findByRole('status')).toHaveTextContent('Loyer d’Antoine reçu.');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Tous les loyers sont reçus.' }),
    ).toBeInTheDocument();
    expect(gestion.donnees().paiements).toContainEqual(
      expect.objectContaining({
        locationId: 'location-antoine',
        periode: '2026-09',
        montant: 43_000,
        date: '2026-09-14',
      }),
    );

    await utilisateur.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: '1 loyer sur 2 reçu' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
    expect(gestion.donnees().paiements.map((p) => p.id)).toEqual(['paiement-julie']);
  });

  it('un « Reçu » ou une annulation refusés s’affichent', async () => {
    const utilisateur = userEvent.setup();
    const base = clientGestionMemoire({ etat: ETAT_SEPTEMBRE });
    monter({ ...base, payer: () => Promise.resolve({ ok: false, code: 'reseau' }) });
    await utilisateur.click(
      within(
        (await screen.findByText('Studio Baille', { selector: 'li span' })).closest('li')!,
      ).getByRole('button', { name: 'Reçu' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(ERREURS_GESTION.reseau);
  });

  it('une annulation refusée s’affiche', async () => {
    const utilisateur = userEvent.setup();
    const base = clientGestionMemoire({ etat: ETAT_SEPTEMBRE });
    monter({ ...base, annulerPaiement: () => Promise.resolve({ ok: false, code: 'introuvable' }) });
    await utilisateur.click(
      within(
        (await screen.findByText('Studio Baille', { selector: 'li span' })).closest('li')!,
      ).getByRole('button', { name: 'Reçu' }),
    );
    await utilisateur.click(await screen.findByRole('button', { name: 'Annuler' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(ERREURS_GESTION.introuvable);
  });

  it('un bien sans locataire est signalé ; sans aucun loyer dû, pas de barre', async () => {
    const vacant: EtatGestion = {
      ...ETAT_GESTION_VIDE,
      biens: [{ ...BIEN_LICES, id: 'parking', nom: 'Parking Prado' }],
      preferences: PREFERENCES_PAR_DEFAUT,
    };
    monter(clientGestionMemoire({ etat: vacant }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Aucun loyer attendu ce mois-ci.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Sans locataire : Parking Prado')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /reçus sur/ })).toBeNull();
  });
});
