import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { CompteProvider } from '@/compte/CompteContext';
import { clientMemoire } from '@/compte/memoire';
import { BailProvider, useBail, type ContexteBail } from '@/gestion/bail/BailContext';
import { clientBailIndisponible, clientBailMemoire } from '@/gestion/bail/memoire';
import type { ClientBail } from '@/gestion/bail/types';
import { GestionProvider, useGestion, type ContexteGestion } from '@/gestion/GestionContext';
import { clientGestionMemoire, type ClientGestionMemoire } from '@/gestion/memoire';

import { BAILLEUR, ETAT_SEPTEMBRE, LOCATION_JULIE } from './gestion-exemples';

let bail: ContexteBail | undefined;
let gestion: ContexteGestion | undefined;

function Sonde(): JSX.Element {
  bail = useBail();
  gestion = useGestion();
  return <span data-testid="statut">{bail.statut}</span>;
}

function contexte(): ContexteBail {
  if (bail === undefined) throw new Error('contexte absent');
  return bail;
}

const CAMILLE = { id: 'u1', nom: 'Camille Roux', email: 'camille@example.org', image: null };

function monter(client: ClientBail, clientGestion: ClientGestionMemoire, connecte = true): void {
  bail = undefined;
  cleanup();
  render(
    <CompteProvider client={clientMemoire(connecte ? { utilisateur: CAMILLE } : {})}>
      <GestionProvider client={clientGestion}>
        <BailProvider client={client}>
          <Sonde />
        </BailProvider>
      </GestionProvider>
    </CompteProvider>,
  );
}

async function statut(attendu: string): Promise<void> {
  await waitFor(() => {
    expect(screen.getByTestId('statut')).toHaveTextContent(attendu);
  });
}

describe('BailProvider', () => {
  it('prêt : enregistre, applique la révision, la location de Gérer suit ; refusé, rien ne change', async () => {
    const clientGestion = clientGestionMemoire({ etat: { ...ETAT_SEPTEMBRE, bailleur: BAILLEUR } });
    monter(clientBailMemoire({ gestion: clientGestion }), clientGestion);
    await statut('pret');
    await waitFor(() => {
      expect(gestion?.statut).toBe('pret');
    });

    await act(async () => {
      expect((await contexte().enregistrerBien('bien-lices', { dpeClasse: 'H' } as never)).ok).toBe(
        false,
      );
      expect(
        (
          await contexte().enregistrerBien('bien-lices', {
            dpeClasse: 'D',
            dpeDate: null,
            zoneTendue: null,
          })
        ).ok,
      ).toBe(true);
      expect(
        (
          await contexte().enregistrerBien('bien-lices', {
            dpeClasse: 'C',
            dpeDate: null,
            zoneTendue: null,
          })
        ).ok,
      ).toBe(true);
      const reglages = {
        active: true,
        anniversaire: '2025-10-01',
        trimestre: '2025-T2',
        formeBail: 'classique' as const,
      };
      expect((await contexte().enregistrerRevision('inconnue', reglages)).ok).toBe(false);
      expect((await contexte().enregistrerRevision(LOCATION_JULIE.id, reglages)).ok).toBe(true);
    });
    expect(contexte().donnees?.biens.map((b) => b.dpeClasse)).toEqual(['C']);
    expect(contexte().donnees?.revisions).toHaveLength(1);

    let lettreId = '';
    await act(async () => {
      expect((await contexte().appliquerRevision(LOCATION_JULIE.id, '2027-10-01')).ok).toBe(false);
      const r = await contexte().appliquerRevision(LOCATION_JULIE.id, '2026-10-01');
      lettreId = r.ok ? r.valeur.lettre.id : '';
      // La même lettre, rendue une seconde fois, ne s'ajoute pas deux fois.
      await contexte().appliquerRevision(LOCATION_JULIE.id, '2026-10-01');
    });
    expect(contexte().donnees?.lettres.map((l) => l.id)).toEqual([lettreId]);
    expect(contexte().donnees?.revisions[0]?.derniereRevision).toBe('2026-10-01');
    expect(gestion?.donnees?.locations[0]?.changements).toEqual([
      { aPartirDe: '2026-10', loyerHorsCharges: 65_749, charges: 5_000, apl: 0 },
    ]);
    expect((await contexte().lettre(lettreId)).ok).toBe(true);
  });

  it('migration absente : indisponible ; autre échec : erreur ; sans compte : anonyme', async () => {
    monter(clientBailIndisponible, clientGestionMemoire());
    await statut('indisponible');
    expect(contexte().donnees).toBeNull();
    expect(contexte().erreur).toBe('indisponible');

    monter(clientBailMemoire({ erreurs: { etat: 'reseau' } }), clientGestionMemoire());
    await statut('erreur');
    // Une écriture qui réussit sans état chargé ne fabrique pas d'état.
    await act(async () => {
      const r = await contexte().enregistrerBien('b1', {
        dpeClasse: 'D',
        dpeDate: null,
        zoneTendue: null,
      });
      expect(r.ok).toBe(true);
    });
    expect(contexte().donnees).toBeNull();

    monter(clientBailMemoire(), clientGestionMemoire(), false);
    await statut('anonyme');
    expect(contexte().erreur).toBeNull();
  });

  it('sans fournisseur : rien, et chaque action répond « indisponible »', async () => {
    function Seule(): JSX.Element {
      bail = useBail();
      return <span data-testid="statut">{bail.statut}</span>;
    }
    render(<Seule />);
    expect(screen.getByTestId('statut')).toHaveTextContent('anonyme');
    const indisponible = { ok: false, code: 'indisponible' };
    expect(
      await contexte().enregistrerBien('b', { dpeClasse: null, dpeDate: null, zoneTendue: null }),
    ).toEqual(indisponible);
    expect(
      await contexte().enregistrerRevision('l', {
        active: true,
        anniversaire: '2025-10-01',
        trimestre: '2025-T2',
        formeBail: 'classique',
      }),
    ).toEqual(indisponible);
    expect(await contexte().appliquerRevision('l', '2026-10-01')).toEqual(indisponible);
    expect(await contexte().lettre('x')).toEqual(indisponible);
  });
});
