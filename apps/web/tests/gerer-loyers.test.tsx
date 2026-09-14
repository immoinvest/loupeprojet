import type { EtatGestion } from '@loupe/gestion';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import { clientMemoire } from '@/compte/memoire';
import type { Utilisateur } from '@/compte/types';
import { clientGestionMemoire } from '@/gestion/memoire';
import type { ClientGestion } from '@/gestion/types';
import { ERREURS_GESTION } from '@/textes/gerer';
import { TEXTES_BAILLEUR } from '@/textes/gerer-bailleur';
import { TEXTES_GERER } from '@/textes/gerer-ecrans';
import { TEXTES_LOYERS as T } from '@/textes/gerer-loyers';

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

function monter(gestion: ClientGestion, chemin = '/gerer/loyers'): void {
  render(
    <AppEnMemoire
      chemin={chemin}
      compte={clientMemoire({ utilisateur: CAMILLE })}
      gestion={gestion}
    />,
  );
}

/** La ligne du loyer d'un bien. */
async function ligne(nomDuBien: string): Promise<HTMLElement> {
  const element = (await screen.findByText(nomDuBien, { selector: 'li span' })).closest('li');
  if (element === null) throw new Error(`ligne ${nomDuBien} absente`);
  return element;
}

/** Les groupes de loyers affichés, dans l'ordre de la page. */
function groupes(): (string | null)[] {
  return within(screen.getByRole('main'))
    .getAllByRole('heading', { level: 2 })
    .map((titre) => titre.textContent);
}

/** Les boutons d'une ligne, espaces insécables ramenés à des espaces. */
function boutons(element: HTMLElement): string[] {
  return within(element)
    .getAllByRole('button')
    .map((b) => b.textContent.replace(/\s/g, ' '));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 14, 10, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Page Loyers : un mois au choix', () => {
  it('le mois en cours groupé ; mois précédent puis suivant', async () => {
    const utilisateur = userEvent.setup();
    monter(clientGestionMemoire({ etat: ETAT_SEPTEMBRE }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Septembre 2026' }),
    ).toBeInTheDocument();
    expect(groupes()).toEqual(['En retard', 'Reçus']);

    // Août : ni Julie ni Antoine n'ont de paiement enregistré.
    await utilisateur.click(screen.getByRole('link', { name: T.moisPrecedent }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Août 2026' })).toBeInTheDocument();
    expect(groupes()).toEqual(['En retard']);

    // Octobre n'a pas commencé : ses loyers sont attendus.
    await utilisateur.click(screen.getByRole('link', { name: T.moisSuivant }));
    await utilisateur.click(await screen.findByRole('link', { name: T.moisSuivant }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Octobre 2026' }),
    ).toBeInTheDocument();
    expect(groupes()).toEqual(['Attendus']);
  });

  it('un mois illisible dans l’adresse : le mois en cours', async () => {
    monter(clientGestionMemoire({ etat: ETAT_SEPTEMBRE }), '/gerer/loyers?mois=2026-13');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Septembre 2026' }),
    ).toBeInTheDocument();
  });

  it('un mois sans loyer le dit', async () => {
    monter(clientGestionMemoire({ etat: ETAT_SEPTEMBRE }), '/gerer/loyers?mois=2020-01');
    expect(await screen.findByText(T.aucun)).toBeInTheDocument();
  });

  it('sans compte : la page qui explique pourquoi il en faut un', async () => {
    render(<AppEnMemoire chemin="/gerer/loyers" compte={clientMemoire()} />);
    expect(
      await screen.findByRole('heading', { level: 1, name: TEXTES_GERER.sansCompteTitre }),
    ).toBeInTheDocument();
  });

  it('colocation à la chambre : le bien et sa chambre, tous les locataires du bail', async () => {
    const etat: EtatGestion = {
      ...ETAT_SEPTEMBRE,
      locataires: [
        ...ETAT_SEPTEMBRE.locataires,
        { id: 'locataire-lea', prenom: 'Léa', nom: 'Bernard', creeLe: HORODATAGE },
      ],
      locations: [
        LOCATION_JULIE,
        { ...LOCATION_ANTOINE, libelle: 'Chambre 2', colocataireIds: ['locataire-lea'] },
      ],
    };
    monter(clientGestionMemoire({ etat }));
    const chambre = await ligne('Studio Baille · Chambre 2');
    expect(within(chambre).getByText('Antoine Dupont et Léa Bernard')).toBeInTheDocument();
  });
});

describe('Page Loyers : les actions', () => {
  it('« En partie » puis « Enregistrer » (deux clics) : le loyer passe partiel, son reçu est proposé', async () => {
    const utilisateur = userEvent.setup();
    const gestion = clientGestionMemoire({ etat: ETAT_SEPTEMBRE });
    monter(gestion);
    await utilisateur.click(
      within(await ligne('Studio Baille')).getByRole('button', { name: T.enPartie }),
    );
    await utilisateur.type(screen.getByLabelText(T.montantRecu), '300');
    await utilisateur.click(screen.getByRole('button', { name: T.enregistrer }));

    expect(await screen.findByRole('status')).toHaveTextContent(/Paiement de 300\s€ enregistré\./);
    expect(groupes()).toEqual(['Partiels', 'Reçus']);
    const baille = await ligne('Studio Baille');
    expect(within(baille).getByText('Partiel')).toBeInTheDocument();
    expect(within(baille).getByText(/130\s€ restent/)).toBeInTheDocument();
    expect(boutons(baille)).toEqual(['Reçu de 300 €', 'En partie', 'Reçu']);
    expect(screen.queryByRole('form', { name: T.enPartie })).toBeNull();
    expect(gestion.appels.filter((a) => a === 'payer')).toHaveLength(1);
  });

  it('« Quittance » sans identité : la carte la demande, « Enregistrer et ouvrir » émet la quittance', async () => {
    const utilisateur = userEvent.setup();
    const gestion = clientGestionMemoire({ etat: ETAT_SEPTEMBRE });
    monter(gestion);
    await utilisateur.click(
      within(await ligne('T2 Lices')).getByRole('button', { name: T.quittance }),
    );
    const carte = await screen.findByRole('form', { name: TEXTES_BAILLEUR.titre });
    await utilisateur.type(within(carte).getByLabelText(TEXTES_BAILLEUR.nom), BAILLEUR.nom);
    await utilisateur.type(within(carte).getByLabelText(TEXTES_BAILLEUR.adresse), BAILLEUR.adresse);
    await utilisateur.click(
      within(carte).getByRole('button', { name: TEXTES_BAILLEUR.enregistrer }),
    );

    await waitFor(() => {
      expect(gestion.donnees().documents).toHaveLength(1);
    });
    expect(gestion.donnees()).toMatchObject({
      bailleur: BAILLEUR,
      documents: [{ type: 'quittance', locationId: 'location-julie', periode: '2026-09' }],
    });
    expect(gestion.appels.filter((a) => a !== 'etat')).toEqual([
      'emettreDocument',
      'enregistrerBailleur',
      'emettreDocument',
    ]);
  });

  it('une identité refusée s’affiche dans la carte ; « Annuler » la referme sans rien émettre', async () => {
    const utilisateur = userEvent.setup();
    const gestion = clientGestionMemoire({
      etat: ETAT_SEPTEMBRE,
      erreurs: { enregistrerBailleur: 'reseau' },
    });
    monter(gestion);
    await utilisateur.click(
      within(await ligne('T2 Lices')).getByRole('button', { name: T.quittance }),
    );
    const carte = await screen.findByRole('form', { name: TEXTES_BAILLEUR.titre });
    await utilisateur.type(within(carte).getByLabelText(TEXTES_BAILLEUR.nom), BAILLEUR.nom);
    await utilisateur.type(within(carte).getByLabelText(TEXTES_BAILLEUR.adresse), BAILLEUR.adresse);
    await utilisateur.click(
      within(carte).getByRole('button', { name: TEXTES_BAILLEUR.enregistrer }),
    );
    expect(await within(carte).findByRole('alert')).toHaveTextContent(ERREURS_GESTION.reseau);

    await utilisateur.click(within(carte).getByRole('button', { name: TEXTES_BAILLEUR.annuler }));
    expect(screen.queryByRole('form', { name: TEXTES_BAILLEUR.titre })).toBeNull();
    expect(gestion.donnees().documents).toEqual([]);
  });

  it('« Reçu de 200 € » émet le reçu du paiement partiel', async () => {
    const utilisateur = userEvent.setup();
    const partiel = {
      ...PAIEMENT_JULIE,
      id: 'partiel',
      locationId: 'location-antoine',
      montant: 20_000,
      date: '2026-09-04',
    };
    const gestion = clientGestionMemoire({
      etat: {
        ...ETAT_SEPTEMBRE,
        bailleur: BAILLEUR,
        paiements: [...ETAT_SEPTEMBRE.paiements, partiel],
      },
    });
    monter(gestion);
    await utilisateur.click(
      within(await ligne('Studio Baille')).getByRole('button', { name: /^Reçu de 200/ }),
    );
    await waitFor(() => {
      expect(gestion.donnees().documents).toEqual([
        expect.objectContaining({ type: 'recu', paiementId: 'partiel' }),
      ]);
    });
  });

  it('une émission refusée s’affiche', async () => {
    const utilisateur = userEvent.setup();
    monter(
      clientGestionMemoire({
        etat: { ...ETAT_SEPTEMBRE, bailleur: BAILLEUR },
        erreurs: { emettreDocument: 'reseau' },
      }),
    );
    await utilisateur.click(
      within(await ligne('T2 Lices')).getByRole('button', { name: T.quittance }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(ERREURS_GESTION.reseau);
  });
});
