import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ModuleArrierePlan from '../src/arriere-plan';

type Ecouteur = (id: number, changement: { status?: string }) => void;
type EcouteurMessage = (
  message: unknown,
  expediteur: { id?: string; tab?: { id?: number; windowId?: number; index?: number } },
  repondre: (reponse: unknown) => void,
) => boolean;

const ecouteursOnglets: Ecouteur[] = [];
const ecouteursMessages: EcouteurMessage[] = [];

const faux = {
  tabs: {
    onUpdated: {
      addListener: vi.fn((e: Ecouteur) => ecouteursOnglets.push(e)),
      removeListener: vi.fn(),
    },
    get: vi.fn<(id: number) => Promise<{ status?: string }>>(),
    create: vi.fn<(info: unknown) => Promise<{ id?: number }>>(),
    update: vi.fn<(id: number, info: unknown) => Promise<unknown>>(),
    remove: vi.fn<(id: number) => Promise<void>>(),
  },
  scripting: { executeScript: vi.fn<(info: unknown) => Promise<{ result?: unknown }[]>>() },
  permissions: { contains: vi.fn<(info: unknown) => Promise<boolean>>() },
  runtime: {
    id: 'deklic',
    onMessage: { addListener: vi.fn((e: EcouteurMessage) => ecouteursMessages.push(e)) },
  },
};

let module: typeof ModuleArrierePlan;

beforeAll(async () => {
  Object.assign(globalThis, { chrome: faux });
  module = await import('../src/arriere-plan');
});

beforeEach(() => {
  ecouteursOnglets.length = 0;
  faux.tabs.onUpdated.removeListener.mockClear();
});

describe('DemandeLectureSchema', () => {
  it('n’accepte que les demandes de lecture bien formées', () => {
    const { DemandeLectureSchema } = module;
    expect(
      DemandeLectureSchema.safeParse({ type: 'deklic-lire', url: 'https://www.pap.fr/a' }).success,
    ).toBe(true);
    expect(
      DemandeLectureSchema.safeParse({ type: 'autre', url: 'https://www.pap.fr/a' }).success,
    ).toBe(false);
    expect(
      DemandeLectureSchema.safeParse({ type: 'deklic-lire', url: 'pas une url' }).success,
    ).toBe(false);
  });
});

describe('attendreChargement', () => {
  it('résout tout de suite si l’onglet est déjà chargé', async () => {
    faux.tabs.get.mockResolvedValue({ status: 'complete' });
    expect(await module.attendreChargement(3, 1_000)).toBe(true);
    expect(faux.tabs.onUpdated.removeListener).toHaveBeenCalled();
  });

  it('attend la fin du chargement de cet onglet et ignore les autres', async () => {
    faux.tabs.get.mockResolvedValue({ status: 'loading' });
    const attente = module.attendreChargement(3, 1_000);
    await vi.waitFor(() => {
      expect(ecouteursOnglets).toHaveLength(1);
    });
    const ecouteur = ecouteursOnglets[0]!;
    ecouteur(9, { status: 'complete' });
    ecouteur(3, { status: 'loading' });
    ecouteur(3, { status: 'complete' });
    expect(await attente).toBe(true);
    ecouteur(3, { status: 'complete' });
  });

  it('abandonne au bout du délai, ou si l’onglet n’existe plus', async () => {
    faux.tabs.get.mockResolvedValue({ status: 'loading' });
    expect(await module.attendreChargement(3, 5)).toBe(false);
    faux.tabs.get.mockRejectedValue(new Error('No tab with id'));
    expect(await module.attendreChargement(3, 1_000)).toBe(false);
  });
});

describe('NAVIGATEUR', () => {
  it('vérifie l’autorisation du portail', async () => {
    faux.permissions.contains.mockResolvedValue(true);
    expect(await module.NAVIGATEUR.permis('bienici')).toBe(true);
    expect(faux.permissions.contains).toHaveBeenCalledWith({ origins: ['*://*.bienici.com/*'] });
  });

  it('ouvre un onglet caché juste à côté de Deklic, ou simplement caché sans origine', async () => {
    faux.tabs.create.mockResolvedValue({ id: 42 });
    expect(
      await module.NAVIGATEUR.ouvrir('https://www.pap.fr/a', { tabId: 7, windowId: 1, index: 2 }),
    ).toBe(42);
    expect(faux.tabs.create).toHaveBeenLastCalledWith({
      url: 'https://www.pap.fr/a',
      active: false,
      windowId: 1,
      index: 3,
      openerTabId: 7,
    });
    await module.NAVIGATEUR.ouvrir('https://www.pap.fr/a', {});
    expect(faux.tabs.create).toHaveBeenLastCalledWith({
      url: 'https://www.pap.fr/a',
      active: false,
    });
    faux.tabs.create.mockResolvedValue({});
    await expect(module.NAVIGATEUR.ouvrir('https://www.pap.fr/a', {})).rejects.toThrow(
      /identifiant/,
    );
  });

  it('injecte le script de contenu et rend sa valeur', async () => {
    faux.scripting.executeScript.mockResolvedValue([{ result: { ok: true } }]);
    expect(await module.NAVIGATEUR.lire(42)).toEqual({ ok: true });
    expect(faux.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 42 },
      files: ['contenu.js'],
    });
    faux.scripting.executeScript.mockResolvedValue([]);
    expect(await module.NAVIGATEUR.lire(42)).toBeUndefined();
  });

  it('affiche, ferme, revient sur Deklic et patiente, sans lever si l’onglet a disparu', async () => {
    faux.tabs.update.mockResolvedValue({});
    await module.NAVIGATEUR.afficher(42);
    expect(faux.tabs.update).toHaveBeenLastCalledWith(42, { active: true });

    faux.tabs.remove.mockRejectedValue(new Error('No tab'));
    await expect(module.NAVIGATEUR.fermer(42)).resolves.toBeUndefined();

    faux.tabs.update.mockClear();
    await module.NAVIGATEUR.revenir({});
    expect(faux.tabs.update).not.toHaveBeenCalled();
    faux.tabs.update.mockRejectedValue(new Error('No tab'));
    await expect(module.NAVIGATEUR.revenir({ tabId: 7 })).resolves.toBeUndefined();
    expect(faux.tabs.update).toHaveBeenLastCalledWith(7, { active: true });

    await expect(module.NAVIGATEUR.dormir(1)).resolves.toBeUndefined();
  });
});

describe('ecouterDemandes', () => {
  it('le service branche l’écoute dès son chargement', () => {
    expect(ecouteursMessages.length).toBeGreaterThanOrEqual(1);
  });

  it('traite les demandes de cette extension et ignore les autres', async () => {
    const lire = vi.fn(() => Promise.resolve({ ok: false, raison: 'vide' }));
    module.ecouterDemandes(lire);
    const ecouteur = ecouteursMessages.at(-1)!;
    const repondre = vi.fn();
    const demande = {
      type: 'deklic-lire',
      url: 'https://www.pap.fr/annonces/appartement-r456789012',
    };

    expect(ecouteur({ type: 'autre' }, { id: 'deklic' }, repondre)).toBe(false);
    expect(ecouteur(demande, { id: 'une-autre-extension' }, repondre)).toBe(false);
    expect(
      ecouteur(demande, { id: 'deklic', tab: { id: 7, windowId: 1, index: 2 } }, repondre),
    ).toBe(true);
    await vi.waitFor(() => {
      expect(repondre).toHaveBeenCalledWith({ ok: false, raison: 'vide' });
    });
    expect(lire).toHaveBeenCalledWith(demande.url, { tabId: 7, windowId: 1, index: 2 });

    expect(ecouteur(demande, { id: 'deklic' }, repondre)).toBe(true);
    expect(lire).toHaveBeenLastCalledWith(demande.url, {
      tabId: undefined,
      windowId: undefined,
      index: undefined,
    });
  });
});
