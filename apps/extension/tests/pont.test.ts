import { SOURCE_EXTENSION, SOURCE_WEB } from '@loupe/capture';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type * as ModulePont from '../src/pont';

const envoyerAuService = vi.fn<(demande: unknown) => Promise<unknown>>();
let module: typeof ModulePont;

beforeAll(async () => {
  Object.assign(globalThis, { chrome: { runtime: { sendMessage: envoyerAuService } } });
  module = await import('../src/pont');
});

afterEach(() => {
  vi.restoreAllMocks();
  envoyerAuService.mockReset();
});

const URL_PAP = 'https://www.pap.fr/annonces/appartement-marseille-13005-r456789012';
const CAPTURE = {
  version: 1,
  portail: 'pap',
  url: URL_PAP,
  captureLe: '2026-09-13T10:41:00.000Z',
  prix: 155_000,
};

function evenement(
  data: unknown,
  surcharge: Partial<{ origin: string; source: unknown }> = {},
): { data: unknown; origin: string; source: unknown } {
  return { data, origin: window.location.origin, source: window, ...surcharge };
}

describe('traiterMessage', () => {
  it('répond au ping de la page Deklic', async () => {
    const poster = vi.spyOn(window, 'postMessage').mockImplementation(() => undefined);
    await module.traiterMessage(
      evenement({ source: SOURCE_WEB, type: 'ping', id: 'p1' }),
      window,
      envoyerAuService,
    );
    expect(poster).toHaveBeenCalledWith(
      { source: SOURCE_EXTENSION, type: 'pong', id: 'p1', version: 1 },
      window.location.origin,
    );
  });

  it('ignore ce qui ne vient pas de la page elle-même ou n’est pas un message Deklic', async () => {
    const poster = vi.spyOn(window, 'postMessage').mockImplementation(() => undefined);
    const ping = { source: SOURCE_WEB, type: 'ping', id: 'p1' };
    await module.traiterMessage(evenement(ping, { source: {} }), window, envoyerAuService);
    await module.traiterMessage(
      evenement(ping, { origin: 'https://pirate.example' }),
      window,
      envoyerAuService,
    );
    await module.traiterMessage(evenement({ type: 'ping' }), window, envoyerAuService);
    expect(poster).not.toHaveBeenCalled();
    expect(envoyerAuService).not.toHaveBeenCalled();
  });

  it('relaie une demande de lecture et renvoie le résultat validé', async () => {
    const poster = vi.spyOn(window, 'postMessage').mockImplementation(() => undefined);
    envoyerAuService.mockResolvedValue({ ok: true, capture: CAPTURE });
    await module.traiterMessage(
      evenement({ source: SOURCE_WEB, type: 'lire', id: 'l1', url: URL_PAP }),
      window,
      envoyerAuService,
    );
    expect(envoyerAuService).toHaveBeenCalledWith({ type: 'deklic-lire', url: URL_PAP });
    expect(poster).toHaveBeenCalledWith(
      {
        source: SOURCE_EXTENSION,
        type: 'resultat',
        id: 'l1',
        resultat: { ok: true, capture: CAPTURE },
      },
      window.location.origin,
    );
  });

  it('renvoie un échec de chargement si le service répond n’importe quoi ou ne répond pas', async () => {
    const poster = vi.spyOn(window, 'postMessage').mockImplementation(() => undefined);
    const lire = { source: SOURCE_WEB, type: 'lire', id: 'l2', url: URL_PAP };
    envoyerAuService.mockResolvedValue('bizarre');
    await module.traiterMessage(evenement(lire), window, envoyerAuService);
    envoyerAuService.mockRejectedValue(new Error('Receiving end does not exist'));
    await module.traiterMessage(evenement(lire), window, envoyerAuService);
    const echec = {
      source: SOURCE_EXTENSION,
      type: 'resultat',
      id: 'l2',
      resultat: { ok: false, raison: 'chargement' },
    };
    expect(poster).toHaveBeenNthCalledWith(1, echec, window.location.origin);
    expect(poster).toHaveBeenNthCalledWith(2, echec, window.location.origin);
  });
});

describe('pont installé sur la page', () => {
  it('écoute les messages de la page et relaie les lectures vers le service de l’extension', async () => {
    const poster = vi.spyOn(window, 'postMessage').mockImplementation(() => undefined);
    envoyerAuService.mockResolvedValue({ ok: false, raison: 'vide' });
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { source: SOURCE_WEB, type: 'lire', id: 'l3', url: URL_PAP },
        origin: window.location.origin,
        source: window,
      }),
    );
    await vi.waitFor(() => {
      expect(poster).toHaveBeenCalledWith(
        {
          source: SOURCE_EXTENSION,
          type: 'resultat',
          id: 'l3',
          resultat: { ok: false, raison: 'vide' },
        },
        window.location.origin,
      );
    });
    expect(envoyerAuService).toHaveBeenCalledWith({ type: 'deklic-lire', url: URL_PAP });
  });
});
