import { describe, expect, it } from 'vitest';

import { projetExemple } from '../../src/exemples/t3-marseille';
import { calculerFinancement } from '../../src/financement';
import { REGIMES, calculerFiscalite, locationPourRegime } from '../../src/fiscalite';
import { obtenirRegles } from '../../src/regles';
import { parserComplet, type ProjetEntree } from '../../src/schema';

const regles = obtenirRegles('2026-09');
const projet = parserComplet(projetExemple);
const financement = calculerFinancement(projet, regles);

const avecLocation = (location: ProjetEntree['hypotheses']['location']): ProjetEntree => ({
  ...projetExemple,
  hypotheses: { ...projetExemple.hypotheses, location },
});

describe('locationPourRegime', () => {
  const hyp = projet.hypotheses;

  it('meublé : le loyer meublé ; nu : le loyer nu saisi', () => {
    expect(locationPourRegime(hyp, 'lmnp_reel', regles)).toEqual({
      mode: 'meuble_lld',
      loyerHc: 980,
    });
    expect(locationPourRegime(hyp, 'micro_bic', regles)).toEqual({
      mode: 'meuble_lld',
      loyerHc: 980,
    });
    expect(locationPourRegime(hyp, 'nu_reel', regles)).toEqual({ mode: 'nu', loyerHc: 850 });
    expect(locationPourRegime(hyp, 'micro_foncier', regles)).toEqual({ mode: 'nu', loyerHc: 850 });
  });

  it('sans loyer nu saisi, le déduit de la prime meublé (15 %)', () => {
    const sansNu = parserComplet(avecLocation({ mode: 'meuble_lld', loyerHc: 1_150 }));
    expect(locationPourRegime(sansNu.hypotheses, 'nu_reel', regles).loyerHc).toBeCloseTo(1_000, 8);
  });

  it('en mode nu, les régimes meublés reçoivent un loyer majoré de la prime', () => {
    const nu = parserComplet(avecLocation({ mode: 'nu', loyerHc: 800 }));
    const meuble = locationPourRegime(nu.hypotheses, 'micro_bic', regles);
    expect(meuble.mode).toBe('meuble_lld');
    expect(meuble.loyerHc).toBeCloseTo(920, 8);
    expect(locationPourRegime(nu.hypotheses, 'micro_foncier', regles)).toEqual({
      mode: 'nu',
      loyerHc: 800,
    });
  });

  it('en courte durée, les régimes meublés gardent le mode courte durée', () => {
    const cd = parserComplet(
      avecLocation({
        mode: 'courte_duree',
        loyerHc: 0,
        loyerHcNu: 700,
        courteDuree: { nuitee: 80, tauxOccupation: 0.5 },
      }),
    );
    expect(locationPourRegime(cd.hypotheses, 'lmnp_reel', regles).mode).toBe('courte_duree');
    expect(locationPourRegime(cd.hypotheses, 'nu_reel', regles)).toEqual({
      mode: 'nu',
      loyerHc: 700,
    });
  });
});

describe('calculerFiscalite — T3 Marseille', () => {
  const f = calculerFiscalite(projet, financement, regles);

  it('projette les quatre régimes, chacun avec son loyer', () => {
    expect(Object.keys(f.regimes).sort()).toEqual([...REGIMES].sort());
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
    const gros = parserComplet(
      avecLocation({ mode: 'meuble_lld', loyerHc: 7_500, loyerHcNu: 6_500, vacanceSemaines: 0 }),
    );
    const ff = calculerFiscalite(gros, calculerFinancement(gros, regles), regles);
    expect(ff.regimes.micro_bic.eligible).toBe(false);
    expect(ff.regimes.micro_foncier.eligible).toBe(false);
    expect(['lmnp_reel', 'nu_reel']).toContain(ff.meilleur);
    expect(['lmnp_reel', 'nu_reel']).toContain(ff.meilleurImpot);
  });
});
