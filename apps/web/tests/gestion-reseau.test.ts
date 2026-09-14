import { afterEach, describe, expect, it, vi } from 'vitest';

import { clientGestionMemoire } from '@/gestion/memoire';
import { clientGestionReseau, type Recuperateur } from '@/gestion/reseau';
import { ERREURS_GESTION } from '@/textes/gerer';

import {
  BAILLEUR,
  CREATION_LOUEE,
  ETAT_SEPTEMBRE,
  LOCATION_JULIE,
  PAIEMENT_JULIE,
} from './gestion-exemples';

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
      colocataires: [],
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

  it('termine une location par POST, identifiant encodé, et revalide la location rendue', async () => {
    const terminee = { ...LOCATION_JULIE, fin: '2026-12-31' };
    const { recuperer, appels } = serveur(() => json(200, terminee));
    expect(await clientGestionReseau(recuperer).terminerLocation('l/1', '2026-12-31')).toEqual({
      ok: true,
      valeur: terminee,
    });
    expect(appels[0]).toEqual({
      url: '/api/gestion/locations/l%2F1/fin',
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fin: '2026-12-31' }),
      },
    });
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

  it('identité du bailleur par PUT, documents par POST puis GET, identifiant encodé', async () => {
    const bailleur = serveur(() => json(200, BAILLEUR));
    expect(await clientGestionReseau(bailleur.recuperer).enregistrerBailleur(BAILLEUR)).toEqual({
      ok: true,
      valeur: BAILLEUR,
    });
    expect(bailleur.appels[0]).toEqual({
      url: '/api/gestion/bailleur',
      init: {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(BAILLEUR),
      },
    });

    const demande = {
      type: 'quittance',
      locationId: 'location-julie',
      periode: '2026-09',
    } as const;
    const emise = await clientGestionMemoire({
      etat: { ...ETAT_SEPTEMBRE, bailleur: BAILLEUR },
    }).emettreDocument(demande);
    if (!emise.ok) throw new Error(emise.code);
    const quittance = emise.valeur;

    const emission = serveur(() => json(201, quittance));
    expect(await clientGestionReseau(emission.recuperer).emettreDocument(demande)).toEqual({
      ok: true,
      valeur: quittance,
    });
    expect(emission.appels[0]?.url).toBe('/api/gestion/documents');
    expect(emission.appels[0]?.init?.body).toBe(JSON.stringify(demande));

    const lecture = serveur(() => json(200, quittance));
    expect(await clientGestionReseau(lecture.recuperer).document('d/1')).toEqual({
      ok: true,
      valeur: quittance,
    });
    expect(lecture.appels[0]).toEqual({
      url: '/api/gestion/documents/d%2F1',
      init: { method: 'GET' },
    });
  });

  it.each([
    [401, 'NON_CONNECTE', 'non_connecte'],
    [400, 'CHAMPS_INVALIDES', 'invalide'],
    [413, 'CORPS_TROP_GROS', 'invalide'],
    [404, 'INTROUVABLE', 'introuvable'],
    [400, 'HORS_LOCATION', 'invalide'],
    [409, 'MONTANT_DEPASSE', 'montant_depasse'],
    [400, 'DATE_INVALIDE', 'date_invalide'],
    [409, 'DOCUMENT_EMIS', 'document_emis'],
    [409, 'BAILLEUR_MANQUANT', 'bailleur_manquant'],
    [409, 'LOYER_NON_REGLE', 'loyer_non_regle'],
    [409, 'LOYER_REGLE', 'loyer_regle'],
    [409, 'BIEN_OCCUPE', 'bien_occupe'],
    [400, 'FIN_AVANT_ENTREE', 'fin_avant_entree'],
    [409, 'PAIEMENTS_APRES_SORTIE', 'paiements_apres_sortie'],
    // Le code de G1a a disparu du serveur : il n'est plus reconnu.
    [409, 'PERIODE_DEJA_RECUE', 'inconnue'],
    [409, 'LIMITE_ATTEINTE', 'limite'],
    [503, 'GESTION_INDISPONIBLE', 'indisponible'],
    [403, 'ORIGINE_INCONNUE', 'inconnue'],
    [500, 'ERREUR_INTERNE', 'indisponible'],
  ] as const)('HTTP %i %s → %s', async (statut, code, attendu) => {
    const { recuperer } = serveur(() => json(statut, { code }));
    expect(await clientGestionReseau(recuperer).etat()).toEqual({ ok: false, code: attendu });
  });

  it('la limite de biens a sa propre phrase, qui dit le nombre', () => {
    expect(ERREURS_GESTION.limite).toBe('Ce compte a atteint le nombre maximal de biens (200).');
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
