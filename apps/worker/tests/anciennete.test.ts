import { describe, expect, it } from 'vitest';

import { milieuDePeriode, moisEntre } from '../src/donnees/anciennete';

const LE_13_SEPTEMBRE_2026 = Date.parse('2026-09-13T10:00:00Z');

describe('moisEntre', () => {
  it('compte les mois civils entiers, le jour du mois compris', () => {
    expect(moisEntre('2025-01-13', LE_13_SEPTEMBRE_2026)).toBe(20);
    expect(moisEntre('2025-01-14', LE_13_SEPTEMBRE_2026)).toBe(19);
    expect(moisEntre('2025-06-30', LE_13_SEPTEMBRE_2026)).toBe(14);
    expect(moisEntre('2026-09-13', LE_13_SEPTEMBRE_2026)).toBe(0);
    expect(moisEntre('2026-08-20', LE_13_SEPTEMBRE_2026)).toBe(0);
  });

  it('jamais négatif ; null sans date ou pour une date mal formée', () => {
    expect(moisEntre('2027-01-01', LE_13_SEPTEMBRE_2026)).toBe(0);
    expect(moisEntre(null, LE_13_SEPTEMBRE_2026)).toBeNull();
    expect(moisEntre('13/01/2025', LE_13_SEPTEMBRE_2026)).toBeNull();
  });
});

describe('milieuDePeriode', () => {
  it('rend le jour du milieu', () => {
    expect(milieuDePeriode({ debut: '2024-01-01', fin: '2025-12-31' })).toBe('2024-12-31');
    expect(milieuDePeriode({ debut: '2025-03-01', fin: '2025-03-01' })).toBe('2025-03-01');
    expect(milieuDePeriode({ debut: '2025-01-01', fin: '2025-01-02' })).toBe('2025-01-01');
  });
});
