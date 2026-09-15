import { describe, expect, it } from 'vitest';
import type { Vente } from '../../../src/schemas/dvf.ts';
import { dansFenetre, fenetreDesVentes } from '../../../src/sources/dvf/fenetre.ts';

function vente(date: string): Vente {
  return {
    date,
    prix: 100000,
    surface: 40,
    type: 'appartement',
    pieces: 2,
    lat: null,
    lon: null,
    idParcelle: null,
    numero: null,
    suffixe: null,
    codeVoie: null,
    voie: null,
    carrez: null,
    dependances: 0,
    terrain: null,
    lots: null,
  };
}

describe('fenetreDesVentes', () => {
  it('se termine à la vente la plus récente et remonte de 24 mois inclus', () => {
    expect(
      fenetreDesVentes([vente('2025-03-10'), vente('2025-12-31'), vente('2024-06-01')], 24),
    ).toEqual({ debut: '2024-01-01', fin: '2025-12-31' });
    expect(fenetreDesVentes([vente('2026-06-30')], 24)).toEqual({
      debut: '2024-07-01',
      fin: '2026-06-30',
    });
  });

  it('rend null sans vente', () => {
    expect(fenetreDesVentes([], 24)).toBeNull();
  });
});

describe('dansFenetre', () => {
  it('inclut les deux bornes', () => {
    const fenetre = { debut: '2024-01-01', fin: '2025-12-31' };
    expect(dansFenetre(vente('2024-01-01'), fenetre)).toBe(true);
    expect(dansFenetre(vente('2025-12-31'), fenetre)).toBe(true);
    expect(dansFenetre(vente('2023-12-31'), fenetre)).toBe(false);
    expect(dansFenetre(vente('2026-01-01'), fenetre)).toBe(false);
  });
});
