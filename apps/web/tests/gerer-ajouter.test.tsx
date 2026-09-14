import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import { clientMemoire } from '@/compte/memoire';
import type { Utilisateur } from '@/compte/types';
import { clientGestionMemoire } from '@/gestion/memoire';
import type { ClientGestion } from '@/gestion/types';
import { ERREURS_GESTION } from '@/textes/gerer';
import { TEXTES_GERER } from '@/textes/gerer-ecrans';
import { ERREURS_SAISIE, TEXTES_AJOUTER } from '@/textes/gerer-saisie';

const CAMILLE: Utilisateur = {
  id: 'u1',
  nom: 'Camille Roux',
  email: 'camille@example.org',
  image: null,
};

type Utilisateurice = ReturnType<typeof userEvent.setup>;

/** Compte chaque clic du parcours : la règle des deux clics est vérifiée, pas supposée. */
function compteurDeClics(utilisateur: Utilisateurice): {
  cliquer: (element: HTMLElement) => Promise<void>;
  nombre: () => number;
} {
  let clics = 0;
  return {
    cliquer: async (element) => {
      clics += 1;
      await utilisateur.click(element);
    },
    nombre: () => clics,
  };
}

function monter(
  chemin: string,
  gestion: ClientGestion,
  compte = clientMemoire({ utilisateur: CAMILLE }),
): void {
  render(<AppEnMemoire chemin={chemin} compte={compte} gestion={gestion} />);
}

function page(): HTMLElement {
  return screen.getByRole('main');
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 14, 10, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('porte « Ajouter à la main »', () => {
  it('deux clics depuis l’accueil de Gérer : la location existe et ses loyers sont suivis', async () => {
    const utilisateur = userEvent.setup();
    const { cliquer, nombre } = compteurDeClics(utilisateur);
    const gestion = clientGestionMemoire();
    monter('/gerer', gestion);

    await cliquer(await within(page()).findByRole('link', { name: TEXTES_GERER.porteMainTitre }));
    await screen.findByRole('heading', { level: 1, name: TEXTES_AJOUTER.titre });
    // Saisies au clavier : elles ne comptent pas comme des clics.
    await utilisateur.type(
      screen.getByLabelText(TEXTES_AJOUTER.adresse),
      '3 rue du Rouet, Marseille 6e',
    );
    await utilisateur.type(screen.getByLabelText(TEXTES_AJOUTER.loyer), '490');
    await utilisateur.type(screen.getByLabelText(TEXTES_AJOUTER.charges), '40');
    await utilisateur.type(screen.getByLabelText(TEXTES_AJOUTER.locataire), 'Léa Bernard');
    await utilisateur.type(screen.getByLabelText(TEXTES_AJOUTER.email), 'lea.bernard@exemple.fr');
    await cliquer(screen.getByRole('button', { name: TEXTES_AJOUTER.creer }));

    // Entrée le 1er septembre, loyer le 5 : le 14, il est en retard.
    expect(
      await screen.findByRole('heading', { level: 1, name: '0 loyer sur 1 reçu' }),
    ).toBeInTheDocument();
    const ligne = screen.getByText('3 rue du Rouet', { selector: 'li span' }).closest('li')!;
    expect(within(ligne).getByText('Léa Bernard')).toBeInTheDocument();
    expect(within(ligne).getByText('En retard')).toBeInTheDocument();
    expect(nombre()).toBe(2);
    expect(gestion.donnees().locations).toEqual([
      expect.objectContaining({
        type: 'meublee',
        debut: '2026-09-01',
        jourLoyer: 5,
        loyerHorsCharges: 49_000,
        charges: 4_000,
        depot: 98_000,
      }),
    ]);
  });

  it('champs à corriger : message sous chaque champ, focus sur le premier, rien n’est envoyé', async () => {
    const utilisateur = userEvent.setup();
    const gestion = clientGestionMemoire();
    monter('/gerer/ajouter', gestion);
    await utilisateur.type(await screen.findByLabelText(TEXTES_AJOUTER.loyer), 'six cents');
    await utilisateur.type(screen.getByLabelText(TEXTES_AJOUTER.locataire), 'Léa');
    await utilisateur.click(screen.getByRole('button', { name: TEXTES_AJOUTER.creer }));

    const adresse = screen.getByLabelText(TEXTES_AJOUTER.adresse);
    expect(adresse).toHaveFocus();
    expect(adresse).toHaveAttribute('aria-invalid', 'true');
    expect(adresse).toHaveAccessibleDescription(ERREURS_SAISIE.adresse);
    expect(screen.getByLabelText(TEXTES_AJOUTER.loyer)).toHaveAccessibleDescription(
      ERREURS_SAISIE.loyer,
    );
    expect(screen.getByLabelText(TEXTES_AJOUTER.locataire)).toHaveAccessibleDescription(
      ERREURS_SAISIE.locataire,
    );
    expect(gestion.appels).not.toContain('creer');
  });

  it('sans locataire : un bien vacant, signalé sur l’accueil', async () => {
    const utilisateur = userEvent.setup();
    monter('/gerer/ajouter', clientGestionMemoire());
    await utilisateur.type(
      await screen.findByLabelText(TEXTES_AJOUTER.adresse),
      '8 avenue du Prado',
    );
    await utilisateur.click(screen.getByRole('button', { name: TEXTES_AJOUTER.creer }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Aucun loyer attendu ce mois-ci.' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Sans locataire/)).toHaveTextContent(
      'Sans locataire : 8 avenue du Prado',
    );
  });

  it('« Plus de détails » : location vide, jour, dépôt, type de bien et surface', async () => {
    const utilisateur = userEvent.setup();
    const gestion = clientGestionMemoire();
    monter('/gerer/ajouter', gestion);
    await utilisateur.type(
      await screen.findByLabelText(TEXTES_AJOUTER.adresse),
      '8 boulevard Baille',
    );
    await utilisateur.click(screen.getByRole('radio', { name: 'Vide' }));
    await utilisateur.type(screen.getByLabelText(TEXTES_AJOUTER.loyer), '400');
    await utilisateur.type(screen.getByLabelText(TEXTES_AJOUTER.locataire), 'Antoine Dupont');
    await utilisateur.click(screen.getByText(TEXTES_AJOUTER.plusDeDetails));
    expect(screen.getByLabelText(TEXTES_AJOUTER.depot)).toHaveAttribute(
      'placeholder',
      '1 mois de loyer par défaut',
    );
    await utilisateur.type(screen.getByLabelText(TEXTES_AJOUTER.jourLoyer), '3');
    await utilisateur.type(screen.getByLabelText(TEXTES_AJOUTER.depot), '400');
    await utilisateur.selectOptions(screen.getByLabelText(TEXTES_AJOUTER.typeBien), 'studio');
    await utilisateur.type(screen.getByLabelText(TEXTES_AJOUTER.surface), '24');
    await utilisateur.click(screen.getByRole('button', { name: TEXTES_AJOUTER.creer }));

    await screen.findByRole('heading', { level: 1, name: '0 loyer sur 1 reçu' });
    expect(gestion.donnees().biens[0]).toMatchObject({
      type: 'studio',
      surface: 24,
      meuble: false,
    });
    expect(gestion.donnees().locations[0]).toMatchObject({
      type: 'nue',
      jourLoyer: 3,
      depot: 40_000,
      charges: 0,
    });
  });

  it('une création refusée par le serveur s’affiche, la saisie reste', async () => {
    const utilisateur = userEvent.setup();
    monter('/gerer/ajouter', clientGestionMemoire({ erreurs: { creer: 'indisponible' } }));
    const adresse = await screen.findByLabelText(TEXTES_AJOUTER.adresse);
    await utilisateur.type(adresse, '8 avenue du Prado');
    await utilisateur.click(screen.getByRole('button', { name: TEXTES_AJOUTER.creer }));
    expect(await screen.findByRole('alert')).toHaveTextContent(ERREURS_GESTION.indisponible);
    expect(adresse).toHaveValue('8 avenue du Prado');
  });

  it('sans compte : la page explique pourquoi il en faut un', async () => {
    monter('/gerer/ajouter', clientGestionMemoire(), clientMemoire());
    expect(
      await screen.findByRole('heading', { level: 1, name: TEXTES_GERER.sansCompteTitre }),
    ).toBeInTheDocument();
  });
});
