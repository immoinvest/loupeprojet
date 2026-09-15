import type { Depense, EtatGestion, LocationGeree } from '@loupe/gestion';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import { clientMemoire } from '@/compte/memoire';
import type { Utilisateur } from '@/compte/types';
import { clientArgentMemoire } from '@/gestion/argent/memoire';
import type { ClientArgent } from '@/gestion/argent/types';
import { clientBailMemoire } from '@/gestion/bail/memoire';
import { clientFinBailMemoire } from '@/gestion/fin-bail/memoire';
import type { ClientFinBail } from '@/gestion/fin-bail/types';
import { clientGestionMemoire, type ClientGestionMemoire } from '@/gestion/memoire';
import { TEXTES_A_FAIRE } from '@/textes/gerer-a-faire';
import {
  TEXTES_CHARGES,
  TEXTES_COLOCATAIRE,
  TEXTES_DECOMPTE,
  TEXTES_DEPOT,
  TEXTES_PREAVIS,
} from '@/textes/gerer-fin-bail';

import { ANTOINE, BAILLEUR, BIEN_LICES, ETAT_SEPTEMBRE, LOCATION_JULIE } from './gestion-exemples';

const CAMILLE: Utilisateur = {
  id: 'u1',
  nom: 'Camille Roux',
  email: 'camille@example.org',
  image: null,
};
const MAINTENANT = '2026-09-14T09:00:00.000Z';
const ATTENTE = { timeout: 10_000 };
const simple = (texte: string | null): string => (texte ?? '').replace(/\s/g, ' ');

/** Julie est partie le 20 août 2026 : le dépôt est à rendre avant le 20 septembre. */
const TERMINEE: LocationGeree = { ...LOCATION_JULIE, fin: '2026-08-20' };

const COPRO: Depense = {
  id: 'depense-copro',
  bienId: 'bien-lices',
  categorie: 'copropriete',
  montant: 4_500,
  date: '2025-01-10',
  recuperable: true,
  recurrence: { frequence: 'mensuelle' },
  creeLe: MAINTENANT,
  modifieLe: MAINTENANT,
};

interface Clients {
  readonly gestion: ClientGestionMemoire;
  readonly finBail: ClientFinBail;
  /** Les dépenses d'A1 : la régularisation des charges les lit par `useArgent()`. */
  readonly argent: ClientArgent;
}

function avec(etat: Partial<EtatGestion>, depenses: readonly Depense[] = []): Clients {
  const gestion = clientGestionMemoire({
    etat: { ...ETAT_SEPTEMBRE, bailleur: BAILLEUR, ...etat },
    maintenant: MAINTENANT,
  });
  return {
    gestion,
    finBail: clientFinBailMemoire({ gestion, depenses, maintenant: MAINTENANT }),
    argent: clientArgentMemoire({ etat: { depenses: [...depenses], prets: [] } }),
  };
}

function monter(chemin: string, clients: Clients): void {
  render(
    <AppEnMemoire
      chemin={chemin}
      compte={clientMemoire({ utilisateur: CAMILLE })}
      gestion={clients.gestion}
      argent={clients.argent}
      bail={clientBailMemoire({ gestion: clients.gestion, maintenant: MAINTENANT })}
      finBail={clients.finBail}
    />,
  );
}

async function carte(titre: string): Promise<HTMLElement> {
  const entete = await screen.findByRole('heading', { level: 2, name: titre }, ATTENTE);
  const section = entete.closest('section');
  if (section === null) throw new Error(`carte ${titre} absente`);
  return section;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 14, 10, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('préavis (G4-2)', () => {
  it('« Julie part » puis « Enregistrer le congé » : deux clics, la sortie est enregistrée', async () => {
    const utilisateur = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const clients = avec({});
    monter('/gerer/biens/bien-lices', clients);

    const bouton = await screen.findByRole('button', { name: 'Julie part' }, ATTENTE);
    await utilisateur.click(bouton);
    const formulaire = screen.getByRole('form', { name: TEXTES_PREAVIS.formulaire });
    // Meublée : un mois de préavis (art. 25-8), depuis aujourd'hui.
    expect(within(formulaire).getByText(/Préavis de 1 mois/)).toBeInTheDocument();
    expect(within(formulaire).getByLabelText(TEXTES_PREAVIS.fin)).toHaveValue('2026-10-14');
    await utilisateur.click(
      within(formulaire).getByRole('button', { name: TEXTES_PREAVIS.enregistrer }),
    );

    // La date apparaît deux fois : dans le message de confirmation et dans la pastille « Préavis ».
    const departs = await screen.findAllByText('Départ le 14 octobre 2026', {}, ATTENTE);
    expect(departs.length).toBeGreaterThan(0);
    expect(clients.finBail).toBeDefined();
    await utilisateur.click(screen.getByRole('button', { name: TEXTES_PREAVIS.annuler }));
    expect(await screen.findByRole('button', { name: 'Julie part' }, ATTENTE)).toBeInTheDocument();
  });
});

describe('dépôt de garantie (G4-3)', () => {
  it('« À faire » mène au bien ; « État des lieux conforme » rend le dépôt et ouvre le décompte', async () => {
    const utilisateur = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const clients = avec({ locations: [TERMINEE], paiements: [] });
    monter('/gerer', clients);

    const aFaire = await carte(TEXTES_A_FAIRE.titre);
    const ligne = within(aFaire).getByRole('link', {
      name: /Rendre le dépôt de Julie avant le 20 septembre 2026/,
    });
    await utilisateur.click(ligne);

    const terminee = await carte('Terminée');
    expect(simple(within(terminee).getByText(/à rendre avant/).textContent)).toContain(
      '1 300 € à rendre avant le 20 septembre 2026',
    );
    await utilisateur.click(
      within(terminee).getByRole('button', { name: /État des lieux conforme/ }),
    );

    const voir = await within(terminee).findByRole(
      'link',
      { name: TEXTES_DEPOT.voirDecompte },
      ATTENTE,
    );
    await utilisateur.click(voir);
    expect(
      await screen.findByRole('heading', { level: 1, name: TEXTES_DECOMPTE.restitution }, ATTENTE),
    ).toBeInTheDocument();
    expect(screen.getByText(/Somme restituée/)).toBeInTheDocument();
  });

  it('« Retenues » : motif et montant, le décompte retient la somme', async () => {
    const utilisateur = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    monter('/gerer/biens/bien-lices', avec({ locations: [TERMINEE], paiements: [] }));

    const terminee = await carte('Terminée');
    await utilisateur.click(within(terminee).getByRole('button', { name: TEXTES_DEPOT.retenues }));
    const formulaire = within(terminee).getByRole('form', { name: TEXTES_DEPOT.formulaire });
    await utilisateur.type(within(formulaire).getByLabelText(TEXTES_DEPOT.motif), 'Peinture');
    await utilisateur.type(within(formulaire).getByLabelText(TEXTES_DEPOT.montantRetenue), '120');
    await utilisateur.click(
      within(formulaire).getByRole('button', { name: TEXTES_DEPOT.enregistrerRetenues }),
    );

    const lien = await within(terminee).findByRole(
      'link',
      { name: TEXTES_DEPOT.voirDecompte },
      ATTENTE,
    );
    expect(lien).toBeInTheDocument();
    expect(simple(within(terminee).getByText(/à rendre avant/).textContent)).toContain('1 180 €');
  });
});

describe('charges (G4-4) et colocataires (G4-6)', () => {
  it('« Valider la régularisation » : le solde et son échéance apparaissent', async () => {
    const utilisateur = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    monter('/gerer/biens/bien-lices', avec({}, [COPRO]));

    const charges = await carte(TEXTES_CHARGES.titre);
    // 150 € de provisions (oct.-déc. 2025) contre 136,11 € de charges récupérables.
    expect(simple(within(charges).getByText(/Charges 2025/).textContent)).toContain(
      'Charges 2025 : 13,89 € à rembourser',
    );
    await utilisateur.click(within(charges).getByRole('button', { name: TEXTES_CHARGES.valider }));
    expect(await within(charges).findByText(/À régler/, {}, ATTENTE)).toBeInTheDocument();
    expect(
      within(charges).getByRole('button', { name: TEXTES_CHARGES.marquerReglee }),
    ).toBeInTheDocument();
  });

  it('« Changer de colocataire » : Hugo arrive, la solidarité de Julie est rappelée', async () => {
    const utilisateur = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const bail = { ...LOCATION_JULIE, colocataireIds: [ANTOINE.id] };
    monter('/gerer/biens/bien-lices', avec({ locations: [bail] }));

    await utilisateur.click(
      await screen.findByRole('button', { name: TEXTES_COLOCATAIRE.ouvrir }, ATTENTE),
    );
    const formulaire = screen.getByRole('form', { name: TEXTES_COLOCATAIRE.formulaire });
    await utilisateur.click(
      within(formulaire).getByRole('button', { name: new RegExp(TEXTES_COLOCATAIRE.qui) }),
    );
    await utilisateur.click(screen.getByRole('option', { name: 'Julie Martin' }));
    await utilisateur.type(
      within(formulaire).getByLabelText(TEXTES_COLOCATAIRE.arrivant),
      'Hugo Petit',
    );
    await utilisateur.click(
      within(formulaire).getByRole('button', { name: TEXTES_COLOCATAIRE.enregistrer }),
    );

    expect(
      await screen.findByText(/La solidarité de Julie prend fin/, {}, ATTENTE),
    ).toBeInTheDocument();
    expect(screen.getByText(/porteront les nouveaux noms/)).toBeInTheDocument();
    expect(await screen.findByText(/Hugo Petit/, {}, ATTENTE)).toBeInTheDocument();
    expect(BIEN_LICES.nom).toBe('T2 Lices');
  });
});
