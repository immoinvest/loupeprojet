import type { DemandeDocument, DocumentComplet, EtatGestion } from '@loupe/gestion';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import { clientMemoire } from '@/compte/memoire';
import type { Utilisateur } from '@/compte/types';
import { clientGestionMemoire, type ClientGestionMemoire } from '@/gestion/memoire';
import type { ClientGestion } from '@/gestion/types';
import { ERREURS_GESTION, TEXTES_EXPORT } from '@/textes/gerer';
import { TEXTES_DOCUMENT as D } from '@/textes/gerer-documents';

import {
  BAILLEUR,
  ETAT_SEPTEMBRE,
  HORODATAGE,
  LOCATION_ANTOINE,
  LOCATION_JULIE,
  PAIEMENT_JULIE,
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

/** Émet le document sur un premier client, puis rend un client qui le connaît avec son contenu. */
async function avecDocument(
  etat: EtatGestion,
  demande: DemandeDocument,
): Promise<{ client: ClientGestionMemoire; emis: DocumentComplet }> {
  const premier = clientGestionMemoire({ etat });
  const r = await premier.emettreDocument(demande);
  if (!r.ok) throw new Error(r.code);
  return {
    client: clientGestionMemoire({ etat: premier.donnees(), documents: [r.valeur] }),
    emis: r.valeur,
  };
}

/** La ligne d'un montant du tableau, espaces insécables ramenés à des espaces. */
function montantDe(libelle: string): string {
  return within(screen.getByRole('row', { name: new RegExp(libelle) }))
    .getByRole('cell')
    .textContent.replace(/\s/g, ' ');
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 14, 10, 0));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Document imprimable', () => {
  it('quittance hors coque : parties, période, montants, déclaration, mention ; « Imprimer »', async () => {
    const utilisateur = userEvent.setup();
    const imprimer = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const { client, emis } = await avecDocument(
      { ...ETAT_SEPTEMBRE, bailleur: BAILLEUR },
      { type: 'quittance', locationId: 'location-julie', periode: '2026-09' },
    );
    monter(client, `/gerer/documents/${emis.id}`);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Quittance de loyer' }),
    ).toBeInTheDocument();
    // Hors de la coque : pas de menu.
    expect(screen.queryByRole('navigation', { name: 'Gérer' })).toBeNull();
    expect(screen.getByText(`N° ${emis.numero}`)).toBeInTheDocument();
    expect(screen.getByText(BAILLEUR.nom)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Locataire' })).toBeInTheDocument();
    expect(screen.getByText('Julie Martin')).toBeInTheDocument();
    expect(screen.getByText('T2 Lices, 12 rue des Lices, Marseille 5e')).toBeInTheDocument();
    expect(screen.getByText('du 1er septembre 2026 au 30 septembre 2026')).toBeInTheDocument();
    expect(montantDe(D.loyer)).toBe('650 €');
    expect(montantDe(D.charges)).toBe('50 €');
    expect(montantDe(D.total)).toBe('700 €');
    expect(screen.queryByRole('row', { name: new RegExp(D.resteDu) })).toBeNull();
    expect(screen.getByText(/et en donne quittance/)).toBeInTheDocument();
    expect(screen.getByText('Pour acquit.')).toBeInTheDocument();
    expect(screen.getByText('Fait le 14 septembre 2026.')).toBeInTheDocument();

    await utilisateur.click(screen.getByRole('button', { name: D.imprimer }));
    expect(imprimer).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: /Tous les loyers/ })).toHaveAttribute(
      'href',
      '/gerer/loyers',
    );
  });

  it('quittance d’une chambre en colocation payée en deux fois : locataires, chambre, reçus annulés', async () => {
    const etat: EtatGestion = {
      ...ETAT_SEPTEMBRE,
      bailleur: BAILLEUR,
      locataires: [
        ...ETAT_SEPTEMBRE.locataires,
        { id: 'locataire-lea', prenom: 'Léa', nom: 'Bernard', creeLe: HORODATAGE },
      ],
      locations: [
        LOCATION_JULIE,
        { ...LOCATION_ANTOINE, libelle: 'Chambre 2', colocataireIds: ['locataire-lea'] },
      ],
      paiements: [
        {
          ...PAIEMENT_JULIE,
          id: 'p1',
          locationId: 'location-antoine',
          montant: 20_000,
          date: '2026-09-04',
        },
        {
          ...PAIEMENT_JULIE,
          id: 'p2',
          locationId: 'location-antoine',
          montant: 23_000,
          date: '2026-09-10',
        },
      ],
    };
    const { client, emis } = await avecDocument(etat, {
      type: 'quittance',
      locationId: 'location-antoine',
      periode: '2026-09',
    });
    monter(client, `/gerer/documents/${emis.id}`);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Locataires' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Antoine Dupont')).toBeInTheDocument();
    expect(screen.getByText('Léa Bernard')).toBeInTheDocument();
    expect(
      screen.getByText('Studio Baille · Chambre 2, 8 boulevard Baille, Marseille 6e'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('list'))
        .getAllByRole('listitem')
        .map((li) => li.textContent.replace(/\s/g, ' ')),
    ).toEqual(['200 € le 4 septembre 2026', '230 € le 10 septembre 2026']);
    expect(screen.getByText(/annule les reçus/)).toBeInTheDocument();
  });

  it('reçu d’un paiement partiel : déjà reçu, reste dû, ne vaut pas quittance', async () => {
    const partiel = {
      ...PAIEMENT_JULIE,
      id: 'partiel',
      locationId: 'location-antoine',
      montant: 20_000,
      date: '2026-09-04',
    };
    const { client, emis } = await avecDocument(
      { ...ETAT_SEPTEMBRE, bailleur: BAILLEUR, paiements: [PAIEMENT_JULIE, partiel] },
      { type: 'recu', paiementId: 'partiel' },
    );
    monter(client, `/gerer/documents/${emis.id}`);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Reçu de paiement' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: D.paiementAtteste })).toBeInTheDocument();
    expect(montantDe(D.dejaRecu)).toBe('0 €');
    expect(montantDe(D.resteDu)).toBe('230 €');
    expect(screen.getByText(/Ce reçu ne vaut pas quittance\./)).toBeInTheDocument();
    expect(screen.queryByText('Pour acquit.')).toBeNull();
  });

  it('document introuvable (ou d’un autre compte) : le dit, avec le lien vers Loyers, sans impression', async () => {
    monter(clientGestionMemoire({ etat: ETAT_SEPTEMBRE }), '/gerer/documents/inconnu');
    expect(
      await screen.findByRole('heading', { level: 1, name: D.introuvable }),
    ).toBeInTheDocument();
    expect(screen.getByText(D.introuvableTexte)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Tous les loyers/ })).toHaveAttribute(
      'href',
      '/gerer/loyers',
    );
    expect(screen.queryByRole('button', { name: D.imprimer })).toBeNull();
  });

  it('lecture impossible : la phrase de l’erreur', async () => {
    monter(
      clientGestionMemoire({ etat: ETAT_SEPTEMBRE, erreurs: { document: 'reseau' } }),
      '/gerer/documents/document-1',
    );
    expect(await screen.findByText(ERREURS_GESTION.reseau)).toBeInTheDocument();
  });

  it('sans compte : la page qui explique pourquoi il en faut un', async () => {
    render(<AppEnMemoire chemin="/gerer/documents/document-1" compte={clientMemoire()} />);
    expect(await screen.findByRole('link', { name: 'Continuer à analyser' })).toBeInTheDocument();
  });
});

describe('Mon compte : mes données de gestion', () => {
  it('« Exporter » est un lien vers le fichier JSON de l’API', async () => {
    monter(clientGestionMemoire({ etat: ETAT_SEPTEMBRE }), '/compte');
    expect(await screen.findByRole('heading', { name: TEXTES_EXPORT.titre })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: TEXTES_EXPORT.exporter })).toHaveAttribute(
      'href',
      '/api/gestion/export',
    );
  });
});
