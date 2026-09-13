import { describe, expect, it } from 'vitest';

import { ErreurResolution } from '../../src/commun/erreurs';
import { resoudreOuNull, resoudreParBissection } from '../../src/commun/resolution';

describe('resoudreParBissection', () => {
  it('trouve la racine de x² − 2 à 1e-9 près', () => {
    const racine = resoudreParBissection((x) => x * x - 2, 0, 2);
    expect(Math.abs(racine - Math.SQRT2)).toBeLessThan(1e-8);
  });

  it('rend directement une borne qui est racine exacte', () => {
    expect(resoudreParBissection((x) => x - 1, 1, 5)).toBe(1);
    expect(resoudreParBissection((x) => x - 5, 1, 5)).toBe(5);
  });

  it('rend le milieu quand il est racine exacte', () => {
    expect(resoudreParBissection((x) => x, -1, 1)).toBe(0);
  });

  it('gère une fonction décroissante (signe de f(a) positif)', () => {
    const racine = resoudreParBissection((x) => 3 - x, 0, 10);
    expect(Math.abs(racine - 3)).toBeLessThan(1e-8);
  });

  it('lève ErreurResolution sans changement de signe', () => {
    expect(() => resoudreParBissection((x) => x * x + 1, -1, 1)).toThrow(ErreurResolution);
  });

  it('s’arrête au garde-fou d’itérations et rend la meilleure approximation', () => {
    const racine = resoudreParBissection((x) => x - 0.3, 0, 1, {
      maxIterations: 3,
      tolerance: 1e-12,
    });
    // 3 bissections sur [0, 1] : 0,5 → 0,25 → 0,375
    expect(racine).toBe(0.375);
  });
});

describe('resoudreOuNull', () => {
  it('rend null quand aucune racine n’est encadrée', () => {
    expect(resoudreOuNull((x) => x * x + 1, -1, 1)).toBeNull();
  });

  it('rend la racine sinon', () => {
    expect(resoudreOuNull((x) => x - 2, 0, 4)).toBe(2);
  });

  it('laisse passer les autres erreurs', () => {
    expect(() =>
      resoudreOuNull(
        () => {
          throw new TypeError('inattendue');
        },
        0,
        1,
      ),
    ).toThrow(TypeError);
  });
});
