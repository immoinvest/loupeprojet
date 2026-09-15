import type { EtatGestion, LocationGeree } from '@loupe/gestion';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { CompteProvider } from '@/compte/CompteContext';
import { clientMemoire } from '@/compte/memoire';
import {
  FinBailProvider,
  useFinBail,
  type ContexteFinBail,
} from '@/gestion/fin-bail/FinBailContext';
import { clientFinBailIndisponible, clientFinBailMemoire } from '@/gestion/fin-bail/memoire';
import type { ClientFinBail } from '@/gestion/fin-bail/types';
import { GestionProvider, useGestion, type ContexteGestion } from '@/gestion/GestionContext';
import { clientGestionMemoire, type ClientGestionMemoire } from '@/gestion/memoire';

import { BAILLEUR, ETAT_SEPTEMBRE, JULIE, LOCATION_JULIE } from './gestion-exemples';

const MAINTENANT = '2026-09-14T09:00:00.000Z';
const CONGE = { recuLe: '2026-09-05', fin: '2026-10-05', reduit: false };
const TERMINEE: LocationGeree = { ...LOCATION_JULIE, fin: '2026-08-20' };
const AVEC_BAILLEUR: EtatGestion = { ...ETAT_SEPTEMBRE, bailleur: BAILLEUR };

let finBail: ContexteFinBail | undefined;
let gestion: ContexteGestion | undefined;

function Sonde(): JSX.Element {
  finBail = useFinBail();
  gestion = useGestion();
  return <span data-testid="statut">{finBail.statut}</span>;
}

function contexte(): ContexteFinBail {
  if (finBail === undefined) throw new Error('contexte absent');
  return finBail;
}

const CAMILLE = { id: 'u1', nom: 'Camille Roux', email: 'camille@example.org', image: null };

function monter(client: ClientFinBail, clientGestion: ClientGestionMemoire, connecte = true): void {
  finBail = undefined;
  cleanup();
  render(
    <CompteProvider client={clientMemoire(connecte ? { utilisateur: CAMILLE } : {})}>
      <GestionProvider client={clientGestion}>
        <FinBailProvider client={client}>
          <Sonde />
        </FinBailProvider>
      </GestionProvider>
    </CompteProvider>,
  );
}

async function statut(attendu: string): Promise<void> {
  await waitFor(() => {
    expect(screen.getByTestId('statut')).toHaveTextContent(attendu);
  });
}

describe('FinBailProvider', () => {
  it('congé et colocataire : la location et les locataires de Gérer suivent', async () => {
    const clientGestion = clientGestionMemoire({
      etat: { ...AVEC_BAILLEUR, locations: [{ ...LOCATION_JULIE, colocataireIds: [] }] },
      maintenant: MAINTENANT,
    });
    monter(clientFinBailMemoire({ gestion: clientGestion, maintenant: MAINTENANT }), clientGestion);
    await statut('pret');
    await waitFor(() => {
      expect(gestion?.statut).toBe('pret');
    });

    await act(async () => {
      expect((await contexte().enregistrerConge(LOCATION_JULIE.id, CONGE)).ok).toBe(true);
    });
    expect(contexte().donnees?.conges).toHaveLength(1);
    expect(gestion?.donnees?.locations[0]?.fin).toBe('2026-10-05');

    await act(async () => {
      expect((await contexte().retirerConge(LOCATION_JULIE.id)).ok).toBe(true);
    });
    expect(contexte().donnees?.conges).toEqual([]);
    expect(gestion?.donnees?.locations[0]?.fin).toBeUndefined();

    await act(async () => {
      expect(
        (
          await contexte().changerColocataire(LOCATION_JULIE.id, {
            arrivee: { locataire: { prenom: 'Hugo', nom: 'Petit' }, date: '2026-09-15' },
          })
        ).ok,
      ).toBe(true);
    });
    expect(contexte().donnees?.mouvements).toHaveLength(1);
    expect(gestion?.donnees?.locataires.map((l) => l.prenom)).toContain('Hugo');
    expect(gestion?.donnees?.locations[0]?.colocataireIds).toHaveLength(1);

    await act(async () => {
      expect((await contexte().enregistrerModeCharges(LOCATION_JULIE.id, 'forfait')).ok).toBe(true);
    });
    expect(contexte().donnees?.charges).toHaveLength(1);
  });

  it('dépôt et charges : l’état suit chaque écriture, l’annulation retire le décompte', async () => {
    const clientGestion = clientGestionMemoire({
      etat: { ...AVEC_BAILLEUR, locations: [TERMINEE], paiements: [] },
      maintenant: MAINTENANT,
    });
    const client = clientFinBailMemoire({
      gestion: clientGestion,
      maintenant: MAINTENANT,
      depenses: [
        {
          id: 'depense-copro',
          bienId: 'bien-lices',
          categorie: 'copropriete',
          montant: 4_500,
          date: '2025-01-10',
          recuperable: true,
          recurrence: { frequence: 'mensuelle' },
          creeLe: MAINTENANT,
          modifieLe: MAINTENANT,
        },
      ],
    });
    monter(client, clientGestion);
    await statut('pret');

    await act(async () => {
      expect(
        (
          await contexte().restituer(TERMINEE.id, {
            clesLe: '2026-08-20',
            conforme: true,
            retenues: [],
          })
        ).ok,
      ).toBe(true);
    });
    expect(contexte().donnees?.restitutions).toHaveLength(1);
    expect(contexte().donnees?.decomptes).toHaveLength(1);
    const decompteId = contexte().donnees?.decomptes[0]?.id ?? '';
    await act(async () => {
      expect((await contexte().decompte(decompteId)).ok).toBe(true);
      expect((await contexte().rendreDepot(TERMINEE.id, '2026-09-01')).ok).toBe(true);
    });
    expect(contexte().donnees?.restitutions[0]?.rendueLe).toBe('2026-09-01');

    await act(async () => {
      const r = await contexte().regulariser(TERMINEE.id, 2025);
      expect(r.ok).toBe(true);
    });
    const regularisation = contexte().donnees?.regularisations[0];
    expect(regularisation).toMatchObject({ annee: 2025, solde: -1_389 });
    await act(async () => {
      expect(
        (await contexte().reglerRegularisation(regularisation?.id ?? '', '2026-09-14')).ok,
      ).toBe(true);
    });
    expect(contexte().donnees?.regularisations[0]?.regleeLe).toBe('2026-09-14');
  });

  it('annuler la restitution retire son décompte de l’état', async () => {
    const clientGestion = clientGestionMemoire({
      etat: { ...AVEC_BAILLEUR, locations: [TERMINEE], paiements: [] },
      maintenant: MAINTENANT,
    });
    monter(clientFinBailMemoire({ gestion: clientGestion, maintenant: MAINTENANT }), clientGestion);
    await statut('pret');
    await act(async () => {
      await contexte().restituer(TERMINEE.id, {
        clesLe: '2026-08-20',
        conforme: true,
        retenues: [],
      });
      expect((await contexte().annulerRestitution(TERMINEE.id)).ok).toBe(true);
    });
    expect(contexte().donnees?.restitutions).toEqual([]);
    expect(contexte().donnees?.decomptes).toEqual([]);
  });

  it('sans migration : « indisponible », aucune écriture ; hors compte : anonyme', async () => {
    const clientGestion = clientGestionMemoire({ etat: AVEC_BAILLEUR });
    monter(clientFinBailIndisponible, clientGestion);
    await statut('indisponible');
    expect(contexte().donnees).toBeNull();
    expect(contexte().erreur).toBe('indisponible');
    await act(async () => {
      expect((await contexte().enregistrerConge(LOCATION_JULIE.id, CONGE)).ok).toBe(false);
    });

    monter(clientFinBailMemoire({ erreurs: { etat: 'reseau' } }), clientGestion);
    await statut('erreur');

    monter(clientFinBailMemoire(), clientGestion, false);
    await statut('anonyme');
    expect(contexte().erreur).toBeNull();
    expect(JULIE.prenom).toBe('Julie');
  });

  it('une écriture réussie avant le chargement de l’état ne casse rien', async () => {
    const clientGestion = clientGestionMemoire({ etat: AVEC_BAILLEUR });
    const memoire = clientFinBailMemoire({ gestion: clientGestion, maintenant: MAINTENANT });
    // L'état ne se charge pas, mais l'écriture passe : le contexte n'a rien à mettre à jour.
    const client: ClientFinBail = {
      ...memoire,
      etat: () => Promise.resolve({ ok: false, code: 'reseau' }),
    };
    monter(client, clientGestion);
    await statut('erreur');
    await act(async () => {
      expect((await contexte().enregistrerModeCharges(LOCATION_JULIE.id, 'forfait')).ok).toBe(true);
    });
    expect(contexte().donnees).toBeNull();
  });
});

describe('useFinBail hors fournisseur', () => {
  it('rend un contexte anonyme dont chaque action répond « indisponible »', async () => {
    finBail = undefined;
    cleanup();
    render(
      <CompteProvider client={clientMemoire({})}>
        <GestionProvider client={clientGestionMemoire()}>
          <Sonde />
        </GestionProvider>
      </CompteProvider>,
    );
    await statut('anonyme');
    const c = contexte();
    const indisponible = { ok: false, code: 'indisponible' };
    expect(c.donnees).toBeNull();
    expect(c.erreur).toBeNull();
    expect(await c.enregistrerConge('l1', CONGE)).toEqual(indisponible);
    expect(await c.retirerConge('l1')).toEqual(indisponible);
    expect(await c.enregistrerModeCharges('l1', 'forfait')).toEqual(indisponible);
    expect(await c.restituer('l1', { clesLe: '2026-08-20', conforme: true, retenues: [] })).toEqual(
      indisponible,
    );
    expect(await c.rendreDepot('l1', '2026-09-01')).toEqual(indisponible);
    expect(await c.annulerRestitution('l1')).toEqual(indisponible);
    expect(await c.regulariser('l1', 2025)).toEqual(indisponible);
    expect(await c.reglerRegularisation('r1', '2026-09-14')).toEqual(indisponible);
    expect(await c.changerColocataire('l1', {})).toEqual(indisponible);
    expect(await c.decompte('d1')).toEqual(indisponible);
  });
});
