import { describe, expect, it } from 'vitest';
import { elementA } from '../../src/commun/listes.ts';

describe('elementA', () => {
  it("rend l'élément demandé", () => {
    expect(elementA(['a', 'b'], 1)).toBe('b');
  });

  it('échoue franchement hors de la liste', () => {
    expect(() => elementA(['a'], 1)).toThrow(RangeError);
    expect(() => elementA([], 0)).toThrow('index 0 hors de la liste (0 éléments)');
  });
});
