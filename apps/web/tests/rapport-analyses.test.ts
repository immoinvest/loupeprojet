import { calculerProjet, projetExemple, type Resultats } from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import { cascadeAutofinancement, multipleSurApport } from '@/analyses/rapport';

import { courteDuree, variante } from './projets';

describe('cascade de l’autofinancement', () => {
  it('reproduit les chiffres du projet d’exemple, ligne par ligne', () => {
    const c = cascadeAutofinancement(calculerProjet(projetExemple));
    expect(c.loyer).toBe(980);
    expect(c.credit).toBeCloseTo(826.65, 2);
    expect(c.apresCredit).toBeCloseTo(153.35, 2);
    expect(c.charges).toBeCloseTo(307.08, 2);
    expect(c.vacance).toBeCloseTo(56.54, 2);
    expect(c.fraisCourteDuree).toBe(0);
    expect(c.apresCharges).toBeCloseTo(-210.27, 2);
    // Meublé au réel : aucun impôt sur dix ans.
    expect(c.impot).toBe(0);
    expect(c.apresImpot).toBeCloseTo(-210.27, 2);
  });

  it('somme exactement au cash-flow mensuel du moteur, en longue et en courte durée', () => {
    for (const projet of [projetExemple, courteDuree()]) {
      const r = calculerProjet(projet);
      const c = cascadeAutofinancement(r);
      expect(c.loyer - c.credit - c.charges - c.vacance - c.fraisCourteDuree).toBeCloseTo(
        r.cashflow.mensuel,
        6,
      );
      expect(c.apresCharges).toBe(r.cashflow.mensuel);
      expect(c.apresCredit + c.apresImpot).toBeCloseTo(
        c.loyer - c.credit + c.apresCharges - c.impot,
        6,
      );
    }
  });

  it('en courte durée : ménage et conciergerie, pas de vacance', () => {
    const r = calculerProjet(courteDuree());
    const c = cascadeAutofinancement(r);
    expect(c.vacance).toBe(0);
    expect(c.fraisCourteDuree).toBeGreaterThan(0);
    const cd = r.cashflow.recettes.courteDuree;
    expect(cd).not.toBeNull();
    expect(c.fraisCourteDuree).toBeCloseTo((cd!.menage + cd!.conciergerie) / 12, 6);
  });

  it('un régime imposé retire l’impôt mensuel moyen sur la période', () => {
    const r = calculerProjet(variante({ fiscalite: { tmi: 0.3, regime: 'micro_bic' } }));
    const c = cascadeAutofinancement(r);
    expect(r.fiscalite.regimes.micro_bic.impotTotal).toBeCloseTo(26_928.14, 2);
    // Sans comptable, les charges baissent de 420 € par an : −175 € avant impôt.
    expect(c.apresCharges).toBeCloseTo(-175.27, 2);
    expect(c.impot).toBeCloseTo(224.4, 1);
    expect(c.apresImpot).toBeCloseTo(-399.68, 2);
  });
});

describe('multiple sur apport', () => {
  it('gain total ÷ mise de départ sur l’exemple', () => {
    const r = calculerProjet(projetExemple);
    expect(r.rendement.enrichissement.miseDeDepart).toBe(19_337);
    expect(multipleSurApport(r)).toBeCloseTo(13_646.75 / 19_337, 4);
  });

  it('sans mise de départ : null', () => {
    const sansMise = {
      rendement: { enrichissement: { miseDeDepart: 0, total: 5_000 } },
    } as unknown as Resultats;
    expect(multipleSurApport(sansMise)).toBeNull();
  });
});
