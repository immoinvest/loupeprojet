import { describe, expect, it } from 'vitest';

import { assuranceMensuelle, calculerMensualite } from '../../src/financement/mensualite';

describe('calculerMensualite', () => {
  it('161 000 € à 3,35 % sur 300 mois → 793,1 €', () => {
    expect(calculerMensualite(161_000, 0.0335, 300)).toBeCloseTo(793.1, 1);
  });

  it('à taux nul, divise le capital par la durée', () => {
    expect(calculerMensualite(120_000, 0, 240)).toBe(500);
  });

  it('rend 0 sans capital ou sans durée', () => {
    expect(calculerMensualite(0, 0.03, 240)).toBe(0);
    expect(calculerMensualite(-5, 0.03, 240)).toBe(0);
    expect(calculerMensualite(100_000, 0.03, 0)).toBe(0);
  });
});

describe('assuranceMensuelle', () => {
  it('0,25 % de 161 000 € → 33,5 € par mois', () => {
    expect(assuranceMensuelle(161_000, 0.0025)).toBeCloseTo(33.54, 2);
  });

  it('ne rend jamais de valeur négative', () => {
    expect(assuranceMensuelle(-1, 0.0025)).toBe(0);
  });
});
