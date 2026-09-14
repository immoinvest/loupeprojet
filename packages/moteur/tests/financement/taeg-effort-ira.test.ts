import { describe, expect, it } from 'vitest';

import { tableauAmortissement } from '../../src/financement/amortissement';
import { tauxEffort } from '../../src/financement/effort';
import { ira } from '../../src/financement/ira';
import { taeg } from '../../src/financement/taeg';
import { obtenirRegles } from '../../src/regles';

const regles = obtenirRegles('2026-09');
const lignes = tableauAmortissement({
  capital: 161_000,
  tauxAnnuel: 0.0335,
  dureeMois: 300,
  differeTotalMois: 0,
  differePartielMois: 0,
  tauxAssurance: 0.0025,
});

describe('taeg', () => {
  it('sans frais ni assurance, retrouve le taux actuariel du taux nominal', () => {
    const attendu = (1 + 0.0335 / 12) ** 12 - 1;
    expect(taeg(161_000, lignes, false)).toBeCloseTo(attendu, 8);
  });

  it('avec 2 350 € de frais et l’assurance, tombe entre 3,9 % et 4,2 %', () => {
    const valeur = taeg(161_000 - 2_350, lignes, true);
    expect(valeur).not.toBeNull();
    expect(valeur!).toBeGreaterThan(0.039);
    expect(valeur!).toBeLessThan(0.042);
    expect(valeur!).toBeGreaterThan(taeg(161_000 - 2_350, lignes, false)!);
  });

  it('rend null sans capital, sans lignes, ou si les paiements ne couvrent pas le capital', () => {
    expect(taeg(0, lignes, true)).toBeNull();
    expect(taeg(100_000, [], true)).toBeNull();
    expect(taeg(10_000_000, lignes, true)).toBeNull();
  });

  it('à taux nul et sans frais, le TAEG vaut 0', () => {
    const sansInterets = tableauAmortissement({
      capital: 120_000,
      tauxAnnuel: 0,
      dureeMois: 240,
      differeTotalMois: 0,
      differePartielMois: 0,
      tauxAssurance: 0,
    });
    expect(taeg(120_000, sansInterets, true)).toBe(0);
  });
});

describe('tauxEffort', () => {
  const base = {
    mensualiteTotale: 827,
    revenusMensuels: 2_600,
    loyerMensuel: 980,
    dureeAnnees: 25,
    travaux: 6_000,
    prix: 155_000,
  };

  it('HCSF (loyers à 70 %) = 25,2 %, sans loyers = 31,8 %', () => {
    const effort = tauxEffort(base, regles);
    expect(effort.hcsf).toBeCloseTo(0.252, 3);
    expect(effort.sansLoyers).toBeCloseTo(0.318, 3);
    expect(effort.depasseHcsf).toBe(false);
    expect(effort.seuil).toBe(0.35);
    expect(effort.dureeMaxAnnees).toBe(25);
    expect(effort.depasseDuree).toBe(false);
  });

  it('signale un effort au-dessus de 35 %', () => {
    expect(tauxEffort({ ...base, revenusMensuels: 1_500 }, regles).depasseHcsf).toBe(true);
  });

  it('autorise 27 ans quand les travaux atteignent 10 % du prix', () => {
    const effort = tauxEffort({ ...base, travaux: 16_000, dureeAnnees: 27 }, regles);
    expect(effort.dureeMaxAnnees).toBe(27);
    expect(effort.depasseDuree).toBe(false);
    expect(tauxEffort({ ...base, dureeAnnees: 27 }, regles).depasseDuree).toBe(true);
  });

  it('rend null sans aucun revenu (pas de division par zéro) et ne signale rien', () => {
    const effort = tauxEffort({ ...base, revenusMensuels: 0, loyerMensuel: 0 }, regles);
    expect(effort.hcsf).toBeNull();
    expect(effort.sansLoyers).toBeNull();
    expect(effort.depasseHcsf).toBe(false);
  });

  it('revenus inconnus (null) : aucun taux, même avec un loyer, et rien de signalé', () => {
    const effort = tauxEffort({ ...base, revenusMensuels: null }, regles);
    expect(effort.hcsf).toBeNull();
    expect(effort.sansLoyers).toBeNull();
    expect(effort.depasseHcsf).toBe(false);
    expect(effort.depasseDuree).toBe(false);
  });
});

describe('ira', () => {
  it('CRD 112 100 € à 3,35 % → 1 878 € (6 mois d’intérêts < 3 %)', () => {
    expect(ira(112_100, 0.0335, regles)).toBeCloseTo(1_877.7, 1);
  });

  it('plafonne à 3 % du CRD quand le taux est élevé', () => {
    expect(ira(100_000, 0.08, regles)).toBe(3_000);
  });

  it('vaut 0 sans capital restant', () => {
    expect(ira(0, 0.0335, regles)).toBe(0);
  });
});
