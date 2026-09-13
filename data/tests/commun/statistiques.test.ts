import { describe, expect, it } from 'vitest';
import { arrondir, quantile, quartiles } from '../../src/commun/statistiques.ts';

describe('quantile', () => {
  it('interpole linéairement entre deux valeurs (méthode 7)', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([1, 2, 3, 4], 0.25)).toBe(1.75);
    expect(quantile([1, 2, 3, 4], 0.75)).toBe(3.25);
  });

  it("rend les extrémités pour 0 et 1, et la seule valeur d'une liste unitaire", () => {
    expect(quantile([3, 7, 9], 0)).toBe(3);
    expect(quantile([3, 7, 9], 1)).toBe(9);
    expect(quantile([10], 0.5)).toBe(10);
  });

  it('refuse une liste vide et une probabilité hors de [0, 1]', () => {
    expect(() => quantile([], 0.5)).toThrow('liste vide');
    expect(() => quantile([1], -0.1)).toThrow('probabilité hors de [0, 1] : -0.1');
    expect(() => quantile([1], 1.1)).toThrow(RangeError);
  });
});

describe('quartiles', () => {
  it('trie puis calcule Q1, médiane et Q3', () => {
    expect(quartiles([3, 1, 2])).toEqual({ q1: 1.5, mediane: 2, q3: 2.5 });
    expect(quartiles([2000, 3000, 3500, 4000, 10000])).toEqual({
      q1: 3000,
      mediane: 3500,
      q3: 4000,
    });
  });

  it('rend null sans valeur et ne modifie pas la liste reçue', () => {
    expect(quartiles([])).toBeNull();
    const valeurs = [3, 1, 2];
    quartiles(valeurs);
    expect(valeurs).toEqual([3, 1, 2]);
  });
});

describe('arrondir', () => {
  it('arrondit au nombre de décimales demandé', () => {
    expect(arrondir(1.005, 2)).toBe(1.01);
    expect(arrondir(2.5, 0)).toBe(3);
    expect(arrondir(0.44544, 5)).toBe(0.44544);
  });

  it('ne produit jamais -0', () => {
    expect(Object.is(arrondir(-0.001, 2), 0)).toBe(true);
    expect(arrondir(-1.234, 2)).toBe(-1.23);
  });
});
