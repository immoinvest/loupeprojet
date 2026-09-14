import { describe, expect, it } from 'vitest';

import { calculerCashflow } from '../../src/cashflow';
import { projetExemple } from '../../src/exemples/t3-marseille';
import { calculerFinancement } from '../../src/financement';
import { fraisDeductiblesAnnee1, projeterLmnpReel } from '../../src/fiscalite/lmnp-reel';
import { projeterMicroBic } from '../../src/fiscalite/micro-bic';
import type { ContexteFiscal } from '../../src/fiscalite/types';
import { obtenirRegles } from '../../src/regles';
import { parserComplet, type ProjetEntree, type Regime } from '../../src/schema';

const regles = obtenirRegles('2026-09');

function contexte(entree: ProjetEntree, regime: Regime): ContexteFiscal {
  const projet = parserComplet(entree);
  const financement = calculerFinancement(projet, regles);
  const cashflow = calculerCashflow(projet, financement, { regime });
  return { projet, financement, cashflow, regles };
}

const variante = (h: Partial<ProjetEntree['hypotheses']>): ProjetEntree => ({
  ...projetExemple,
  hypotheses: { ...projetExemple.hypotheses, ...h },
});

describe('micro-BIC', () => {
  const ctx = contexte(projetExemple, 'micro_bic');
  const r = projeterMicroBic(ctx);

  it('base = 50 % des recettes, impôt = base × (TMI 30 % + PS 18,6 %)', () => {
    const recettes = ctx.cashflow.recettes.loyersNets;
    const annee1 = r.annees[0]!;
    expect(annee1.baseImposable).toBeCloseTo(recettes * 0.5, 6);
    expect(annee1.impotRevenu).toBeCloseTo(recettes * 0.5 * 0.3, 6);
    expect(annee1.prelevementsSociaux).toBeCloseTo(recettes * 0.5 * 0.186, 6);
    expect(annee1.impot).toBeCloseTo(recettes * 0.5 * 0.486, 6);
    expect(annee1.cashflowApresImpot).toBeCloseTo(
      annee1.impot * -1 + ctx.cashflow.parAnnee[0]!.avantImpot,
      6,
    );
  });

  it('est imposé dès la première année, chaque année pareil, et éligible sous 83 600 €', () => {
    expect(r.eligible).toBe(true);
    expect(r.motifIneligibilite).toBeNull();
    expect(r.premiereAnneeImposable).toBe(1);
    expect(r.impotTotal).toBeCloseTo(r.annees[0]!.impot * 10, 4);
    expect(r.amortissementsImmeubleDeduits).toBe(0);
  });

  it('devient inéligible au-dessus du plafond', () => {
    const gros = contexte(
      variante({ location: { mode: 'meuble', loyerHc: 8_000, vacanceSemaines: 0 } }),
      'micro_bic',
    );
    const rr = projeterMicroBic(gros);
    expect(rr.eligible).toBe(false);
    expect(rr.motifIneligibilite).toBe('PLAFOND_MICRO_DEPASSE');
  });

  it('en meublé de tourisme non classé : abattement 30 % et plafond 15 000 €', () => {
    const cd = contexte(
      variante({
        location: { mode: 'courte_duree', nuitee: 90, nuiteesParMois: 182.5 / 12 },
      }),
      'micro_bic',
    );
    const rr = projeterMicroBic(cd);
    const recettes = cd.cashflow.recettes.loyersNets; // 90 × 182,5 = 16 425 €
    expect(rr.annees[0]!.baseImposable).toBeCloseTo(recettes * 0.7, 6);
    expect(rr.eligible).toBe(false);
  });

  it('en meublé de tourisme classé : abattement 50 % et plafond 83 600 €', () => {
    const cd = contexte(
      variante({
        location: {
          mode: 'courte_duree',
          nuitee: 90,
          nuiteesParMois: 182.5 / 12,
          tourismeClasse: true,
        },
      }),
      'micro_bic',
    );
    const rr = projeterMicroBic(cd);
    expect(rr.annees[0]!.baseImposable).toBeCloseTo(cd.cashflow.recettes.loyersNets * 0.5, 6);
    expect(rr.eligible).toBe(true);
  });
});

describe('LMNP réel — T3 Marseille', () => {
  const ctx = contexte(projetExemple, 'lmnp_reel');
  const r = projeterLmnpReel(ctx);

  it('passe en charge la première année notaire + honoraires + frais bancaires', () => {
    expect(fraisDeductiblesAnnee1(ctx)).toBeCloseTo(11_987 + 7_000 + 850 + 1_500, 0);
  });

  it('année 1 : déficit, impôt nul, amortissements entièrement reportés (art. 39 C)', () => {
    const a1 = r.annees[0]!;
    expect(a1.baseImposable).toBe(0);
    expect(a1.impot).toBe(0);
    expect(a1.amortissementsDeduits).toBe(0);
    expect(a1.stocks.deficitReportable).toBeGreaterThan(10_000);
    // dotations année 1 : bâti 4 214 + travaux 600 + mobilier 714
    expect(a1.stocks.amortissementsReportes).toBeCloseTo(
      (125_800 * 0.55) / 50 + (125_800 * 0.45) / 20 + 600 + 5_000 / 7,
      4,
    );
    expect(a1.cashflowApresImpot).toBeCloseTo(ctx.cashflow.parAnnee[0]!.avantImpot, 8);
  });

  it('aucun impôt sur 10 ans : le stock d’amortissements absorbe les résultats', () => {
    expect(r.impotTotal).toBe(0);
    expect(r.premiereAnneeImposable).toBeNull();
    expect(r.eligible).toBe(true);
    const a10 = r.annees[9]!;
    expect(a10.stocks.amortissementsReportes).toBeGreaterThan(0);
  });

  it('déduit les intérêts et l’assurance, et cumule les dotations immeuble déduites', () => {
    const a2 = r.annees[1]!;
    expect(a2.interetsDeductibles).toBeGreaterThan(5_000);
    expect(a2.chargesDeductibles).toBeCloseTo(3_685 + ctx.financement.assuranceMensuelle * 12, 4);
    const totalDeduit = r.annees.reduce((acc, a) => acc + a.amortissementsDeduits, 0);
    expect(r.amortissementsImmeubleDeduits).toBeLessThanOrEqual(totalDeduit + 1e-6);
    expect(r.amortissementsImmeubleDeduits).toBeGreaterThan(0);
  });
});

describe('LMNP réel — résultat positif (pas de crédit, loyer élevé)', () => {
  const ctx = contexte(
    variante({
      pret: { ...projetExemple.hypotheses.pret, apport: 500_000 },
      location: { mode: 'meuble', loyerHc: 2_300, vacanceSemaines: 0 },
    }),
    'lmnp_reel',
  );
  const r = projeterLmnpReel(ctx);
  const dotationBati = (125_800 * 0.55) / 50 + (125_800 * 0.45) / 20;
  const dotationTotale = dotationBati + 600 + 5_000 / 7;

  it('année 1 : le résultat positif absorbe une partie des amortissements, le reste est reporté', () => {
    // recettes 27 600 − charges 3 685 − frais année 1 (11 987 + 7 000 + 2 350 = 21 337) = 2 578 € > 0
    const a1 = r.annees[0]!;
    const resultat = 27_600 - 3_685 - fraisDeductiblesAnnee1(ctx);
    expect(resultat).toBeGreaterThan(0);
    expect(a1.amortissementsDeduits).toBeCloseTo(resultat, 4);
    expect(a1.baseImposable).toBeCloseTo(0, 6);
    expect(a1.stocks.amortissementsReportes).toBeCloseTo(dotationTotale - resultat, 4);
  });

  it('année 2 : tout le stock est déduit puis l’impôt tombe', () => {
    const a2 = r.annees[1]!;
    const dispo = 2 * dotationTotale - r.annees[0]!.amortissementsDeduits;
    expect(a2.amortissementsDeduits).toBeCloseTo(dispo, 4);
    expect(a2.baseImposable).toBeCloseTo(27_600 - 3_685 - dispo, 4);
    expect(a2.impot).toBeCloseTo(a2.baseImposable * 0.486, 4);
    expect(a2.stocks.amortissementsReportes).toBeCloseTo(0, 6);
    expect(r.premiereAnneeImposable).toBe(2);
  });

  it('sur 10 ans, toutes les dotations immeuble (bâti + travaux) sont déduites, le mobilier à part', () => {
    const totalDeduit = r.annees.reduce((acc, a) => acc + a.amortissementsDeduits, 0);
    expect(r.amortissementsImmeubleDeduits).toBeCloseTo(10 * (dotationBati + 600), 4);
    expect(totalDeduit - r.amortissementsImmeubleDeduits).toBeCloseTo(5_000, 4);
  });
});

describe('LMNP réel — cas particuliers', () => {
  it('honoraires à la charge du vendeur : non déduits (ils sont dans le prix)', () => {
    const ctx = contexte(
      variante({ achat: { ...projetExemple.hypotheses.achat, honorairesChargeAcquereur: false } }),
      'lmnp_reel',
    );
    expect(fraisDeductiblesAnnee1(ctx)).toBeCloseTo(
      ctx.financement.fraisAcquisition.total + 2_350,
      6,
    );
  });

  it('sans aucun amortissement disponible (terrain à 100 %, ni travaux ni mobilier), rien n’est déduit', () => {
    const sansAmortissement = {
      ...regles,
      fiscalite: {
        ...regles.fiscalite,
        amortissement: { ...regles.fiscalite.amortissement, partTerrain: 1 },
      },
    };
    const projet = parserComplet(
      variante({
        achat: { ...projetExemple.hypotheses.achat, travaux: 0, mobilier: 0 },
        pret: { ...projetExemple.hypotheses.pret, apport: 500_000 },
        location: { mode: 'meuble', loyerHc: 2_500, vacanceSemaines: 0 },
      }),
    );
    const financement = calculerFinancement(projet, sansAmortissement);
    const cashflow = calculerCashflow(projet, financement, { regime: 'lmnp_reel' });
    const r = projeterLmnpReel({ projet, financement, cashflow, regles: sansAmortissement });
    expect(r.annees[0]!.amortissementsDeduits).toBe(0);
    expect(r.annees[0]!.stocks.amortissementsReportes).toBe(0);
    expect(r.amortissementsImmeubleDeduits).toBe(0);
    expect(r.annees[0]!.baseImposable).toBeGreaterThan(0);
  });
});

describe('LMNP réel — imputation d’un déficit antérieur', () => {
  it('un déficit d’année 1 est imputé dès que le résultat redevient positif', () => {
    // Petit crédit : intérêts faibles, résultat positif dès l'année 2.
    const ctx = contexte(
      variante({
        pret: { ...projetExemple.hypotheses.pret, apport: 150_000 },
        location: { mode: 'meuble', loyerHc: 1_200, vacanceSemaines: 0 },
      }),
      'lmnp_reel',
    );
    const r = projeterLmnpReel(ctx);
    const a1 = r.annees[0]!;
    const a2 = r.annees[1]!;
    expect(a1.stocks.deficitReportable).toBeGreaterThan(0);
    expect(a2.deficitImpute).toBeGreaterThan(0);
    expect(a2.deficitImpute).toBeLessThanOrEqual(a1.stocks.deficitReportable);
    expect(a2.stocks.deficitReportable).toBeCloseTo(
      a1.stocks.deficitReportable - a2.deficitImpute,
      6,
    );
    // Tant qu'un déficit est imputé, le résultat est absorbé : ni base ni amortissement déduit.
    expect(a2.baseImposable).toBe(0);
    expect(r.annees.some((a) => a.annee > 2 && a.stocks.deficitReportable === 0)).toBe(true);
  });
});
