import { calculerMensualite } from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import { PretBienSchema, type PretBien } from '../src/depenses';
import {
  capitalRestantDu,
  echeanceDuMois,
  finDuPret,
  mensualiteDuPret,
  moisEntre,
  tableauDuPret,
} from '../src/pret';

/** 12 000 € sur 12 mois à 12 % : un taux mensuel de 1 %, calculable à la main. */
const PRET_12_POURCENT: PretBien = {
  capital: 1_200_000,
  tauxAnnuel: 0.12,
  dureeMois: 12,
  debut: '2026-10',
  assuranceMensuelle: 500,
};

describe('prêt du bien', () => {
  it('moisEntre : même mois 0, un an plus tard 12, avant négatif', () => {
    expect(moisEntre('2026-10', '2026-10')).toBe(0);
    expect(moisEntre('2026-10', '2027-10')).toBe(12);
    expect(moisEntre('2026-10', '2026-09')).toBe(-1);
  });

  it('cas calculé à la main : 12 000 € à 12 % sur 12 mois, première échéance en octobre 2026', () => {
    // Mensualité = 12 000 × 0,01 ÷ (1 − 1,01^−12) = 120 ÷ 0,112551 = 1 066,19 € ;
    // octobre : intérêts 120,00 €, capital 946,19 €, reste dû 11 053,81 €.
    expect(echeanceDuMois(PRET_12_POURCENT, '2026-10')).toEqual({
      periode: '2026-10',
      mensualite: 106_619,
      interets: 12_000,
      capitalRembourse: 94_619,
      assurance: 500,
      total: 107_119,
      capitalRestantDu: 1_105_381,
    });
    expect(mensualiteDuPret(PRET_12_POURCENT)).toBe(107_119);
    expect(finDuPret(PRET_12_POURCENT)).toBe('2027-09');
  });

  it('avant la première échéance : aucune mensualité, tout le capital reste dû ; après la dernière : rien', () => {
    expect(echeanceDuMois(PRET_12_POURCENT, '2026-09')).toBeNull();
    expect(capitalRestantDu(PRET_12_POURCENT, '2026-09')).toBe(1_200_000);
    expect(echeanceDuMois(PRET_12_POURCENT, '2027-10')).toBeNull();
    expect(capitalRestantDu(PRET_12_POURCENT, '2027-10')).toBe(0);
    expect(capitalRestantDu(PRET_12_POURCENT, '2027-09')).toBe(0);
    expect(capitalRestantDu(PRET_12_POURCENT, '2026-10')).toBe(1_105_381);
  });

  it('taux nul : le capital divisé par la durée ; le tableau couvre toute la durée, mois par mois', () => {
    const pret: PretBien = {
      ...PRET_12_POURCENT,
      tauxAnnuel: 0,
      dureeMois: 120,
      capital: 12_000_000,
    };
    const tableau = tableauDuPret(pret);
    expect(tableau).toHaveLength(120);
    expect(tableau[0]).toMatchObject({
      mensualite: 100_000,
      interets: 0,
      capitalRestantDu: 11_900_000,
    });
    expect(tableau[119]).toMatchObject({ periode: '2036-09', capitalRestantDu: 0 });
    // Même objet relu : le même tableau (gardé), identique au moteur.
    expect(tableauDuPret(pret)).toBe(tableau);
  });

  it('cohérent avec le moteur au centime : 150 000 € à 3,35 % sur 25 ans', () => {
    const pret: PretBien = {
      capital: 15_000_000,
      tauxAnnuel: 0.0335,
      dureeMois: 300,
      debut: '2026-11',
      assuranceMensuelle: 3_125,
    };
    const attendue = Math.round(calculerMensualite(150_000, 0.0335, 300) * 100);
    expect(echeanceDuMois(pret, '2031-06')?.mensualite).toBe(attendue);
    expect(mensualiteDuPret(pret)).toBe(attendue + 3_125);
    const tableau = tableauDuPret(pret);
    expect(tableau.at(-1)?.capitalRestantDu).toBe(0);
    // Le capital restant dû ne remonte jamais.
    expect(
      tableau.every(
        (l, i) => i === 0 || l.capitalRestantDu <= (tableau[i - 1]?.capitalRestantDu ?? 0),
      ),
    ).toBe(true);
  });

  it('schéma : bornes du capital, du taux, de la durée et du mois', () => {
    expect(PretBienSchema.safeParse(PRET_12_POURCENT).success).toBe(true);
    for (const faux of [
      { capital: 0 },
      { capital: 500_000_001 },
      { tauxAnnuel: -0.01 },
      { tauxAnnuel: 0.21 },
      { dureeMois: 0 },
      { dureeMois: 481 },
      { dureeMois: 12.5 },
      { debut: '2026-13' },
      { assuranceMensuelle: -1 },
    ]) {
      expect(PretBienSchema.safeParse({ ...PRET_12_POURCENT, ...faux }).success).toBe(false);
    }
  });
});
