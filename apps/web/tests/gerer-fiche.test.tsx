import type { EtatGestion } from '@loupe/gestion';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import { clientMemoire } from '@/compte/memoire';
import type { Utilisateur } from '@/compte/types';
import { clientGestionMemoire } from '@/gestion/memoire';
import type { ClientGestion } from '@/gestion/types';
import { ERREURS_GESTION } from '@/textes/gerer';
import { TEXTES_FICHE as F } from '@/textes/gerer-fiche';

import {
  BAILLEUR,
  BIEN_LICES,
  ETAT_SEPTEMBRE,
  HORODATAGE,
  LOCATION_ANTOINE,
  LOCATION_JULIE,
} from './gestion-exemples';

const CAMILLE: Utilisateur = {
  id: 'u1',
  nom: 'Camille Roux',
  email: 'camille@example.org',
  image: null,
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

async function ouvrirSortie(utilisateur: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> {
  await utilisateur.click(await screen.findByRole('button', { name: F.terminer }));
  return screen.getByRole('form', { name: F.terminer });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 14, 10, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Fiche d’un bien', () => {
  it('un clic sur le bien depuis Loyers : statut, location en cours, douze derniers mois', async () => {
    const utilisateur = userEvent.setup();
    monter(clientGestionMemoire({ etat: ETAT_SEPTEMBRE }), '/gerer/loyers');
    // Premier rendu de l'application dans ce fichier : plus d'une seconde quand toute la suite tourne.
    await utilisateur.click(
      await screen.findByRole('link', { name: 'T2 Lices' }, { timeout: 10_000 }),
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'T2 Lices' }, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Loué')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Location en cours' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Julie Martin')).toBeInTheDocument();
    expect(screen.getByText('1er octobre 2025')).toBeInTheDocument();

    const mois = within(screen.getByRole('list', { name: F.douzeMois })).getAllByRole('listitem');
    expect(mois).toHaveLength(12);
    expect(mois[0]).toHaveTextContent(/oct\. 2025.*En retard/);
    expect(mois[11]).toHaveTextContent(/sept\. 2026.*Reçu.*Quittance/);
  });

  it('« Terminer la location » puis « Enregistrer la sortie » (deux clics) : départ prévu', async () => {
    const utilisateur = userEvent.setup();
    const gestion = clientGestionMemoire({ etat: ETAT_SEPTEMBRE });
    monter(gestion, '/gerer/biens/bien-lices');
    const formulaire = await ouvrirSortie(utilisateur);
    const date = within(formulaire).getByLabelText(F.dateSortie);
    expect(date).toHaveValue('2026-09-14');
    fireEvent.change(date, { target: { value: '2026-12-31' } });
    await utilisateur.click(within(formulaire).getByRole('button', { name: F.enregistrerSortie }));

    expect(await screen.findByText('Départ prévu le 31 décembre 2026')).toBeInTheDocument();
    expect(screen.getByText('31 décembre 2026')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: F.terminer })).toBeNull();
    expect(gestion.donnees().locations.find((l) => l.id === 'location-julie')?.fin).toBe(
      '2026-12-31',
    );
  });

  it('date vide signalée sur le champ ; sortie refusée par le serveur affichée ; « Fermer »', async () => {
    const utilisateur = userEvent.setup();
    const gestion = clientGestionMemoire({ etat: ETAT_SEPTEMBRE });
    monter(gestion, '/gerer/biens/bien-lices');
    const formulaire = await ouvrirSortie(utilisateur);
    const date = within(formulaire).getByLabelText(F.dateSortie);
    const enregistrer = within(formulaire).getByRole('button', { name: F.enregistrerSortie });

    fireEvent.change(date, { target: { value: '' } });
    await utilisateur.click(enregistrer);
    expect(date).toHaveFocus();
    expect(date).toHaveAccessibleDescription(F.erreurDateSortie);
    expect(gestion.appels).not.toContain('terminerLocation');

    // Le loyer de septembre est reçu : une sortie en août est refusée.
    fireEvent.change(date, { target: { value: '2026-08-15' } });
    await utilisateur.click(enregistrer);
    expect(await within(formulaire).findByRole('alert')).toHaveTextContent(
      ERREURS_GESTION.paiements_apres_sortie,
    );

    await utilisateur.click(within(formulaire).getByRole('button', { name: F.fermer }));
    expect(screen.queryByRole('form', { name: F.terminer })).toBeNull();
    expect(screen.getByRole('button', { name: F.terminer })).toBeInTheDocument();
  });

  it('« Quittance » d’un mois reçu émet la quittance du mois et ouvre le document', async () => {
    const utilisateur = userEvent.setup();
    const gestion = clientGestionMemoire({ etat: { ...ETAT_SEPTEMBRE, bailleur: BAILLEUR } });
    monter(gestion, '/gerer/biens/bien-lices');
    await utilisateur.click(await screen.findByRole('button', { name: 'Quittance' }));
    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: 'Quittance de loyer' },
        { timeout: 10_000 },
      ),
    ).toBeInTheDocument();
    expect(gestion.donnees().documents).toEqual([
      expect.objectContaining({ locationId: 'location-julie', periode: '2026-09' }),
    ]);
  });

  it('chambres : une carte par location avec ses colocataires ; une location à venir', async () => {
    const etat: EtatGestion = {
      ...ETAT_SEPTEMBRE,
      locataires: [
        ...ETAT_SEPTEMBRE.locataires,
        { id: 'locataire-lea', prenom: 'Léa', nom: 'Bernard', creeLe: HORODATAGE },
      ],
      locations: [
        { ...LOCATION_JULIE, libelle: 'Chambre 1' },
        {
          ...LOCATION_ANTOINE,
          bienId: 'bien-lices',
          libelle: 'Chambre 2',
          colocataireIds: ['locataire-lea'],
        },
        { ...LOCATION_JULIE, id: 'location-future', libelle: 'Chambre 3', debut: '2026-10-01' },
      ],
    };
    monter(clientGestionMemoire({ etat }), '/gerer/biens/bien-lices');
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Location en cours · Chambre 2' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Antoine Dupont et Léa Bernard')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Location à venir · Chambre 3' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: F.terminer })).toHaveLength(3);
  });

  it('bien vacant venu d’une analyse : « Vacant », aucun locataire, « Voir l’analyse »', async () => {
    const etat: EtatGestion = {
      ...ETAT_SEPTEMBRE,
      biens: [
        ...ETAT_SEPTEMBRE.biens,
        { ...BIEN_LICES, id: 'bien-prado', nom: 'Parking Prado', projetId: 'projet-1' },
      ],
    };
    monter(clientGestionMemoire({ etat }), '/gerer/biens/bien-prado');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Parking Prado' }),
    ).toBeInTheDocument();
    expect(screen.getByText(F.aucuneLocation)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: F.voirAnalyse })).toHaveAttribute(
      'href',
      '/projets/projet-1',
    );
    expect(screen.queryByRole('button', { name: F.terminer })).toBeNull();
  });

  it('bien introuvable (ou d’un autre compte) : le dit, avec un lien vers les loyers', async () => {
    monter(clientGestionMemoire({ etat: ETAT_SEPTEMBRE }), '/gerer/biens/inconnu');
    expect(
      await screen.findByRole('heading', { level: 1, name: F.introuvable }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: F.voirLoyers })).toHaveAttribute(
      'href',
      '/gerer/loyers',
    );
  });
});
