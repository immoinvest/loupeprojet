// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851?utm_source=partage" }
import { describe, expect, it } from 'vitest';

import leboncoin from './fixtures/leboncoin.html?raw';

interface MondeIsole {
  __loupeCapture?: unknown;
}

describe('script de contenu', () => {
  it('lit la page ouverte et dépose le résultat dans le monde isolé, sans toucher à la page', async () => {
    const page = new DOMParser().parseFromString(leboncoin, 'text/html');
    document.documentElement.innerHTML = page.documentElement.innerHTML;
    const avant = document.documentElement.innerHTML;

    await import('../src/contenu');

    expect((globalThis as MondeIsole).__loupeCapture).toMatchObject({
      ok: true,
      capture: {
        portail: 'leboncoin',
        id: '2214738851',
        url: 'https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851',
        prix: 155_000,
        surface: 65,
        mode: 'extension',
      },
    });
    expect(document.documentElement.innerHTML).toBe(avant);
  });
});
