import { projetExemple, ProjetSchema } from '@loupe/moteur';
import type { ProjetEnregistre } from '@loupe/projets';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { clientProjetsReseau, URL_SYNCHRO, type Recuperateur } from '@/stockage/synchro/reseau';

const P1: ProjetEnregistre = {
  id: 'p1',
  nom: 'T2',
  statut: 'analyse',
  creeLe: '2026-09-14T10:00:00.000Z',
  modifieLe: '2026-09-14T10:00:00.000Z',
  projet: ProjetSchema.parse({ ...projetExemple, id: 'p1' }),
};

function repondre(statut: number, corps: unknown): Recuperateur {
  const texte = typeof corps === 'string' ? corps : JSON.stringify(corps);
  return () => Promise.resolve(new Response(texte, { status: statut }));
}

const DEMANDE = { depuis: 0, changements: [] };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('clientProjetsReseau', () => {
  it('envoie la demande en POST JSON et rend la réponse revalidée', async () => {
    const appels: [string, RequestInit | undefined][] = [];
    const client = clientProjetsReseau((url, init) => {
      appels.push([url, init]);
      return Promise.resolve(
        Response.json({ curseur: 1, suite: false, ids: ['p1'], refuses: [], projets: [P1] }),
      );
    });
    const demande = {
      depuis: 3,
      changements: [{ type: 'supprimer' as const, id: 'x', le: P1.creeLe }],
    };
    expect(await client.synchroniser(demande)).toEqual({
      ok: true,
      valeur: { curseur: 1, suite: false, ids: ['p1'], refuses: [], projets: [P1] },
    });
    expect(appels).toHaveLength(1);
    const [url, init] = appels[0]!;
    expect(url).toBe(URL_SYNCHRO);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual(demande);
  });

  it('traduit les erreurs en codes', async () => {
    const cas: [Recuperateur, string][] = [
      [() => Promise.reject(new TypeError('Failed to fetch')), 'reseau'],
      [repondre(401, { code: 'NON_CONNECTE' }), 'non_connecte'],
      [repondre(400, { code: 'CHAMPS_INVALIDES' }), 'invalide'],
      [repondre(413, { code: 'CORPS_TROP_GROS' }), 'invalide'],
      [repondre(503, { code: 'PROJETS_INDISPONIBLE' }), 'indisponible'],
      [repondre(503, { code: 'CONFIGURATION_INCOMPLETE' }), 'indisponible'],
      [repondre(502, 'Bad gateway'), 'indisponible'],
      [repondre(404, '<!doctype html>'), 'inconnue'],
      [repondre(200, { curseur: 'x' }), 'inconnue'],
      [repondre(200, 'pas du json'), 'inconnue'],
    ];
    for (const [recuperer, code] of cas) {
      expect(await clientProjetsReseau(recuperer).synchroniser(DEMANDE)).toEqual({
        ok: false,
        code,
      });
    }
  });

  it('utilise fetch par défaut', async () => {
    const faux = vi.fn(() => Promise.resolve(new Response('{}', { status: 500 })));
    vi.stubGlobal('fetch', faux);
    expect(await clientProjetsReseau().synchroniser(DEMANDE)).toEqual({
      ok: false,
      code: 'indisponible',
    });
    expect(faux).toHaveBeenCalledOnce();
  });
});
