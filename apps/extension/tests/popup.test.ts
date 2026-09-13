import { captureDepuisHash, type Capture } from '@loupe/capture';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MESSAGE_LECTURE_IMPOSSIBLE } from '../src/logique/popup';
import popupHtml from '../src/popup.html?raw';

const URL_LBC = 'https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851';

const CAPTURE: Capture = {
  version: 1,
  portail: 'leboncoin',
  url: URL_LBC,
  id: '2214738851',
  prix: 155_000,
  surface: 65,
  ville: 'Marseille',
  codePostal: '13005',
  captureLe: '2026-09-13T10:41:00.000Z',
  mode: 'extension',
};

interface Injection {
  readonly target: { readonly tabId: number };
  readonly files?: readonly string[];
  readonly func?: () => unknown;
}

const query = vi.fn<(info: unknown) => Promise<{ id?: number; url?: string }[]>>();
const create = vi.fn<(info: { url: string }) => Promise<unknown>>();
const executeScript = vi.fn<(injection: Injection) => Promise<{ result?: unknown }[]>>();
const fermer = vi.fn();

function chargerPopup(): void {
  const page = new DOMParser().parseFromString(popupHtml, 'text/html');
  document.body.innerHTML = page.body.innerHTML;
}

async function ouvrirPopup(): Promise<{ statut: HTMLElement; bouton: HTMLButtonElement }> {
  await import('../src/popup');
  await vi.waitFor(() => {
    expect(document.getElementById('statut')?.textContent).not.toBe("Lecture de l'onglet…");
  });
  return {
    statut: document.getElementById('statut')!,
    bouton: document.getElementById('analyser') as HTMLButtonElement,
  };
}

async function cliquer(bouton: HTMLButtonElement, statut: HTMLElement): Promise<void> {
  bouton.click();
  await vi.waitFor(() => {
    expect(statut.textContent).not.toBe('Lecture de la page…');
  });
}

beforeEach(() => {
  vi.resetModules();
  query.mockReset();
  create.mockReset();
  executeScript.mockReset();
  fermer.mockReset();
  create.mockResolvedValue({});
  Object.assign(globalThis, {
    chrome: { tabs: { query, create }, scripting: { executeScript } },
  });
  window.close = fermer;
  chargerPopup();
});

afterEach(() => {
  delete (globalThis as { LOUPE_BASE_URL?: string }).LOUPE_BASE_URL;
  delete (globalThis as { __loupeCapture?: unknown }).__loupeCapture;
});

describe('popup · avant le clic', () => {
  it('sans onglet : invite à ouvrir une annonce, bouton inactif, lien vers la production', async () => {
    query.mockResolvedValue([]);
    const { statut, bouton } = await ouvrirPopup();
    expect(statut.textContent).toMatch(/^Ouvrez une annonce/);
    expect(bouton.disabled).toBe(true);
    expect((document.getElementById('ouvrir') as HTMLAnchorElement).href).toBe(
      'https://loupeprojet.pages.dev/',
    );
  });

  it('sur une page qui n’est pas une annonce : explique, bouton inactif', async () => {
    query.mockResolvedValue([{ id: 7, url: 'https://www.leboncoin.fr/recherche?category=9' }]);
    const { statut, bouton } = await ouvrirPopup();
    expect(statut.textContent).toMatch(/pas une annonce/);
    expect(bouton.disabled).toBe(true);
  });

  it('sur une annonce sans identifiant d’onglet : reconnaît, mais ne peut rien injecter', async () => {
    query.mockResolvedValue([{ url: URL_LBC }]);
    const { statut, bouton } = await ouvrirPopup();
    expect(statut.textContent).toMatch(/Annonce leboncoin.fr reconnue/);
    expect(bouton.disabled).toBe(true);
  });

  it('en développement, le lien vise l’adresse injectée par le build', async () => {
    (globalThis as { LOUPE_BASE_URL?: string }).LOUPE_BASE_URL = 'http://localhost:5173';
    query.mockResolvedValue([]);
    await ouvrirPopup();
    expect((document.getElementById('ouvrir') as HTMLAnchorElement).href).toBe(
      'http://localhost:5173/',
    );
  });

  it('refuse de démarrer si le popup n’a pas ses éléments', async () => {
    document.body.innerHTML = '<p>vide</p>';
    await expect(import('../src/popup')).rejects.toThrow(/#statut introuvable/);
  });
});

describe('popup · analyser', () => {
  beforeEach(() => {
    query.mockResolvedValue([{ id: 7, url: URL_LBC }]);
  });

  it('injecte le script, lit la capture rendue et ouvre Loupe avec le fragment', async () => {
    executeScript.mockResolvedValue([{ result: { ok: true, capture: CAPTURE } }]);
    const { statut, bouton } = await ouvrirPopup();
    expect(bouton.disabled).toBe(false);
    await cliquer(bouton, statut);

    expect(executeScript).toHaveBeenCalledTimes(1);
    expect(executeScript.mock.calls[0]?.[0]).toEqual({
      target: { tabId: 7 },
      files: ['contenu.js'],
    });
    expect(statut.textContent).toBe(
      `Lu : 155${String.fromCharCode(0x20_2f)}000 € · 65 m² · Marseille (13005). Ouverture de Loupe…`,
    );
    await vi.waitFor(() => {
      expect(fermer).toHaveBeenCalled();
    });
    const url = new URL(create.mock.calls[0]?.[0].url ?? '');
    expect(`${url.origin}${url.pathname}`).toBe('https://loupeprojet.pages.dev/projets/nouveau');
    expect(captureDepuisHash(url.hash)).toEqual({ ok: true, capture: CAPTURE });
  });

  it('relit le monde isolé quand l’injection ne rend rien (navigateur sans valeur de complétion)', async () => {
    executeScript.mockImplementation((injection) => {
      if (injection.files !== undefined) {
        (globalThis as { __loupeCapture?: unknown }).__loupeCapture = {
          ok: false,
          raison: 'hors-annonce',
        };
        return Promise.resolve([{}]);
      }
      return Promise.resolve([{ result: injection.func?.() }]);
    });
    const { statut, bouton } = await ouvrirPopup();
    await cliquer(bouton, statut);
    expect(executeScript).toHaveBeenCalledTimes(2);
    expect(statut.textContent).toMatch(/pas une annonce/);
    expect(bouton.disabled).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it('explique quand le portail n’a pas de règles', async () => {
    executeScript.mockResolvedValue([{ result: { ok: false, raison: 'portail-sans-regles' } }]);
    const { statut, bouton } = await ouvrirPopup();
    await cliquer(bouton, statut);
    expect(statut.textContent).toMatch(/pas encore de règles/);
    expect(bouton.disabled).toBe(false);
  });

  it('signale une lecture impossible : résultat illisible, ou injection refusée', async () => {
    executeScript.mockResolvedValue([{ result: 'n’importe quoi' }]);
    const premier = await ouvrirPopup();
    await cliquer(premier.bouton, premier.statut);
    expect(premier.statut.textContent).toBe(MESSAGE_LECTURE_IMPOSSIBLE);
    expect(premier.bouton.disabled).toBe(false);

    vi.resetModules();
    chargerPopup();
    executeScript.mockRejectedValue(new Error('Cannot access a chrome:// URL'));
    const second = await ouvrirPopup();
    await cliquer(second.bouton, second.statut);
    expect(second.statut.textContent).toBe(MESSAGE_LECTURE_IMPOSSIBLE);
    expect(second.bouton.disabled).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });
});
