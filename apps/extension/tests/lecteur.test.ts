import { creerRegistre, type Capture } from '@loupe/capture';
import { describe, expect, it, vi } from 'vitest';

import {
  REGLAGES,
  creerLecteur,
  suffisante,
  type Navigateur,
  type Reglages,
} from '../src/logique/lecteur';
import { REGISTRE } from '../src/regles';

const URL_PAP = 'https://www.pap.fr/annonces/appartement-marseille-13005-r456789012?utm_source=x';
const URL_CANONIQUE = 'https://www.pap.fr/annonces/appartement-marseille-13005-r456789012';
const ORIGINE = { tabId: 7, windowId: 1, index: 2 };
const RAPIDE: Reglages = { chargementMs: 10, essaisCaches: 2, essaisAffiches: 3, pauseMs: 1 };

const BASE: Capture = {
  version: 1,
  portail: 'pap',
  url: URL_CANONIQUE,
  captureLe: '2026-09-13T10:41:00.000Z',
};
const COMPLETE: Capture = { ...BASE, prix: 155_000, surface: 65, pieces: 3 };
const PARTIELLE: Capture = { ...BASE, prix: 155_000 };
const PARTIELLE_RICHE: Capture = { ...BASE, prix: 155_000, pieces: 3, ville: 'Marseille' };

const lue = (capture: Capture): unknown => ({ ok: true, capture });

function navigateur(lectures: unknown[], surcharge: Partial<Navigateur> = {}): Navigateur {
  let index = 0;
  return {
    permis: vi.fn(() => Promise.resolve(true)),
    ouvrir: vi.fn(() => Promise.resolve(42)),
    attendreChargement: vi.fn(() => Promise.resolve(true)),
    lire: vi.fn(() => {
      const valeur = lectures[Math.min(index, lectures.length - 1)];
      index += 1;
      return valeur instanceof Error ? Promise.reject(valeur) : Promise.resolve(valeur);
    }),
    afficher: vi.fn(() => Promise.resolve()),
    fermer: vi.fn(() => Promise.resolve()),
    revenir: vi.fn(() => Promise.resolve()),
    dormir: vi.fn(() => Promise.resolve()),
    ...surcharge,
  };
}

describe('suffisante et réglages', () => {
  it('une capture suffit avec prix et surface ; les réglages par défaut laissent le temps au chargement', () => {
    expect(suffisante(COMPLETE)).toBe(true);
    expect(suffisante(PARTIELLE)).toBe(false);
    expect(REGLAGES.chargementMs).toBeGreaterThanOrEqual(10_000);
  });

  it('le lecteur par défaut utilise ces réglages', async () => {
    const nav = navigateur([lue(COMPLETE)]);
    expect(await creerLecteur(nav, REGISTRE)('https://www.pap.fr/', ORIGINE)).toEqual({
      ok: false,
      raison: 'hors-annonce',
    });
  });
});

describe('creerLecteur', () => {
  it('refuse sans rien ouvrir : lien hors annonce, portail sans règles, autorisation manquante', async () => {
    const nav = navigateur([lue(COMPLETE)], { permis: vi.fn(() => Promise.resolve(false)) });
    expect(await creerLecteur(nav, REGISTRE, RAPIDE)('https://www.pap.fr/', ORIGINE)).toEqual({
      ok: false,
      raison: 'hors-annonce',
    });
    expect(await creerLecteur(nav, creerRegistre([]), RAPIDE)(URL_PAP, ORIGINE)).toEqual({
      ok: false,
      raison: 'portail-sans-regles',
    });
    expect(await creerLecteur(nav, REGISTRE, RAPIDE)(URL_PAP, ORIGINE)).toEqual({
      ok: false,
      raison: 'permission',
    });
    expect(nav.permis).toHaveBeenCalledWith('pap');
    expect(nav.ouvrir).not.toHaveBeenCalled();
  });

  it('lit dans un onglet caché à côté de Deklic, le referme et revient', async () => {
    const nav = navigateur([lue(COMPLETE)]);
    expect(await creerLecteur(nav, REGISTRE, RAPIDE)(URL_PAP, ORIGINE)).toEqual({
      ok: true,
      capture: COMPLETE,
    });
    expect(nav.ouvrir).toHaveBeenCalledWith(URL_CANONIQUE, ORIGINE);
    expect(nav.attendreChargement).toHaveBeenCalledWith(42, 10);
    expect(nav.lire).toHaveBeenCalledTimes(1);
    expect(nav.afficher).not.toHaveBeenCalled();
    expect(nav.fermer).toHaveBeenCalledWith(42);
    expect(nav.revenir).toHaveBeenCalledWith(ORIGINE);
  });

  it('affiche l’onglet et réessaie quand la lecture cachée ne donne pas prix et surface', async () => {
    const nav = navigateur([
      lue(PARTIELLE),
      new Error('page en cours de navigation'),
      { ok: false, raison: 'hors-annonce' },
      lue(COMPLETE),
    ]);
    expect(await creerLecteur(nav, REGISTRE, RAPIDE)(URL_PAP, ORIGINE)).toEqual({
      ok: true,
      capture: COMPLETE,
    });
    expect(nav.afficher).toHaveBeenCalledWith(42);
    expect(nav.lire).toHaveBeenCalledTimes(4);
    expect(nav.dormir).toHaveBeenCalledWith(1);
  });

  it('rend la capture la plus riche quand aucune ne suffit', async () => {
    const nav = navigateur([lue(PARTIELLE), lue(PARTIELLE_RICHE), 'illisible', lue(PARTIELLE)]);
    expect(await creerLecteur(nav, REGISTRE, RAPIDE)(URL_PAP, ORIGINE)).toEqual({
      ok: true,
      capture: PARTIELLE_RICHE,
    });
    expect(nav.lire).toHaveBeenCalledTimes(5);
  });

  it('signale une page vide (chargée) ou jamais chargée', async () => {
    const vide = navigateur([{ ok: false, raison: 'hors-annonce' }]);
    expect(await creerLecteur(vide, REGISTRE, RAPIDE)(URL_PAP, ORIGINE)).toEqual({
      ok: false,
      raison: 'vide',
    });
    const jamais = navigateur([undefined], {
      attendreChargement: vi.fn(() => Promise.resolve(false)),
    });
    expect(await creerLecteur(jamais, REGISTRE, RAPIDE)(URL_PAP, ORIGINE)).toEqual({
      ok: false,
      raison: 'chargement',
    });
    // Jamais chargée : pas de lecture cachée, seulement les essais onglet affiché.
    expect(jamais.lire).toHaveBeenCalledTimes(3);
    expect(jamais.fermer).toHaveBeenCalled();
  });

  it('une seule lecture à la fois, et une panne du navigateur libère la place', async () => {
    let ouvrirOnglet: (id: number) => void = () => undefined;
    const lente = navigateur([lue(COMPLETE)], {
      ouvrir: vi.fn(
        () =>
          new Promise<number>((resoudre) => {
            ouvrirOnglet = resoudre;
          }),
      ),
    });
    const lire = creerLecteur(lente, REGISTRE, RAPIDE);
    const premiere = lire(URL_PAP, ORIGINE);
    expect(await lire(URL_PAP, ORIGINE)).toEqual({ ok: false, raison: 'occupe' });
    await vi.waitFor(() => {
      expect(lente.ouvrir).toHaveBeenCalled();
    });
    ouvrirOnglet(42);
    expect(await premiere).toEqual({ ok: true, capture: COMPLETE });

    const enPanne = navigateur([lue(COMPLETE)], {
      ouvrir: vi.fn(() => Promise.reject(new Error('fenêtre fermée'))),
    });
    const lireEnPanne = creerLecteur(enPanne, REGISTRE, RAPIDE);
    expect(await lireEnPanne(URL_PAP, ORIGINE)).toEqual({ ok: false, raison: 'chargement' });
    expect(await lireEnPanne(URL_PAP, ORIGINE)).toEqual({ ok: false, raison: 'chargement' });
    expect(enPanne.ouvrir).toHaveBeenCalledTimes(2);
  });
});
