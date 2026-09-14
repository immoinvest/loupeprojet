// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://www.bienici.com/annonce/vente/marseille-5e/appartement/3pieces/ag13-123456" }
import { afterEach, describe, expect, it, vi } from 'vitest';

import bieniciDonnees from './fixtures/bienici.json';
import bienici from './fixtures/bienici.html?raw';

interface MondeIsole {
  __loupeCapture?: unknown;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('script de contenu · portail qui charge ses données (Bien’ici)', () => {
  it('charge les données de l’annonce sur le portail même, avec les cookies du visiteur', async () => {
    const recuperer = vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(bieniciDonnees) }),
    );
    vi.stubGlobal('fetch', recuperer);
    document.documentElement.innerHTML = new DOMParser().parseFromString(
      bienici,
      'text/html',
    ).documentElement.innerHTML;

    await import('../src/contenu');

    expect(await (globalThis as MondeIsole).__loupeCapture).toMatchObject({
      ok: true,
      capture: { portail: 'bienici', prix: 155_000, chargesCopro: 90, lotsCopro: 24 },
    });
    expect(recuperer).toHaveBeenCalledWith(
      'https://www.bienici.com/realEstateAd.json?id=ag13-123456',
      { credentials: 'include', headers: { accept: 'application/json' } },
    );
  });
});
