import { describe, expect, it } from 'vitest';

import { clientGestionReseau, type Recuperateur } from '@/gestion/reseau';

import { LOCATION_JULIE } from './gestion-exemples';

interface Appel {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

function serveur(reponse: () => Response): { recuperer: Recuperateur; appels: Appel[] } {
  const appels: Appel[] = [];
  return {
    appels,
    recuperer: (url, init) => {
      appels.push({ url, init });
      return Promise.resolve(reponse());
    },
  };
}

function json(statut: number, corps: unknown): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('clientGestionReseau : modifier une location, supprimer un bien', () => {
  it('modifie par PATCH, identifiant encodé, et revalide la location rendue', async () => {
    const { recuperer, appels } = serveur(() => json(200, LOCATION_JULIE));
    const modification = { jourLoyer: 10 };
    expect(await clientGestionReseau(recuperer).modifierLocation('loc/1', modification)).toEqual({
      ok: true,
      valeur: LOCATION_JULIE,
    });
    expect(appels).toEqual([
      {
        url: '/api/gestion/locations/loc%2F1',
        init: {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(modification),
        },
      },
    ]);
  });

  it('supprime par DELETE, identifiant encodé, réponse 204 sans corps', async () => {
    const { recuperer, appels } = serveur(() => new Response(null, { status: 204 }));
    expect(await clientGestionReseau(recuperer).supprimerBien('bien/1')).toEqual({
      ok: true,
      valeur: undefined,
    });
    expect(appels).toEqual([{ url: '/api/gestion/biens/bien%2F1', init: { method: 'DELETE' } }]);
  });

  it('un mois déjà payé : periode_payee', async () => {
    const { recuperer } = serveur(() => json(409, { code: 'PERIODE_PAYEE' }));
    expect(await clientGestionReseau(recuperer).modifierLocation('l1', { depot: 0 })).toEqual({
      ok: false,
      code: 'periode_payee',
    });
  });
});
