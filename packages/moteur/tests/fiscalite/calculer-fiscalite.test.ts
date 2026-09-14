import { describe, expect, it } from 'vitest';

import { projetExemple } from '../../src/exemples/t3-marseille';
import { calculerFinancement } from '../../src/financement';
import { REGIMES, calculerFiscalite, locationPourRegime } from '../../src/fiscalite';
import { obtenirRegles } from '../../src/regles';
import { ProjetSchema, type ProjetEntree } from '../../src/schema';

const regles = obtenirRegles('2026-09');
const projet = ProjetSchema.parse(projetExemple);
const financement = calculerFinancement(projet, regles);

const avecLocation = (
  location: ProjetEntree['hypotheses']['location'],
  regime: ProjetEntree['hypotheses']['fiscalite']['regime'] = 'lmnp_reel',
): ProjetEntree => ({
  ...projetExemple,
  hypotheses: {
    ...projetExemple.hypotheses,
    location,
    fiscalite: { ...projetExemple.hypotheses.fiscalite, regime },
  },
});

describe('locationPourRegime', () => {
  const hyp = projet.hypotheses;

  it('meublé : la location du projet ; nu : une location nue au loyer nu saisi, même vacance', () => {
    expect(locationPourRegime(hyp, 'lmnp_reel', regles)).toBe(hyp.location);
    expect(locationPourRegime(hyp, 'micro_bic', regles)).toBe(hyp.location);
    const nu = {
      mode: 'nu',
      loyerHc: 850,
      chargesLocataire: 60,
      vacanceSemaines: 3,
      gestionTaux: 0,
    };
    expect(locationPourRegime(hyp, 'nu_reel', regles)).toEqual(nu);
    expect(locationPourRegime(hyp, 'micro_foncier', regles)).toEqual(nu);
  });

  it('sans loyer nu saisi, le déduit de la prime meublé (15 %)', () => {
    const sansNu = ProjetSchema.parse(avecLocation({ mode: 'meuble', loyerHc: 1_150 }));
    const nu = locationPourRegime(sansNu.hypotheses, 'nu_reel', regles);
    expect(nu.mode).toBe('nu');
    expect(nu.mode === 'nu' && nu.loyerHc).toBeCloseTo(1_000, 8);
  });

  it('en nu, les régimes meublés reçoivent une meublée au loyer majoré de la prime', () => {
    const nu = ProjetSchema.parse(avecLocation({ mode: 'nu', loyerHc: 800 }, 'nu_reel'));
    const meuble = locationPourRegime(nu.hypotheses, 'micro_bic', regles);
    expect(meuble).toMatchObject({ mode: 'meuble', vacanceSemaines: 3, gestionTaux: 0 });
    expect(meuble.mode === 'meuble' && meuble.loyerHc).toBeCloseTo(920, 8);
    expect(locationPourRegime(nu.hypotheses, 'micro_foncier', regles)).toBe(nu.hypotheses.location);
  });

  it('en courte durée : les régimes meublés gardent la courte durée ; les nus prennent le loyer de référence ÷ prime', () => {
    const cd = ProjetSchema.parse(
      avecLocation({ mode: 'courte_duree', nuitee: 80, nuiteesParMois: 15 }),
    );
    expect(locationPourRegime(cd.hypotheses, 'lmnp_reel', regles).mode).toBe('courte_duree');
    const nu = locationPourRegime(cd.hypotheses, 'nu_reel', regles);
    // Référence meublée : 80 € × 30 ÷ 2 = 1 200 € ; en nu : ÷ 1,15.
    expect(nu).toMatchObject({
      mode: 'nu',
      chargesLocataire: 0,
      vacanceSemaines: 3,
      gestionTaux: 0,
    });
    expect(nu.mode === 'nu' && nu.loyerHc).toBeCloseTo(1_200 / 1.15, 8);
  });

  it('en colocation et moyenne durée : les régimes nus reprennent vacance et gestion du projet', () => {
    const coloc = ProjetSchema.parse(
      avecLocation({
        mode: 'colocation',
        chambres: 4,
        loyerChambre: 460,
        vacanceSemaines: 5,
        gestionTaux: 0.08,
      }),
    );
    const nuColoc = locationPourRegime(coloc.hypotheses, 'micro_foncier', regles);
    expect(nuColoc).toMatchObject({ mode: 'nu', vacanceSemaines: 5, gestionTaux: 0.08 });
    expect(nuColoc.mode === 'nu' && nuColoc.loyerHc).toBeCloseTo((460 * 4) / 1.35 / 1.15, 8);
    const md = ProjetSchema.parse(
      avecLocation({ mode: 'moyenne_duree', loyerHc: 900, vacanceSemaines: 6, gestionTaux: 0.05 }),
    );
    expect(locationPourRegime(md.hypotheses, 'nu_reel', regles)).toMatchObject({
      mode: 'nu',
      vacanceSemaines: 6,
      gestionTaux: 0.05,
    });
  });
});

describe('calculerFiscalite — T3 Marseille', () => {
  const f = calculerFiscalite(projet, financement, regles);

  it('projette les quatre régimes, chacun avec son loyer, tous compatibles en meublé', () => {
    expect(Object.keys(f.regimes).sort()).toEqual([...REGIMES].sort());
    expect(f.compatibles).toEqual(['micro_bic', 'lmnp_reel', 'micro_foncier', 'nu_reel']);
    expect(f.regimes.lmnp_reel.cashflow.recettes.loyersBruts).toBe(11_760);
    expect(f.regimes.nu_reel.cashflow.recettes.loyersBruts).toBe(10_200);
    expect(f.regimes.micro_bic.annees).toHaveLength(10);
  });

  it('retient le régime des hypothèses et désigne le meilleur cash-flow après impôt', () => {
    expect(f.retenu).toBe('lmnp_reel');
    const scores = Object.values(f.regimes)
      .filter((r) => r.eligible)
      .map((r) => r.cashflowApresImpotTotal);
    expect(f.regimes[f.meilleur].cashflowApresImpotTotal).toBe(Math.max(...scores));
    expect(f.meilleur).toBe('lmnp_reel');
  });

  it('désigne aussi le régime le moins imposé (le LMNP réel, à 0 € sur 10 ans)', () => {
    expect(f.regimes.lmnp_reel.impotTotal).toBe(0);
    expect(f.meilleurImpot).toBe('lmnp_reel');
    expect(f.regimes.micro_bic.impotTotal).toBeGreaterThan(20_000);
  });

  it('ignore les régimes inéligibles pour désigner le meilleur', () => {
    const gros = ProjetSchema.parse(
      avecLocation({ mode: 'meuble', loyerHc: 7_500, loyerHcNu: 6_500, vacanceSemaines: 0 }),
    );
    const ff = calculerFiscalite(gros, calculerFinancement(gros, regles), regles);
    expect(ff.regimes.micro_bic.eligible).toBe(false);
    expect(ff.regimes.micro_foncier.eligible).toBe(false);
    expect(['lmnp_reel', 'nu_reel']).toContain(ff.meilleur);
    expect(['lmnp_reel', 'nu_reel']).toContain(ff.meilleurImpot);
  });

  it('en colocation, seuls les régimes du meublé sont compatibles et proposés comme meilleurs', () => {
    // Loyer total faible : les régimes nus, à loyer plus bas, paieraient moins d'impôt.
    const coloc = ProjetSchema.parse(
      avecLocation({ mode: 'colocation', chambres: 3, loyerChambre: 380 }, 'micro_bic'),
    );
    const ff = calculerFiscalite(coloc, calculerFinancement(coloc, regles), regles);
    expect(ff.compatibles).toEqual(['micro_bic', 'lmnp_reel']);
    expect(ff.regimes.nu_reel.cashflow.recettes.mode).toBe('nu');
    expect(['micro_bic', 'lmnp_reel']).toContain(ff.meilleur);
    expect(['micro_bic', 'lmnp_reel']).toContain(ff.meilleurImpot);
    expect(ff.regimes.nu_reel.impotTotal).toBeLessThanOrEqual(
      ff.regimes[ff.meilleurImpot].impotTotal,
    );
  });
});
