import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import { clientMemoire } from '@/compte/memoire';
import type { Utilisateur } from '@/compte/types';
import { montant } from '@/gestion/format';
import { clientGestionMemoire } from '@/gestion/memoire';
import type { ClientGestion } from '@/gestion/types';
import { ERREURS_GESTION } from '@/textes/gerer';
import {
  bienSupprime,
  confirmationSuppression,
  ERREURS_MODIFIER,
  loyerAPartirDe,
  TEXTES_MODIFIER as M,
  TEXTES_SUPPRIMER as S,
} from '@/textes/gerer-biens';

import { ETAT_SEPTEMBRE, LOCATION_ANTOINE, LOCATION_JULIE } from './gestion-exemples';

const CAMILLE: Utilisateur = {
  id: 'u1',
  nom: 'Camille Roux',
  email: 'camille@example.org',
  image: null,
};

function monter(gestion: ClientGestion, chemin = '/gerer/biens/bien-lices'): void {
  render(
    <AppEnMemoire
      chemin={chemin}
      compte={clientMemoire({ utilisateur: CAMILLE })}
      gestion={gestion}
    />,
  );
}

function formulaire(): HTMLElement {
  return screen.getByRole('form', { name: M.titre });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 14, 10, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Modifier une location', () => {
  it('« Modifier » puis « Enregistrer » (deux clics) : 680 € depuis octobre 2026', async () => {
    const utilisateur = userEvent.setup();
    let clics = 0;
    const cliquer = async (element: HTMLElement): Promise<void> => {
      clics += 1;
      await utilisateur.click(element);
    };
    const gestion = clientGestionMemoire({ etat: ETAT_SEPTEMBRE });
    monter(gestion);
    await cliquer(await screen.findByRole('button', { name: M.modifier }, { timeout: 10_000 }));

    // Septembre est payé : le premier mois proposé est octobre.
    expect(within(formulaire()).getByLabelText(M.aPartirDe)).toHaveValue('2026-10');
    const loyer = within(formulaire()).getByLabelText(M.loyer);
    expect(loyer).toHaveValue('650');
    await utilisateur.clear(loyer);
    await utilisateur.type(loyer, '680');
    await cliquer(within(formulaire()).getByRole('button', { name: M.enregistrer }));

    // Ce mois-ci garde 650 € ; la carte annonce le loyer d'octobre.
    expect(await screen.findByText(loyerAPartirDe('2026-10'))).toBeInTheDocument();
    // L'espace fine insécable de « 680 € » devient une espace normale une fois le texte normalisé.
    expect(screen.getByText(montant(68_000).replace(/\s/g, ' '))).toBeInTheDocument();
    expect(clics).toBe(2);
    expect(screen.queryByRole('form', { name: M.titre })).toBeNull();
    expect(gestion.donnees().locations[0]?.changements).toEqual([
      { aPartirDe: '2026-10', loyerHorsCharges: 68_000, charges: 5_000, apl: 0 },
    ]);
  });

  it('rien de changé : fermé sans rien envoyer ; champ à corriger ; refus du serveur ; « Fermer »', async () => {
    const utilisateur = userEvent.setup();
    const gestion = clientGestionMemoire({
      etat: ETAT_SEPTEMBRE,
      erreurs: { modifierLocation: 'periode_payee' },
    });
    monter(gestion);
    await utilisateur.click(
      await screen.findByRole('button', { name: M.modifier }, { timeout: 10_000 }),
    );
    await utilisateur.click(within(formulaire()).getByRole('button', { name: M.enregistrer }));
    expect(screen.queryByRole('form', { name: M.titre })).toBeNull();
    expect(gestion.appels).not.toContain('modifierLocation');

    await utilisateur.click(screen.getByRole('button', { name: M.modifier }));
    const jour = within(formulaire()).getByLabelText(M.jourLoyer);
    await utilisateur.clear(jour);
    await utilisateur.type(jour, '31');
    await utilisateur.click(within(formulaire()).getByRole('button', { name: M.enregistrer }));
    expect(jour).toHaveFocus();
    expect(jour).toHaveAccessibleDescription(ERREURS_MODIFIER.jourLoyer);

    await utilisateur.clear(jour);
    await utilisateur.type(jour, '10');
    await utilisateur.click(within(formulaire()).getByRole('button', { name: M.enregistrer }));
    expect(await within(formulaire()).findByRole('alert')).toHaveTextContent(
      ERREURS_GESTION.periode_payee,
    );
    await utilisateur.click(within(formulaire()).getByRole('button', { name: M.fermer }));
    expect(screen.getByRole('button', { name: M.modifier })).toBeInTheDocument();
  });

  it('tous les loyers réglés : seuls le jour, le dépôt et la chambre se modifient', async () => {
    const utilisateur = userEvent.setup();
    const courte = { ...LOCATION_JULIE, debut: '2026-09-01', fin: '2026-09-30' };
    monter(
      clientGestionMemoire({ etat: { ...ETAT_SEPTEMBRE, locations: [courte, LOCATION_ANTOINE] } }),
    );
    await utilisateur.click(
      await screen.findByRole('button', { name: M.modifier }, { timeout: 10_000 }),
    );
    expect(within(formulaire()).getByText(M.tousRegles)).toBeInTheDocument();
    expect(within(formulaire()).queryByLabelText(M.loyer)).toBeNull();
    expect(within(formulaire()).getByLabelText(M.depot)).toHaveValue('1300');
  });
});

describe('Supprimer ce bien', () => {
  it('désactivé tant que le nom n’est pas tapé ; « Annuler » efface ; deux clics puis retour sur Mes biens', async () => {
    const utilisateur = userEvent.setup();
    const gestion = clientGestionMemoire({ etat: ETAT_SEPTEMBRE });
    monter(gestion);
    const encadre = (): HTMLElement => screen.getByRole('region', { name: S.titre });
    const champ = (): HTMLElement =>
      within(encadre()).getByLabelText(confirmationSuppression('T2 Lices'));

    await utilisateur.click(
      await screen.findByRole('button', { name: S.supprimer }, { timeout: 10_000 }),
    );
    expect(within(encadre()).getByRole('link', { name: S.exporter })).toHaveAttribute(
      'href',
      '/api/gestion/export',
    );
    expect(
      within(encadre()).getByRole('button', { name: S.supprimerDefinitivement }),
    ).toBeDisabled();
    await utilisateur.type(champ(), 't2 lices');
    await utilisateur.click(within(encadre()).getByRole('button', { name: S.annuler }));
    expect(screen.queryByRole('region', { name: S.titre })).toBeNull();
    expect(gestion.appels).not.toContain('supprimerBien');

    await utilisateur.click(screen.getByRole('button', { name: S.supprimer }));
    expect(champ()).toHaveValue('');
    await utilisateur.type(champ(), 'T2 Lices');
    await utilisateur.click(
      within(encadre()).getByRole('button', { name: S.supprimerDefinitivement }),
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: '1 bien' }, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(screen.getByText(bienSupprime('T2 Lices'))).toBeInTheDocument();
    expect(gestion.donnees().biens.map((b) => b.id)).toEqual(['bien-baille']);
  });

  it('suppression refusée : le message s’affiche, la fiche reste', async () => {
    const utilisateur = userEvent.setup();
    monter(clientGestionMemoire({ etat: ETAT_SEPTEMBRE, erreurs: { supprimerBien: 'reseau' } }));
    await utilisateur.click(
      await screen.findByRole('button', { name: S.supprimer }, { timeout: 10_000 }),
    );
    const encadre = screen.getByRole('region', { name: S.titre });
    await utilisateur.type(
      within(encadre).getByLabelText(confirmationSuppression('T2 Lices')),
      'T2 Lices',
    );
    await utilisateur.click(
      within(encadre).getByRole('button', { name: S.supprimerDefinitivement }),
    );
    expect(await within(encadre).findByRole('alert')).toHaveTextContent(ERREURS_GESTION.reseau);
    expect(screen.getByRole('heading', { level: 1, name: 'T2 Lices' })).toBeInTheDocument();
  });
});
