import { describe, expect, it } from 'vitest';
import {
  ajouterJours,
  dateIso,
  debutFenetre,
  debutTrimestre,
  decalerMois,
  trimestreDe,
  trimestreSuivant,
} from '../../src/commun/dates.ts';

describe('dateIso', () => {
  it('rend la date calendaire en temps universel', () => {
    expect(dateIso(new Date('2026-09-13T22:30:00Z'))).toBe('2026-09-13');
  });
});

describe('ajouterJours et decalerMois', () => {
  it("passent les fins de mois et d'année", () => {
    expect(ajouterJours('2024-02-28', 2)).toBe('2024-03-01');
    expect(ajouterJours('2025-01-01', -1)).toBe('2024-12-31');
    expect(decalerMois('2025-12-31', -24)).toBe('2023-12-31');
    expect(decalerMois('2026-11-15', 3)).toBe('2027-02-15');
  });

  it('refusent une date mal formée', () => {
    expect(() => ajouterJours('13/09/2026', 1)).toThrow(
      'date ISO attendue (AAAA-MM-JJ) : 13/09/2026',
    );
  });
});

describe('debutFenetre', () => {
  it("rend le premier jour d'une fenêtre glissante inclusive", () => {
    expect(debutFenetre('2025-12-31', 24)).toBe('2024-01-01');
    expect(debutFenetre('2025-11-30', 24)).toBe('2023-12-01');
    expect(debutFenetre('2026-06-15', 12)).toBe('2025-06-16');
  });
});

describe('trimestres', () => {
  it("identifie le trimestre civil d'une date", () => {
    expect(trimestreDe('2026-01-01')).toBe('2026-T1');
    expect(trimestreDe('2026-09-13')).toBe('2026-T3');
    expect(trimestreDe('2026-12-31')).toBe('2026-T4');
  });

  it("rend le premier jour d'un trimestre et le trimestre suivant", () => {
    expect(debutTrimestre('2026-T1')).toBe('2026-01-01');
    expect(debutTrimestre('2026-T3')).toBe('2026-07-01');
    expect(trimestreSuivant('2026-T3')).toBe('2026-T4');
    expect(trimestreSuivant('2026-T4')).toBe('2027-T1');
  });

  it('refuse un trimestre mal formé', () => {
    expect(() => debutTrimestre('2026-Q3')).toThrow('trimestre attendu (AAAA-Tn) : 2026-Q3');
  });
});
