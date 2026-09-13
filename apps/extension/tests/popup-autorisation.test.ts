import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MESSAGE_AUTORISEE, ORIGINES_PORTAILS } from '../src/logique/popup';
import popupHtml from '../src/popup.html?raw';

const contains = vi.fn<(info: { origins: string[] }) => Promise<boolean>>();
const request = vi.fn<(info: { origins: string[] }) => Promise<boolean>>();

beforeEach(() => {
  vi.resetModules();
  contains.mockReset();
  request.mockReset();
  Object.assign(globalThis, {
    chrome: {
      tabs: { query: () => Promise.resolve([]), create: vi.fn() },
      scripting: { executeScript: vi.fn() },
      permissions: { contains, request },
    },
  });
  document.body.innerHTML = new DOMParser().parseFromString(popupHtml, 'text/html').body.innerHTML;
});

afterEach(() => {
  document.body.innerHTML = '';
});

async function ouvrir(): Promise<HTMLButtonElement> {
  await import('../src/popup');
  await vi.waitFor(() => {
    expect(document.getElementById('statut')?.textContent).toMatch(/^Ouvrez une annonce/);
  });
  return document.getElementById('autoriser') as HTMLButtonElement;
}

describe('popup · autorisation de la lecture automatique', () => {
  it('cache le bouton quand les cinq portails sont déjà autorisés', async () => {
    contains.mockResolvedValue(true);
    const bouton = await ouvrir();
    expect(bouton.hidden).toBe(true);
    expect(contains).toHaveBeenCalledWith({ origins: [...ORIGINES_PORTAILS] });
    expect(ORIGINES_PORTAILS).toHaveLength(5);
  });

  it('propose le bouton sinon ; l’accord le cache et le confirme, le refus le laisse', async () => {
    contains.mockResolvedValue(false);
    const bouton = await ouvrir();
    expect(bouton.hidden).toBe(false);

    request.mockResolvedValue(false);
    bouton.click();
    await vi.waitFor(() => {
      expect(request).toHaveBeenCalledTimes(1);
    });
    expect(bouton.hidden).toBe(false);

    request.mockResolvedValue(true);
    bouton.click();
    await vi.waitFor(() => {
      expect(document.getElementById('statut')?.textContent).toBe(MESSAGE_AUTORISEE);
    });
    expect(bouton.hidden).toBe(true);
  });
});
