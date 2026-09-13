import { describe, expect, it } from 'vitest';

import {
  dateCourte,
  euros,
  eurosParMois,
  eurosSignes,
  nombre,
  pourcentage,
  pourcentageSigne,
} from '@/formatage/nombres';

/** Les espaces insécables d'Intl varient selon la plateforme : on les normalise. */
const n = (s: string): string => s.replace(/\s/g, ' ');

describe('euros', () => {
  it('formate sans décimales, avec le vrai signe moins', () => {
    expect(n(euros(155_000))).toBe('155 000 €');
    expect(n(euros(-210.27))).toBe('−210 €');
    expect(n(euros(0))).toBe('0 €');
  });

  it('eurosSignes ajoute + aux positifs', () => {
    expect(n(eurosSignes(980))).toBe('+980 €');
    expect(n(eurosSignes(-56.4))).toBe('−56 €');
    expect(n(eurosSignes(0))).toBe('0 €');
    expect(n(eurosParMois(-210))).toBe('−210 €/mois');
  });
});

describe('pourcentages et nombres', () => {
  it('pourcentage avec décimales et signe négatif', () => {
    expect(n(pourcentage(0.04276))).toBe('4,3 %');
    expect(n(pourcentage(0.2516, 0))).toBe('25 %');
    expect(n(pourcentage(-0.012, 1))).toBe('−1,2 %');
  });

  it('pourcentageSigne', () => {
    expect(n(pourcentageSigne(-0.218))).toBe('−22 %');
    expect(n(pourcentageSigne(0.03))).toBe('+3 %');
    expect(n(pourcentageSigne(0))).toBe('0 %');
  });

  it('nombre', () => {
    expect(n(nombre(2384.6))).toBe('2 385');
    expect(n(nombre(1.5, 2))).toBe('1,50');
  });

  it('dateCourte', () => {
    expect(n(dateCourte('2026-09-13T10:00:00.000Z'))).toMatch(/13 sept\.? 2026/);
  });
});
