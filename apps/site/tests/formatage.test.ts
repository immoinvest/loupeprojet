import { describe, expect, it } from 'vitest';

import {
  dateIso,
  dateLongue,
  euros,
  eurosParMois,
  nombre,
  pourcentage,
  pourcentageSigne,
  tauxRegle,
} from '../src/lib/formatage';

/** Intl met des espaces insécables (fines ou non) : on compare avec des espaces simples. */
function simple(texte: string): string {
  return texte.replace(/\s/g, ' ');
}

describe('formatage', () => {
  it('écrit les euros arrondis, avec un vrai signe moins et jamais « −0 »', () => {
    expect(simple(euros(155000))).toBe('155 000 €');
    expect(simple(euros(-210.4))).toBe('−210 €');
    expect(simple(euros(-0.4))).toBe('0 €');
  });

  it('signe les montants mensuels', () => {
    expect(simple(eurosParMois(46))).toBe('+46 €/mois');
    expect(simple(eurosParMois(-12))).toBe('−12 €/mois');
    expect(simple(eurosParMois(0))).toBe('0 €/mois');
  });

  it('écrit nombres et pourcentages à la française', () => {
    expect(simple(nombre(10700))).toBe('10 700');
    expect(nombre(3.14159, 2)).toBe('3,14');
    expect(simple(pourcentage(0.0428))).toBe('4,3 %');
    expect(simple(pourcentage(-0.05, 0))).toBe('−5 %');
    expect(simple(pourcentageSigne(-0.218))).toBe('−22 %');
    expect(simple(pourcentageSigne(0.03))).toBe('+3 %');
    expect(simple(pourcentageSigne(0))).toBe('0 %');
  });

  it('écrit les taux des règles sans zéro inutile', () => {
    expect(simple(tauxRegle(0.5))).toBe('50 %');
    expect(simple(tauxRegle(0.186))).toBe('18,6 %');
    expect(simple(tauxRegle(0.0529))).toBe('5,29 %');
    expect(simple(tauxRegle(-0.1))).toBe('−10 %');
  });

  it('n’utilise jamais l’espace fine insécable, absente des polices du site', () => {
    const espaceFine = String.fromCharCode(0x202f);
    for (const texte of [euros(162143), eurosParMois(-1210), nombre(10700), tauxRegle(12.5)]) {
      expect(texte).not.toContain(espaceFine);
    }
  });

  it('écrit les dates du frontmatter sans décalage de fuseau', () => {
    const date = new Date('2026-09-15');
    expect(dateLongue(date)).toBe('15 septembre 2026');
    expect(dateIso(date)).toBe('2026-09-15');
  });
});
