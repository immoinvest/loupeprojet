import { describe, expect, it } from 'vitest';

import { projetExemple } from '../../src/exemples/t3-marseille';
import { calculerFinancement } from '../../src/financement';
import { baseAmortissableBati, dotationsAnnee } from '../../src/fiscalite/amortissements';
import {
  STOCK_VIDE,
  ajouterDeficit,
  imputerDeficits,
  totalDeficits,
} from '../../src/fiscalite/deficits';
import { assuranceAnnee, interetsPayesAnnee } from '../../src/fiscalite/interets';
import { obtenirRegles } from '../../src/regles';
import { ProjetSchema } from '../../src/schema';

const regles = obtenirRegles('2026-09');
const projet = ProjetSchema.parse(projetExemple);

describe('amortissements', () => {
  it('base bâti = (155 000 − 7 000) × 85 % = 125 800 €', () => {
    expect(baseAmortissableBati(projet, regles)).toBe(125_800);
  });

  it('année 1 : bâti 55 %/50 ans + 45 %/20 ans, travaux /10, mobilier /7', () => {
    const d = dotationsAnnee(projet, regles, 1);
    const bati = (125_800 * 0.55) / 50 + (125_800 * 0.45) / 20;
    expect(d.immeuble).toBeCloseTo(bati + 6_000 / 10, 6);
    expect(d.mobilier).toBeCloseTo(5_000 / 7, 6);
  });

  it('les composants s’éteignent à leur terme (mobilier 7 ans, travaux 10, second œuvre 20)', () => {
    expect(dotationsAnnee(projet, regles, 8).mobilier).toBe(0);
    expect(dotationsAnnee(projet, regles, 11).immeuble).toBeCloseTo(
      (125_800 * 0.55) / 50 + (125_800 * 0.45) / 20,
      6,
    );
    expect(dotationsAnnee(projet, regles, 21).immeuble).toBeCloseTo((125_800 * 0.55) / 50, 6);
    expect(dotationsAnnee(projet, regles, 51).immeuble).toBe(0);
  });
});

describe('déficits reportables', () => {
  it('ajoute un lot avec sa date de péremption, ignore les montants nuls', () => {
    const stock = ajouterDeficit(STOCK_VIDE, 5_000, 1, 10);
    expect(stock).toEqual([{ montant: 5_000, derniereAnnee: 11 }]);
    expect(ajouterDeficit(stock, 0, 2, 10)).toEqual(stock);
    expect(totalDeficits(stock)).toBe(5_000);
  });

  it('impute les plus anciens d’abord et garde le reliquat', () => {
    const stock = ajouterDeficit(ajouterDeficit(STOCK_VIDE, 3_000, 1, 10), 2_000, 2, 10);
    const { stock: reste, impute } = imputerDeficits(stock, 4_000, 3);
    expect(impute).toBe(4_000);
    expect(reste).toEqual([{ montant: 1_000, derniereAnnee: 12 }]);
  });

  it('n’impute rien sur un résultat négatif et purge les lots périmés', () => {
    const stock = ajouterDeficit(STOCK_VIDE, 3_000, 1, 10);
    expect(imputerDeficits(stock, -500, 5).impute).toBe(0);
    expect(imputerDeficits(stock, 1_000, 12)).toEqual({ stock: [], impute: 0 });
    expect(ajouterDeficit(stock, 100, 12, 10)).toEqual([{ montant: 100, derniereAnnee: 22 }]);
  });
});

describe('intérêts et assurance payés par année', () => {
  it('sans différé, égaux aux intérêts du tableau', () => {
    const f = calculerFinancement(projet, regles);
    expect(interetsPayesAnnee(f, 1)).toBeCloseTo(f.parAnnee[0]?.interets ?? 0, 8);
    expect(assuranceAnnee(f, 1)).toBeCloseTo(f.assuranceMensuelle * 12, 8);
    expect(interetsPayesAnnee(f, 30)).toBe(0);
    expect(assuranceAnnee(f, 30)).toBe(0);
  });

  it('en différé total, aucun intérêt n’est payé (ils sont capitalisés)', () => {
    const p = ProjetSchema.parse({
      ...projetExemple,
      hypotheses: {
        ...projetExemple.hypotheses,
        pret: { ...projetExemple.hypotheses.pret, differeTotalMois: 12 },
      },
    });
    const f = calculerFinancement(p, regles);
    expect(interetsPayesAnnee(f, 1)).toBe(0);
    expect(interetsPayesAnnee(f, 2)).toBeGreaterThan(5_000);
  });
});
