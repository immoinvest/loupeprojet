import { describe, expect, it } from 'vitest';

import { sommer, van } from '../../src/commun/flux';

describe('sommer', () => {
  it('additionne, et rend 0 pour une liste vide', () => {
    expect(sommer([1, 2, 3.5])).toBe(6.5);
    expect(sommer([])).toBe(0);
  });
});

describe('van', () => {
  it('à taux nul, la VAN est la somme des flux', () => {
    expect(van([-100, 60, 60], 0)).toBe(20);
  });

  it('actualise chaque flux à la fin de son année', () => {
    // -100 aujourd'hui, +110 dans un an, à 10 % : VAN = 0
    expect(Math.abs(van([-100, 110], 0.1))).toBeLessThan(1e-9);
  });
});
