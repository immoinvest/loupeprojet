import { describe, expect, it } from 'vitest';

import { calculerCashflow } from '../../src/cashflow';
import { projetExemple } from '../../src/exemples/t3-marseille';
import { calculerFinancement } from '../../src/financement';
import { obtenirRegles } from '../../src/regles';
import { parserComplet, type ProjetComplet, type ProjetEntree } from '../../src/schema';

const regles = obtenirRegles('2026-09');
const projet = parserComplet(projetExemple);
const financement = calculerFinancement(projet, regles);

const variante = (hypotheses: Partial<ProjetEntree['hypotheses']>): ProjetComplet =>
  parserComplet({
    ...projetExemple,
    hypotheses: { ...projetExemple.hypotheses, ...hypotheses },
  });

describe('calculerCashflow — T3 Marseille, réel meublé', () => {
  const cf = calculerCashflow(projet, financement);

  it('charges pleines 3 685 €/an', () => {
    expect(cf.regime).toBe('lmnp_reel');
    expect(cf.chargesAnnuelles).toBe(3_685);
  });

  it('cash-flow mensuel = (loyers nets − charges − crédit) / 12', () => {
    // loyers nets 11 760 × 49/52 = 11 081,5 ; crédit 826,65 × 12 = 9 919,8
    const attendu = (11_760 * (49 / 52) - 3_685 - financement.mensualiteTotale * 12) / 12;
    expect(cf.mensuel).toBeCloseTo(attendu, 6);
    expect(cf.mensuel).toBeCloseTo(-210.3, 0);
    expect(cf.mensuelHorsVacance).toBeCloseTo(980 - 3_685 / 12 - financement.mensualiteTotale, 6);
  });

  it('effort d’épargne = |cash-flow| et taux de couverture = 827 / 980 = 84 %', () => {
    expect(cf.effortEpargne).toBeCloseTo(-cf.mensuel, 10);
    expect(cf.tauxCouverture).toBeCloseTo(financement.mensualiteTotale / 980, 10);
    expect(cf.tauxCouverture).toBeCloseTo(0.844, 3);
  });

  it('le point mort équilibre exactement le cash-flow', () => {
    expect(cf.pointMort).not.toBeNull();
    expect(cf.pointMort!).toBeGreaterThan(980);
    const equilibre = calculerCashflow(projet, financement, { loyerHc: cf.pointMort! });
    expect(Math.abs(equilibre.mensuel)).toBeLessThan(0.5);
  });

  it('projette 10 années avec le crédit réellement payé', () => {
    expect(cf.parAnnee).toHaveLength(10);
    expect(cf.parAnnee[0]?.credit).toBeCloseTo(financement.mensualiteTotale * 12, 4);
    expect(cf.parAnnee[0]?.avantImpot).toBeCloseTo(cf.mensuel * 12, 4);
  });
});

describe('calculerCashflow — options et cas limites', () => {
  it('un autre régime change les charges (micro-BIC sans comptable)', () => {
    const cf = calculerCashflow(projet, financement, { regime: 'micro_bic' });
    expect(cf.chargesAnnuelles).toBe(3_685 - 420);
  });

  it('mode nu avec le loyer nu : recettes et charges du nu', () => {
    const cf = calculerCashflow(projet, financement, {
      regime: 'nu_reel',
      mode: 'nu',
      loyerHc: 850,
    });
    expect(cf.recettes.mode).toBe('nu');
    expect(cf.recettes.loyersBruts).toBe(10_200);
    expect(cf.chargesAnnuelles).toBe(3_685 - 420 - 180);
    expect(cf.tauxCouverture).toBeCloseTo(financement.mensualiteTotale / 850, 10);
  });

  it('loyer nul : taux de couverture null, cash-flow négatif', () => {
    const p = variante({ location: { mode: 'nu', loyerHc: 0 } });
    const cf = calculerCashflow(p, calculerFinancement(p, regles));
    expect(cf.tauxCouverture).toBeNull();
    expect(cf.mensuel).toBeLessThan(0);
  });

  it('courte durée : pas de point mort, recettes issues des nuitées', () => {
    const p = variante({
      location: {
        mode: 'courte_duree',
        loyerHc: 0,
        courteDuree: { nuitee: 90, tauxOccupation: 0.65, conciergerieTaux: 0.2 },
      },
    });
    const cf = calculerCashflow(p, calculerFinancement(p, regles));
    expect(cf.pointMort).toBeNull();
    expect(cf.recettes.courteDuree?.nuitees).toBeCloseTo(237.25, 6);
  });

  it('vacance de 52 semaines : point mort impossible (null)', () => {
    const p = variante({ location: { mode: 'nu', loyerHc: 800, vacanceSemaines: 52 } });
    const cf = calculerCashflow(p, calculerFinancement(p, regles));
    expect(cf.recettes.loyersNets).toBe(0);
    expect(cf.pointMort).toBeNull();
  });

  it('gestion déléguée : le point mort intègre la commission', () => {
    const p = variante({ location: { mode: 'nu', loyerHc: 800, gestionTaux: 0.08 } });
    const f = calculerFinancement(p, regles);
    const cf = calculerCashflow(p, f);
    const equilibre = calculerCashflow(p, f, { loyerHc: cf.pointMort! });
    expect(Math.abs(equilibre.mensuel)).toBeLessThan(0.5);
  });

  it('après la fin du prêt, le crédit annuel tombe à 0', () => {
    const p = variante({
      pret: { ...projetExemple.hypotheses.pret, dureeAnnees: 15 },
      revente: { annees: 20 },
    });
    const cf = calculerCashflow(p, calculerFinancement(p, regles));
    expect(cf.parAnnee).toHaveLength(20);
    expect(cf.parAnnee[14]?.credit).toBeGreaterThan(0);
    expect(cf.parAnnee[15]?.credit).toBe(0);
    expect(cf.parAnnee[19]?.avantImpot).toBeCloseTo(
      cf.recettes.loyersNets - cf.chargesAnnuelles,
      6,
    );
  });
});
