import { describe, expect, it } from 'vitest';
import type { Vente } from '../../../src/schemas/dvf.ts';
import {
  indexDesCommunes,
  statistiquesCommune,
  statistiquesDesVentes,
} from '../../../src/sources/dvf/statistiques.ts';

function vente(prix: number, surface: number, type: Vente['type'] = 'appartement'): Vente {
  return {
    date: '2025-01-01',
    prix,
    surface,
    type,
    pieces: 2,
    lat: null,
    lon: null,
    idParcelle: null,
    numero: null,
    suffixe: null,
    codeVoie: null,
    voie: null,
    carrez: null,
  };
}

describe('statistiquesDesVentes', () => {
  it("rend le nombre de ventes, la médiane et les quartiles du prix au m² arrondis à l'euro", () => {
    expect(
      statistiquesDesVentes([
        vente(136000, 66),
        vente(93000, 27),
        vente(120000, 31),
        vente(160000, 40),
        vente(150000, 50),
      ]),
    ).toEqual({ ventes: 5, medianeM2: 3444, q1M2: 3000, q3M2: 3871 });
    expect(
      statistiquesDesVentes([vente(311610, 118, 'maison'), vente(250000, 100, 'maison')]),
    ).toEqual({ ventes: 2, medianeM2: 2570, q1M2: 2535, q3M2: 2606 });
  });

  it('rend null sans vente', () => {
    expect(statistiquesDesVentes([])).toBeNull();
  });
});

describe('statistiquesCommune et indexDesCommunes', () => {
  it('sépare appartements et maisons et omet le type absent', () => {
    expect(statistiquesCommune([vente(240000, 46)])).toEqual({
      appartement: { ventes: 1, medianeM2: 5217, q1M2: 5217, q3M2: 5217 },
    });
    expect(statistiquesCommune([vente(250000, 100, 'maison')])).toEqual({
      maison: { ventes: 1, medianeM2: 2500, q1M2: 2500, q3M2: 2500 },
    });
  });

  it('trie les communes par code INSEE', () => {
    const index = indexDesCommunes(
      new Map([
        ['2A247', [vente(240000, 46)]],
        ['2A004', [vente(93000, 27)]],
      ]),
    );
    expect(Object.keys(index)).toEqual(['2A004', '2A247']);
    expect(index['2A004']?.appartement?.medianeM2).toBe(3444);
  });
});
