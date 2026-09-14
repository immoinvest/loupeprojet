import { describe, expect, it } from 'vitest';

import {
  ajouterJours,
  bornesPeriode,
  jourLocal,
  joursDansMois,
  JourSchema,
  periodeDe,
  periodePrecedente,
  PeriodeSchema,
  periodeSuivante,
} from '../src/dates';

describe('joursDansMois', () => {
  it('connaît les mois de 28, 29, 30 et 31 jours', () => {
    expect(joursDansMois(2026, 2)).toBe(28);
    expect(joursDansMois(2024, 2)).toBe(29);
    expect(joursDansMois(2000, 2)).toBe(29);
    expect(joursDansMois(2100, 2)).toBe(28);
    expect(joursDansMois(2026, 4)).toBe(30);
    expect(joursDansMois(2026, 12)).toBe(31);
  });
});

describe('JourSchema', () => {
  it.each(['2026-10-12', '2024-02-29', '2026-12-31', '2026-01-01'])('accepte %s', (jour) => {
    expect(JourSchema.safeParse(jour).success).toBe(true);
  });

  it.each([
    '2026-02-29',
    '2026-13-01',
    '2026-00-10',
    '2026-10-32',
    '2026-10-00',
    '2026-04-31',
    '26-10-12',
    '2026-1-12',
    ' 2026-10-12',
    '2026-10-12T00:00',
    '',
  ])('refuse « %s »', (jour) => {
    expect(JourSchema.safeParse(jour).success).toBe(false);
  });
});

describe('PeriodeSchema', () => {
  it('accepte un mois AAAA-MM et refuse le reste', () => {
    expect(PeriodeSchema.safeParse('2026-10').success).toBe(true);
    for (const faux of ['2026-13', '2026-00', '2026-1', '2026-10-01', 'octobre']) {
      expect(PeriodeSchema.safeParse(faux).success).toBe(false);
    }
  });
});

describe('périodes', () => {
  it('periodeDe garde l’année et le mois', () => {
    expect(periodeDe('2026-10-12')).toBe('2026-10');
  });

  it('bornesPeriode donne le premier et le dernier jour', () => {
    expect(bornesPeriode('2024-02')).toEqual({ debut: '2024-02-01', fin: '2024-02-29', jours: 29 });
    expect(bornesPeriode('2026-09')).toEqual({ debut: '2026-09-01', fin: '2026-09-30', jours: 30 });
  });

  it('periodeSuivante passe l’année', () => {
    expect(periodeSuivante('2026-01')).toBe('2026-02');
    expect(periodeSuivante('2026-12')).toBe('2027-01');
  });

  it('periodePrecedente repasse l’année et revient au point de départ', () => {
    expect(periodePrecedente('2026-03')).toBe('2026-02');
    expect(periodePrecedente('2027-01')).toBe('2026-12');
    expect(periodePrecedente(periodeSuivante('2026-02'))).toBe('2026-02');
  });
});

describe('ajouterJours', () => {
  it('traverse les mois, les années et le changement d’heure sans décaler', () => {
    expect(ajouterJours('2026-10-30', 5)).toBe('2026-11-04');
    expect(ajouterJours('2026-03-01', -1)).toBe('2026-02-28');
    expect(ajouterJours('2026-12-31', 1)).toBe('2027-01-01');
    // Changement d'heure en France : 25 octobre 2026 et 29 mars 2026.
    expect(ajouterJours('2026-10-24', 2)).toBe('2026-10-26');
    expect(ajouterJours('2026-03-28', 2)).toBe('2026-03-30');
    expect(ajouterJours('2026-10-05', 0)).toBe('2026-10-05');
  });
});

describe('jourLocal', () => {
  it('lit le jour dans le fuseau de l’appareil, même tard le soir', () => {
    expect(jourLocal(new Date(2026, 8, 14, 23, 30))).toBe('2026-09-14');
    expect(jourLocal(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01');
  });
});
