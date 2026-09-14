import { afterEach, describe, expect, it, vi } from 'vitest';

import { clientGestionReseau, type Recuperateur } from '@/gestion/reseau';

import { CREATION_LOUEE, ETAT_SEPTEMBRE, PAIEMENT_JULIE } from './gestion-exemples';

interface Appel {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

function json(statut: number, corps: unknown): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'Content-Type': 'application/json' },
  });
}

function serveur(reponse: () => Response | Promise<Response>): {
  recuperer: Recuperateur;
  appels: Appel[];
} {
  const appels: Appel[] = [];
  return {
    appels,
    recuperer: (url, init) => {
      appels.push({ url, init });
      return Promise.resolve(reponse());
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('clientGestionReseau', () => {
  it('lit l’état par GET /api/gestion/etat, sans corps, et le revalide', async () => {
    const { recuperer, appels } = serveur(() => json(200, ETAT_SEPTEMBRE));
    const r = await clientGestionReseau(recuperer).etat();
    expect(r).toEqual({ ok: true, valeur: ETAT_SEPTEMBRE });
    expect(appels).toEqual([{ url: '/api/gestion/etat', init: { method: 'GET' } }]);
  });

  it('crée, paie et enregistre le menu avec un corps JSON', async () => {
    const reponse = {
      bien: { ...ETAT_SEPTEMBRE.biens[0], id: 'b9' },
      locataire: null,
      location: null,
    };
    const creation = serveur(() => json(201, reponse));
    expect(await clientGestionReseau(creation.recuperer).creer(CREATION_LOUEE)).toEqual({
      ok: true,
      valeur: reponse,
    });
    expect(creation.appels[0]).toEqual({
      url: '/api/gestion/locations',
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(CREATION_LOUEE),
      },
    });

    const paiement = serveur(() => json(201, PAIEMENT_JULIE));
    const nouveau = {
      locationId: 'location-julie',
      periode: '2026-09',
      montant: 70_000,
      date: '2026-09-05',
    };
    expect(await clientGestionReseau(paiement.recuperer).payer(nouveau)).toEqual({
      ok: true,
      valeur: PAIEMENT_JULIE,
    });
    expect(paiement.appels[0]?.url).toBe('/api/gestion/paiements');

    const menu = serveur(() => json(200, { analyser: false, gerer: true }));
    const prefs = await clientGestionReseau(menu.recuperer).enregistrerPreferences({
      analyser: false,
      gerer: true,
    });
    expect(prefs).toEqual({ ok: true, valeur: { analyser: false, gerer: true } });
    expect(menu.appels[0]?.init?.method).toBe('PUT');
  });

  it('annule un paiement par DELETE, identifiant encodé, réponse 204 sans corps', async () => {
    const { recuperer, appels } = serveur(() => new Response(null, { status: 204 }));
    expect(await clientGestionReseau(recuperer).annulerPaiement('p/1 ?')).toEqual({
      ok: true,
      valeur: undefined,
    });
    expect(appels[0]).toEqual({
      url: '/api/gestion/paiements/p%2F1%20%3F',
      init: { method: 'DELETE' },
    });
  });

  it.each([
    [401, 'NON_CONNECTE', 'non_connecte'],
    [400, 'CHAMPS_INVALIDES', 'invalide'],
    [413, 'CORPS_TROP_GROS', 'invalide'],
    [404, 'INTROUVABLE', 'introuvable'],
    [409, 'PERIODE_DEJA_RECUE', 'deja_recu'],
    [503, 'GESTION_INDISPONIBLE', 'indisponible'],
    [403, 'ORIGINE_INCONNUE', 'inconnue'],
    [500, 'ERREUR_INTERNE', 'indisponible'],
  ] as const)('HTTP %i %s → %s', async (statut, code, attendu) => {
    const { recuperer } = serveur(() => json(statut, { code }));
    expect(await clientGestionReseau(recuperer).etat()).toEqual({ ok: false, code: attendu });
  });

  it('une réponse illisible : inconnue sous 500, indisponible au-delà', async () => {
    const page = (statut: number): Response =>
      new Response('<!doctype html>', { status: statut, headers: { 'Content-Type': 'text/html' } });
    expect(await clientGestionReseau(serveur(() => page(418)).recuperer).etat()).toEqual({
      ok: false,
      code: 'inconnue',
    });
    expect(await clientGestionReseau(serveur(() => page(502)).recuperer).etat()).toEqual({
      ok: false,
      code: 'indisponible',
    });
    // Site servi sans l'API : la page d'accueil en 200 à la place du JSON.
    expect(await clientGestionReseau(serveur(() => page(200)).recuperer).etat()).toEqual({
      ok: false,
      code: 'inconnue',
    });
  });

  it('réseau coupé : reseau', async () => {
    const recuperer: Recuperateur = () => Promise.reject(new TypeError('Failed to fetch'));
    expect(await clientGestionReseau(recuperer).etat()).toEqual({ ok: false, code: 'reseau' });
  });

  it('utilise fetch par défaut', async () => {
    const faux = vi.fn(() => Promise.resolve(json(200, ETAT_SEPTEMBRE)));
    vi.stubGlobal('fetch', faux);
    expect((await clientGestionReseau().etat()).ok).toBe(true);
    expect(faux).toHaveBeenCalledWith('/api/gestion/etat', { method: 'GET' });
  });
});
