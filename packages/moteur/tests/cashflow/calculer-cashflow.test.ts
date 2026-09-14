import { describe, expect, it } from 'vitest';

import { calculerCashflow } from '../../src/cashflow';
import { projetExemple } from '../../src/exemples/t3-marseille';
import { calculerFinancement } from '../../src/financement';
import { obtenirRegles } from '../../src/regles';
import { ProjetSchema, type Location, type ProjetEntree } from '../../src/schema';

const regles = obtenirRegles('2026-09');
const projet = ProjetSchema.parse(projetExemple);
const financement = calculerFinancement(projet, regles);

const variante = (
  hypotheses: Partial<ProjetEntree['hypotheses']>,
): ReturnType<typeof ProjetSchema.parse> =>
  ProjetSchema.parse({
    ...projetExemple,
    hypotheses: { ...projetExemple.hypotheses, ...hypotheses },
  });

/** La location meublée de l'exemple avec un autre loyer (point mort, surcharges). */
const meubleA = (loyerHc: number, gestionTaux = 0): Location => ({
  mode: 'meuble',
  loyerHc,
  chargesLocataire: 60,
  vacanceSemaines: 3,
  gestionTaux,
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
    const equilibre = calculerCashflow(projet, financement, { location: meubleA(cf.pointMort!) });
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

  it('une location nue avec le loyer nu : recettes et charges du nu', () => {
    const cf = calculerCashflow(projet, financement, {
      regime: 'nu_reel',
      location: {
        mode: 'nu',
        loyerHc: 850,
        chargesLocataire: 0,
        vacanceSemaines: 3,
        gestionTaux: 0,
      },
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

  it('courte durée : pas de point mort, recettes issues des nuitées, couverture sur les nuitées', () => {
    const p = variante({
      location: { mode: 'courte_duree', nuitee: 90, nuiteesParMois: 19.5, conciergerieTaux: 0.2 },
    });
    const f = calculerFinancement(p, regles);
    const cf = calculerCashflow(p, f);
    expect(cf.pointMort).toBeNull();
    expect(cf.recettes.nuitees).toBe(234);
    expect(cf.tauxCouverture).toBeCloseTo(f.mensualiteTotale / (90 * 19.5), 10);
    expect(cf.charges.find((l) => l.code === 'conciergerie')?.annuel).toBeCloseTo(
      90 * 234 * 0.2,
      6,
    );
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
    const equilibre = calculerCashflow(p, f, {
      location: {
        mode: 'nu',
        loyerHc: cf.pointMort!,
        chargesLocataire: 0,
        vacanceSemaines: 3,
        gestionTaux: 0.08,
      },
    });
    expect(Math.abs(equilibre.mensuel)).toBeLessThan(0.5);
  });

  it('colocation : le point mort est le loyer total qui équilibre, forfaits déjà encaissés', () => {
    const p = variante({
      location: {
        mode: 'colocation',
        chambres: 4,
        loyerChambre: 460,
        forfaitChargesChambre: 55,
        gestionTaux: 0.08,
      },
      charges: { ...projetExemple.hypotheses.charges, energieMensuel: 190, internetMensuel: 30 },
    });
    const f = calculerFinancement(p, regles);
    const cf = calculerCashflow(p, f);
    expect(cf.pointMort).not.toBeNull();
    const equilibre = calculerCashflow(p, f, {
      location: {
        mode: 'colocation',
        chambres: 4,
        loyerChambre: cf.pointMort! / 4,
        forfaitChargesChambre: 55,
        vacanceSemaines: 4,
        gestionTaux: 0.08,
      },
    });
    expect(Math.abs(equilibre.mensuel)).toBeLessThan(0.5);
    expect(cf.charges.find((l) => l.code === 'energie')?.annuel).toBe(2_280);
  });

  it('moyenne durée : le point mort équilibre aussi avec plateforme et ménage', () => {
    const p = variante({
      location: {
        mode: 'moyenne_duree',
        loyerHc: 900,
        forfaitCharges: 120,
        plateformeTaux: 0.05,
        menageCoutParSejour: 80,
      },
    });
    const f = calculerFinancement(p, regles);
    const cf = calculerCashflow(p, f);
    const equilibre = calculerCashflow(p, f, {
      location: {
        mode: 'moyenne_duree',
        loyerHc: cf.pointMort!,
        forfaitCharges: 120,
        dureeSejourMois: 4,
        vacanceSemaines: 4,
        menageCoutParSejour: 80,
        plateformeTaux: 0.05,
        gestionTaux: 0,
      },
    });
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
