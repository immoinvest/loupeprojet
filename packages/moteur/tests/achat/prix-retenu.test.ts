import { describe, expect, it } from 'vitest';

import { negociationMontant, prixRetenu, resumerAchat, tauxPourPrixRetenu } from '../../src/achat';
import { projetExemple } from '../../src/exemples/t3-marseille';
import { baseAmortissableBati } from '../../src/fiscalite/amortissements';
import { obtenirRegles } from '../../src/regles';
import { AchatSchema, NEGOCIATION_MAX, ProjetSchema } from '../../src/schema';

describe('prixRetenu', () => {
  it('92 000 € négociés à 5 % : 87 400 €, soit 4 600 € de moins', () => {
    const achat = AchatSchema.parse({ prix: 92_000, negociationTaux: 0.05 });
    expect(prixRetenu(achat)).toBe(87_400);
    expect(negociationMontant(achat)).toBe(4_600);
  });

  it('à négociation nulle, rend le prix affiché tel quel, même non entier', () => {
    const achat = AchatSchema.parse({ prix: 155_000.5 });
    expect(prixRetenu(achat)).toBe(155_000.5);
    expect(negociationMontant(achat)).toBe(0);
  });

  it('arrondit le prix négocié à l’euro, comme une offre d’achat', () => {
    expect(prixRetenu(AchatSchema.parse({ prix: 155_001, negociationTaux: 0.045 }))).toBe(148_026);
  });
});

describe('resumerAchat', () => {
  it('rend le prix affiché, le prix retenu, le taux et le montant', () => {
    const achat = AchatSchema.parse({
      prix: 155_000,
      honorairesAgence: 7_000,
      negociationTaux: 0.05,
    });
    expect(resumerAchat(achat)).toEqual({
      prixAffiche: 155_000,
      prixRetenu: 147_250,
      negociationTaux: 0.05,
      negociationMontant: 7_750,
    });
  });

  it('la base amortissable du bâti (LMNP réel) suit le prix retenu, honoraires retirés', () => {
    const projet = ProjetSchema.parse({
      ...projetExemple,
      hypotheses: {
        ...projetExemple.hypotheses,
        achat: { ...projetExemple.hypotheses.achat, negociationTaux: 0.05 },
      },
    });
    // (147 250 − 7 000) × (1 − 15 % de terrain)
    expect(baseAmortissableBati(projet, obtenirRegles('2026-09'))).toBeCloseTo(140_250 * 0.85, 6);
  });
});

describe('tauxPourPrixRetenu', () => {
  const achat = AchatSchema.parse({ prix: 155_000 });

  it('rend le taux qui amène le prix retenu au prix visé', () => {
    expect(tauxPourPrixRetenu(achat, 147_250)).toBeCloseTo(0.05, 10);
  });

  it('rend 0 quand le prix visé dépasse le prix affiché : rien à négocier', () => {
    expect(tauxPourPrixRetenu(achat, 206_733)).toBe(0);
    expect(tauxPourPrixRetenu(achat, 155_000)).toBe(0);
  });

  it('ne dépasse pas la borne du schéma', () => {
    expect(tauxPourPrixRetenu(achat, 50_000)).toBe(NEGOCIATION_MAX);
  });
});
