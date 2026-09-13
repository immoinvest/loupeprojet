import { describe, expect, it } from 'vitest';

import {
  baseFraisAcquisition,
  emolumentsNotaireHt,
  fraisAcquisition,
  tauxDmto,
} from '../../src/financement/frais-acquisition';
import { obtenirRegles } from '../../src/regles';
import { AchatSchema } from '../../src/schema/hypotheses';

const regles = obtenirRegles('2026-09');
const achatMarseille = AchatSchema.parse({ prix: 155_000, honorairesAgence: 7_000 });

describe('baseFraisAcquisition', () => {
  it('retire les honoraires à la charge de l’acquéreur', () => {
    expect(baseFraisAcquisition(achatMarseille)).toBe(148_000);
  });

  it('garde le prix entier si les honoraires sont à la charge du vendeur', () => {
    const achat = AchatSchema.parse({
      prix: 155_000,
      honorairesAgence: 7_000,
      honorairesChargeAcquereur: false,
    });
    expect(baseFraisAcquisition(achat)).toBe(155_000);
  });
});

describe('tauxDmto', () => {
  it('prend 5 % par défaut, le taux réduit pour les départements listés, ou le taux imposé', () => {
    expect(tauxDmto(achatMarseille, '13', regles)).toBe(0.05);
    expect(tauxDmto(achatMarseille, '36', regles)).toBe(0.038);
    const impose = AchatSchema.parse({ prix: 100_000, dmtoTaux: 0.045 });
    expect(tauxDmto(impose, '13', regles)).toBe(0.045);
  });
});

describe('emolumentsNotaireHt', () => {
  it('applique les tranches cumulatives', () => {
    // 6 500 × 3,870 % + 10 500 × 1,596 % + 43 000 × 1,064 % + 88 000 × 0,799 %
    const attendu = 6_500 * 0.0387 + 10_500 * 0.01596 + 43_000 * 0.01064 + 88_000 * 0.00799;
    expect(emolumentsNotaireHt(148_000, regles)).toBeCloseTo(attendu, 6);
    expect(emolumentsNotaireHt(148_000, regles)).toBeCloseTo(1_579.77, 1);
  });

  it('ne dépasse pas la première tranche pour une petite base', () => {
    expect(emolumentsNotaireHt(5_000, regles)).toBeCloseTo(5_000 * 0.0387, 8);
  });
});

describe('fraisAcquisition (référence vérifiée à la main, T3 Marseille)', () => {
  const frais = fraisAcquisition(achatMarseille, '13', regles);

  it('droits = 148 000 × (5 % × 1,0237 + 1,2 %) = 9 351 €', () => {
    expect(frais.droits).toBeCloseTo(9_351, 0);
  });

  it('émoluments TTC = 1 896 €, CSI = 148 €, débours = 592 €', () => {
    expect(frais.emolumentsTtc).toBeCloseTo(1_896, 0);
    expect(frais.contributionSecuriteImmobiliere).toBeCloseTo(148, 0);
    expect(frais.debours).toBeCloseTo(592, 0);
  });

  it('total = 11 987 € (± 1 €), soit 8,1 % de la base', () => {
    expect(Math.abs(frais.total - 11_987)).toBeLessThanOrEqual(1);
    expect(frais.total / frais.base).toBeCloseTo(0.081, 3);
  });
});
