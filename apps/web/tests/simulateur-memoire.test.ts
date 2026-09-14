import { obtenirRegles } from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import {
  CLE_SIMULATEUR,
  ecrireSimulation,
  lireSimulation,
  saisieDefaut,
  versSimulation,
} from '@/simulateur';

const regles = obtenirRegles('2026-09');

describe('mémoire du simulateur', () => {
  it('écrit la simulation sous « loupe.simulateur.v1 » et la relit', () => {
    const simulation = versSimulation(saisieDefaut(regles)).simulation;
    expect(simulation).not.toBeNull();
    if (simulation === null) return;
    expect(CLE_SIMULATEUR).toBe('loupe.simulateur.v1');
    expect(lireSimulation(window.localStorage)).toBeNull();
    ecrireSimulation(window.localStorage, simulation);
    expect(JSON.parse(window.localStorage.getItem(CLE_SIMULATEUR) ?? '')).toEqual(simulation);
    expect(lireSimulation(window.localStorage)).toEqual(simulation);
  });

  it('ignore un contenu illisible ou d’une autre forme', () => {
    window.localStorage.setItem(CLE_SIMULATEUR, '{pas du json');
    expect(lireSimulation(window.localStorage)).toBeNull();
    window.localStorage.setItem(CLE_SIMULATEUR, JSON.stringify({ projet: {}, offres: [] }));
    expect(lireSimulation(window.localStorage)).toBeNull();
  });

  it('n’échoue pas quand le stockage refuse l’écriture', () => {
    const simulation = versSimulation(saisieDefaut(regles)).simulation;
    if (simulation === null) throw new Error('simulation attendue');
    const plein: Storage = {
      length: 0,
      clear: () => undefined,
      key: () => null,
      removeItem: () => undefined,
      getItem: () => null,
      setItem: () => {
        throw new DOMException('quota', 'QuotaExceededError');
      },
    };
    expect(() => {
      ecrireSimulation(plein, simulation);
    }).not.toThrow();
  });
});
