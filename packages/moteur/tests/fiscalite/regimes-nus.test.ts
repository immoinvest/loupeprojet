import { describe, expect, it } from 'vitest';

import { calculerCashflow } from '../../src/cashflow';
import { projetExemple } from '../../src/exemples/t3-marseille';
import { calculerFinancement } from '../../src/financement';
import { assuranceAnnee, interetsPayesAnnee } from '../../src/fiscalite/interets';
import { projeterMicroFoncier } from '../../src/fiscalite/micro-foncier';
import { projeterNuReel } from '../../src/fiscalite/nu-reel';
import type { ContexteFiscal } from '../../src/fiscalite/types';
import { vacanceSemaines } from '../../src/location';
import { obtenirRegles } from '../../src/regles';
import { parserComplet, type ProjetEntree, type Regime } from '../../src/schema';

const regles = obtenirRegles('2026-09');

function contexteNu(entree: ProjetEntree, regime: Regime, loyerHc: number): ContexteFiscal {
  const projet = parserComplet(entree);
  const financement = calculerFinancement(projet, regles);
  const cashflow = calculerCashflow(projet, financement, {
    regime,
    location: {
      mode: 'nu',
      loyerHc,
      chargesLocataire: 0,
      vacanceSemaines: vacanceSemaines(projet.hypotheses.location),
      gestionTaux: 0,
    },
  });
  return { projet, financement, cashflow, regles };
}

const variante = (h: Partial<ProjetEntree['hypotheses']>): ProjetEntree => ({
  ...projetExemple,
  hypotheses: { ...projetExemple.hypotheses, ...h },
});

describe('micro-foncier', () => {
  const ctx = contexteNu(projetExemple, 'micro_foncier', 850);
  const r = projeterMicroFoncier(ctx);

  it('base = 70 % des loyers, impôt = base × (TMI 30 % + PS 17,2 %)', () => {
    const loyers = ctx.cashflow.recettes.loyersNets; // 850 × 12 × 49/52
    const a1 = r.annees[0]!;
    expect(loyers).toBeCloseTo(10_200 * (49 / 52), 6);
    expect(a1.baseImposable).toBeCloseTo(loyers * 0.7, 6);
    expect(a1.impot).toBeCloseTo(loyers * 0.7 * 0.472, 6);
    expect(r.eligible).toBe(true);
    expect(r.premiereAnneeImposable).toBe(1);
  });

  it('inéligible au-dessus de 15 000 € de loyers', () => {
    const gros = contexteNu(
      variante({ location: { mode: 'nu', loyerHc: 1_300, vacanceSemaines: 0 } }),
      'micro_foncier',
      1_300,
    );
    const rr = projeterMicroFoncier(gros);
    expect(rr.eligible).toBe(false);
    expect(rr.motifIneligibilite).toBe('PLAFOND_MICRO_DEPASSE');
  });
});

describe('nu réel — T3 Marseille (loyer nu 850 €)', () => {
  const ctx = contexteNu(projetExemple, 'nu_reel', 850);
  const r = projeterNuReel(ctx);

  it('année 1 : travaux déduits, déficit dû aux intérêts → rien sur le revenu global, tout reporté', () => {
    const a1 = r.annees[0]!;
    // charges : 3 085 (ni comptable ni CFE) + assurance 402,5 + travaux 6 000 = 9 487,5 < loyers 9 611,5
    expect(a1.chargesDeductibles).toBeCloseTo(
      3_085 + ctx.financement.assuranceMensuelle * 12 + 6_000,
      4,
    );
    expect(a1.interetsDeductibles).toBeGreaterThan(5_000);
    expect(a1.deficitImputeRevenuGlobal).toBe(0);
    expect(a1.impot).toBe(0);
    expect(a1.stocks.deficitReportable).toBeCloseTo(
      a1.chargesDeductibles + a1.interetsDeductibles - a1.recettes,
      6,
    );
  });

  it('les années suivantes imputent le report puis paient IR + PS 17,2 %', () => {
    const imposable = r.annees.find((a) => a.impot > 0)!;
    expect(r.premiereAnneeImposable).toBe(imposable.annee);
    expect(imposable.prelevementsSociaux).toBeCloseTo(imposable.baseImposable * 0.172, 6);
    expect(imposable.impotRevenu).toBeCloseTo(imposable.baseImposable * 0.3, 6);
    expect(r.annees[1]!.deficitImpute).toBeGreaterThan(0);
    expect(r.amortissementsImmeubleDeduits).toBe(0);
  });
});

describe('nu réel — déficit foncier imputable sur le revenu global', () => {
  it('gros travaux : la part hors intérêts s’impute (économie = TMI seule), le reste est reporté', () => {
    const ctx = contexteNu(
      variante({ achat: { ...projetExemple.hypotheses.achat, travaux: 20_000 } }),
      'nu_reel',
      850,
    );
    const a1 = projeterNuReel(ctx).annees[0]!;
    const horsInterets = a1.chargesDeductibles - a1.recettes; // ≈ 13 876 € − 9 611 € > 0, < 10 700 ?
    const attendu = Math.min(horsInterets, 10_700);
    expect(a1.deficitImputeRevenuGlobal).toBeCloseTo(attendu, 6);
    expect(a1.impotRevenu).toBeCloseTo(-attendu * 0.3, 6);
    expect(a1.prelevementsSociaux).toBe(0);
    expect(a1.impot).toBeLessThan(0);
    expect(a1.cashflowApresImpot).toBeGreaterThan(ctx.cashflow.parAnnee[0]!.avantImpot);
    expect(a1.stocks.deficitReportable).toBeCloseTo(
      a1.chargesDeductibles + a1.interetsDeductibles - a1.recettes - attendu,
      6,
    );
  });

  it('plafonne à 10 700 €, ou 21 400 € en rénovation énergétique', () => {
    const base = { ...projetExemple.hypotheses.achat, travaux: 40_000 };
    const standard = projeterNuReel(contexteNu(variante({ achat: base }), 'nu_reel', 850))
      .annees[0]!;
    expect(standard.deficitImputeRevenuGlobal).toBe(10_700);
    const energie = projeterNuReel(
      contexteNu(
        variante({ achat: { ...base, travauxRenovationEnergetique: true } }),
        'nu_reel',
        850,
      ),
    ).annees[0]!;
    expect(energie.deficitImputeRevenuGlobal).toBeGreaterThan(10_700);
    expect(energie.deficitImputeRevenuGlobal).toBeLessThanOrEqual(21_400);
  });

  it('sans crédit ni travaux, le résultat est positif dès l’année 1', () => {
    const ctx = contexteNu(
      variante({
        achat: { ...projetExemple.hypotheses.achat, travaux: 0 },
        pret: { ...projetExemple.hypotheses.pret, apport: 500_000 },
      }),
      'nu_reel',
      850,
    );
    const a1 = projeterNuReel(ctx).annees[0]!;
    expect(a1.baseImposable).toBeCloseTo(a1.recettes - 3_085, 4);
    expect(a1.impot).toBeCloseTo(a1.baseImposable * 0.472, 4);
    expect(a1.stocks.deficitReportable).toBe(0);
  });
});

/**
 * Frais d'emprunt et ordre de compensation, calculé à la main. Sources :
 * - BOI-RFPI-BASE-20-80 § 190 : frais de constitution du dossier et sommes versées à un organisme de
 *   cautionnement déductibles « au même titre que le montant des intérêts » ; § 240 : charges de
 *   l'année où elles sont payées (frais payés à la signature : année 1) ;
 * - BOI-RFPI-BASE-30-20 § 110 (16/09/2025) : « Le revenu brut est toujours réputé compenser
 *   prioritairement les intérêts d'emprunt » ; les frais accessoires à un emprunt (frais de dossier,
 *   assurance) sont assimilés aux intérêts : leur part du déficit se reporte 10 ans sur les revenus
 *   fonciers, seule la part des autres charges s'impute sur le revenu global (10 700 €). Exemple du
 *   § 110 : revenu brut 1 500, autres charges 2 900, intérêts 2 100 → 600 reportés, 2 900 imputés.
 *
 * Cas du moteur : T3 Marseille en nu, sans travaux, recettes R = 9 000 € et charges d'exploitation
 * C = 10 000 € posées chaque année ; I = intérêts payés l'année 1, A = assurance de l'année 1, frais
 * d'emprunt 850 + 1 500 = 2 350 €. Financier F = I + A + 2 350 (sous R, vérifié) :
 * - charges déductibles = C + A + 2 350 ;
 * - revenu global = min(C − (R − F), 10 700) ; report = (C + F − R) − revenu global.
 */
describe('nu réel — frais d’emprunt et ordre de compensation (BOI-RFPI-BASE-30-20 § 110)', () => {
  const base = contexteNu(
    variante({ achat: { ...projetExemple.hypotheses.achat, travaux: 0 } }),
    'nu_reel',
    850,
  );
  const ctx: ContexteFiscal = {
    ...base,
    cashflow: {
      ...base.cashflow,
      parAnnee: base.cashflow.parAnnee
        .slice(0, 2)
        .map((a) => ({ ...a, recettes: 9_000, charges: 10_000 })),
    },
  };
  const interets = interetsPayesAnnee(base.financement, 1);
  const assurance = assuranceAnnee(base.financement, 1);
  const financier = interets + assurance + 850 + 1_500;
  const [a1, a2] = projeterNuReel(ctx).annees;

  it('précondition : intérêts, assurance et frais de l’année 1 restent sous les recettes', () => {
    expect(interets).toBeGreaterThan(5_000);
    expect(financier).toBeLessThan(9_000);
  });

  it('année 1 : frais de dossier (850 €) et de garantie (1 500 €) déduits avec l’assurance', () => {
    expect(a1!.chargesDeductibles).toBeCloseTo(10_000 + assurance + 2_350, 6);
    expect(a1!.interetsDeductibles).toBeCloseTo(interets, 6);
  });

  it('le revenu brut compense d’abord intérêts, assurance et frais ; le reste des charges va au revenu global', () => {
    const revenuGlobal = Math.min(10_000 - (9_000 - financier), 10_700);
    expect(a1!.deficitImputeRevenuGlobal).toBeCloseTo(revenuGlobal, 6);
    expect(a1!.stocks.deficitReportable).toBeCloseTo(10_000 + financier - 9_000 - revenuGlobal, 6);
    expect(a1!.impotRevenu).toBeCloseTo(-revenuGlobal * 0.3, 6);
  });

  it('année 2 : plus de frais de dossier ni de garantie, l’assurance reste', () => {
    expect(a2!.chargesDeductibles).toBeCloseTo(10_000 + assuranceAnnee(base.financement, 2), 6);
  });
});
