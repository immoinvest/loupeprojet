import type { Envoi } from '@loupe/gestion';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { actionsAFaire, cleAction } from '@/gestion/a-faire';
import { stockageLocal } from '@/gestion/envois/logique';
import { clientAccordReseau, clientEnvoisReseau } from '@/gestion/envois/reseau';
import { traceEnvoi } from '@/textes/gerer-envois';

import { JETON } from './envois-exemples';
import { ETAT_SEPTEMBRE } from './gestion-exemples';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('compléments des envois', () => {
  it('un stockage bloqué par le navigateur donne `undefined`', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('stockage bloqué');
    });
    expect(stockageLocal()).toBeUndefined();
  });

  it('les clients réseau utilisent `fetch` par défaut', async () => {
    const recuperer = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ statut: 'refuse' }), { status: 200 })),
    );
    vi.stubGlobal('fetch', recuperer);
    expect(await clientAccordReseau().repondre(JETON, 'refuse')).toEqual({
      ok: true,
      valeur: { statut: 'refuse' },
    });
    expect(await clientEnvoisReseau().renvoyer('d')).toEqual({ ok: false, code: 'inconnue' });
    expect(recuperer).toHaveBeenCalledTimes(2);
  });

  it('une trace sans date d’envoi reprend la date du dernier essai', () => {
    const envoi: Envoi = {
      id: 'e',
      documentId: 'd',
      locataireId: 'l',
      destinataire: 'julie@…',
      statut: 'envoye',
      tentatives: 1,
      dernierEssaiLe: '2026-10-06T08:00:00.000Z',
    };
    expect(traceEnvoi(envoi)).toBe('Envoyée le 06/10 à julie@…');
  });

  it('« À faire » : l’adresse à vérifier après les retards, l’accord en attente en dernier', () => {
    const actions = actionsAFaire(ETAT_SEPTEMBRE, '2026-09-14', [], {
      enAttente: ['locataire-julie', 'inconnu'],
      aVerifier: ['locataire-antoine'],
    });
    expect(actions.map(cleAction)).toEqual([
      'retard-location-antoine',
      'email-a-verifier-locataire-antoine',
      'email-locataire-antoine',
      'accord-locataire-julie',
    ]);
  });
});
