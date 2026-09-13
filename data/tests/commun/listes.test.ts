import { describe, expect, it } from 'vitest';
import { elementA, objetTrie } from '../../src/commun/listes.ts';

describe('objetTrie', () => {
  it("rend une copie aux clés triées sans toucher à l'original", () => {
    const original = { '2A247': 2, '13055': 1, '2A004': 3 };
    expect(Object.keys(objetTrie(original))).toEqual(['13055', '2A004', '2A247']);
    expect(objetTrie(original)['2A004']).toBe(3);
    expect(original).toEqual({ '2A247': 2, '13055': 1, '2A004': 3 });
    expect(objetTrie({})).toEqual({});
  });
});

describe('elementA', () => {
  it("rend l'élément demandé", () => {
    expect(elementA(['a', 'b'], 1)).toBe('b');
  });

  it('échoue franchement hors de la liste', () => {
    expect(() => elementA(['a'], 1)).toThrow(RangeError);
    expect(() => elementA([], 0)).toThrow('index 0 hors de la liste (0 éléments)');
  });
});
