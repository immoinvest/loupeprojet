import { describe, expect, it } from 'vitest';
import {
  DEPARTEMENTS,
  departementDeCommune,
  estDepartement,
} from '../../src/commun/departements.ts';

describe('DEPARTEMENTS', () => {
  it('compte 101 départements, Corse en 2A et 2B, outre-mer sans Mayotte oubliée', () => {
    expect(DEPARTEMENTS).toHaveLength(101);
    expect(DEPARTEMENTS.slice(0, 3)).toEqual(['01', '02', '03']);
    expect(DEPARTEMENTS.slice(18, 22)).toEqual(['19', '2A', '2B', '21']);
    expect(DEPARTEMENTS).not.toContain('20');
    expect(DEPARTEMENTS.slice(-5)).toEqual(['971', '972', '973', '974', '976']);
  });
});

describe('estDepartement', () => {
  it('reconnaît les codes valides', () => {
    expect(estDepartement('13')).toBe(true);
    expect(estDepartement('2A')).toBe(true);
    expect(estDepartement('976')).toBe(true);
    expect(estDepartement('20')).toBe(false);
    expect(estDepartement('1')).toBe(false);
    expect(estDepartement('975')).toBe(false);
  });
});

describe('departementDeCommune', () => {
  it('extrait le département du code INSEE', () => {
    expect(departementDeCommune('13055')).toBe('13');
    expect(departementDeCommune('2A004')).toBe('2A');
    expect(departementDeCommune('97101')).toBe('971');
    expect(departementDeCommune('75101')).toBe('75');
  });
});
