import { afterEach, describe, expect, it, vi } from 'vitest';

import { clientBailReseau } from '@/gestion/bail/reseau';
import type { Recuperateur } from '@/gestion/reseau';

import { lettreJulie, REVISION_JULIE } from './bail-exemples';
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

const JSON_ENTETES = { 'Content-Type': 'application/json' };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('clientBailReseau', () => {
  it('lit l’état, enregistre le DPE et les réglages, applique, relit une lettre ; identifiants encodés', async () => {
    const etat = { biens: [], revisions: [REVISION_JULIE], lettres: [] };
    const legal = {
      bienId: 'b/1',
      dpeClasse: 'D',
      dpeDate: null,
      zoneTendue: false,
      modifieLe: 'x',
    };
    const lettre = lettreJulie();
    const appliquee = { lettre, revision: REVISION_JULIE, location: LOCATION_JULIE };
    const reponses = [etat, legal, REVISION_JULIE, appliquee, lettre];
    const { recuperer, appels } = serveur(() => json(200, reponses.shift()));
    const client = clientBailReseau(recuperer);

    expect(await client.etat()).toEqual({ ok: true, valeur: etat });
    const saisieLegal = { dpeClasse: 'D' as const, dpeDate: null, zoneTendue: false };
    expect((await client.enregistrerBien('b/1', saisieLegal)).ok).toBe(true);
    const saisie = {
      active: true,
      anniversaire: '2025-10-01',
      trimestre: '2025-T2',
      formeBail: 'classique' as const,
    };
    expect((await client.enregistrerRevision('l/1', saisie)).ok).toBe(true);
    expect(await client.appliquerRevision('l/1', '2026-10-01')).toEqual({
      ok: true,
      valeur: appliquee,
    });
    expect(await client.lettre('v/1')).toEqual({ ok: true, valeur: lettre });

    expect(appels).toEqual([
      { url: '/api/gestion/bail', init: { method: 'GET' } },
      {
        url: '/api/gestion/bail/biens/b%2F1',
        init: { method: 'PUT', headers: JSON_ENTETES, body: JSON.stringify(saisieLegal) },
      },
      {
        url: '/api/gestion/bail/locations/l%2F1/revision',
        init: { method: 'PUT', headers: JSON_ENTETES, body: JSON.stringify(saisie) },
      },
      {
        url: '/api/gestion/bail/locations/l%2F1/revision/appliquer',
        init: {
          method: 'POST',
          headers: JSON_ENTETES,
          body: JSON.stringify({ anniversaire: '2026-10-01' }),
        },
      },
      { url: '/api/gestion/bail/lettres/v%2F1', init: { method: 'GET' } },
    ]);
  });

  it('codes : migration absente, révision refusée, panne, page inconnue, réponse invalide, réseau coupé', async () => {
    const cas: [Response, string][] = [
      [json(503, { code: 'BAIL_INDISPONIBLE' }), 'indisponible'],
      [json(503, { code: 'GESTION_INDISPONIBLE' }), 'indisponible'],
      [json(409, { code: 'REVISION_IMPOSSIBLE' }), 'revision_impossible'],
      [json(409, { code: 'BAILLEUR_MANQUANT' }), 'bailleur_manquant'],
      [json(409, { code: 'PERIODE_PAYEE' }), 'periode_payee'],
      [json(400, { code: 'HORS_LOCATION' }), 'hors_location'],
      [json(409, { code: 'LIMITE_ATTEINTE' }), 'limite'],
      [json(404, { code: 'INTROUVABLE' }), 'introuvable'],
      [json(400, { code: 'CHAMPS_INVALIDES' }), 'invalide'],
      [json(413, { code: 'CORPS_TROP_GROS' }), 'invalide'],
      [json(401, { code: 'NON_CONNECTE' }), 'non_connecte'],
      [new Response('<html>', { status: 500 }), 'indisponible'],
      [new Response('<html>', { status: 404 }), 'inconnue'],
      [json(200, { biens: 'abîmé' }), 'inconnue'],
    ];
    for (const [reponse, code] of cas) {
      const { recuperer } = serveur(() => reponse);
      expect(await clientBailReseau(recuperer).etat()).toEqual({ ok: false, code });
    }
    const coupe = clientBailReseau(() => Promise.reject(new Error('hors ligne')));
    expect(await coupe.lettre('x')).toEqual({ ok: false, code: 'reseau' });
  });

  it('sans récupérateur fourni : fetch global', async () => {
    const fetchSimule = vi.fn(() =>
      Promise.resolve(json(200, { biens: [], revisions: [], lettres: [] })),
    );
    vi.stubGlobal('fetch', fetchSimule);
    expect((await clientBailReseau().etat()).ok).toBe(true);
    expect(fetchSimule).toHaveBeenCalledWith('/api/gestion/bail', { method: 'GET' });
  });
});
