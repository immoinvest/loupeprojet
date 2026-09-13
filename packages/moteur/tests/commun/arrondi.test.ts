import { describe, expect, it } from 'vitest';

import {
  arrondir,
  arrondirCentime,
  arrondirEuro,
  arrondirTaux,
  enPourcentage,
} from '../../src/commun/arrondi';

describe('arrondir', () => {
  it('arrondit au nombre de décimales demandé', () => {
    expect(arrondir(1.23456, 2)).toBe(1.23);
    expect(arrondir(1.235, 2)).toBe(1.24);
    expect(arrondir(1234.5, 0)).toBe(1235);
  });

  it('corrige l’imprécision flottante classique (1,005 → 1,01)', () => {
    expect(arrondir(1.005, 2)).toBe(1.01);
  });

  it('ne rend jamais « -0 »', () => {
    expect(Object.is(arrondir(-0.2, 0), 0)).toBe(true);
    expect(Object.is(arrondir(-0.4, 0), -0)).toBe(false);
  });

  it('arrondit les négatifs', () => {
    expect(arrondir(-134.4, 0)).toBe(-134);
    expect(arrondir(-134.6, 0)).toBe(-135);
  });
});

describe('raccourcis', () => {
  it('arrondirEuro, arrondirCentime, arrondirTaux', () => {
    expect(arrondirEuro(793.14)).toBe(793);
    expect(arrondirCentime(33.5416)).toBe(33.54);
    expect(arrondirTaux(0.033512)).toBe(0.0335);
  });

  it('enPourcentage convertit un taux décimal', () => {
    expect(enPourcentage(0.2519)).toBe(25.2);
    expect(enPourcentage(0.04125, 2)).toBe(4.13);
  });
});
