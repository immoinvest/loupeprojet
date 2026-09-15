import {
  calculerProjet,
  projetExemple,
  type ProjetEntree,
  type ResultatsComplets,
} from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import { cascadeAutofinancement, multipleSurApport } from '@/analyses/rapport';

import { courteDuree, variante } from './projets';

/** Ces projets ont tous un loyer : leur rapport est complet. */
function calculer(projet: ProjetEntree): ResultatsComplets {
  const r = calculerProjet(projet);
  if (!r.complet) throw new Error('rapport partiel inattendu');
  return r;
}

describe('cascade de l’autofinancement', () => {
  it('reproduit les chiffres du projet d’exemple, ligne par ligne', () => {
    const c = cascadeAutofinancement(calculer(projetExemple));
    expect(c.loyer).toBe(980);
    expect(c.credit).toBeCloseTo(826.65, 2);
    expect(c.apresCredit).toBeCloseTo(153.35, 2);
    expect(c.charges).toBeCloseTo(307.08, 2);
    expect(c.vacance).toBeCloseTo(56.54, 2);
    expect(c.recuperees).toBe(0);
    expect(c.apresCharges).toBeCloseTo(-210.27, 2);
    // Meublé au réel : aucun impôt sur dix ans.
    expect(c.impot).toBe(0);
    expect(c.apresImpot).toBeCloseTo(-210.27, 2);
  });

  it('somme exactement au cash-flow mensuel du moteur, en longue et en courte durée', () => {
    for (const projet of [projetExemple, courteDuree()]) {
      const r = calculer(projet);
      const c = cascadeAutofinancement(r);
      expect(c.loyer + c.recuperees - c.credit - c.charges - c.vacance).toBeCloseTo(
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

  it('en courte durée : ménage facturé en recettes, ménage payé et conciergerie en charges, pas de vacance', () => {
    const r = calculer(courteDuree());
    const c = cascadeAutofinancement(r);
    expect(c.vacance).toBe(0);
    // 18,25 nuits × 12 ÷ 4 nuits = 54,75 séjours × 25 € facturés.
    expect(c.recuperees).toBeCloseTo((54.75 * 25) / 12, 6);
    expect(c.recuperees).toBeCloseTo(r.cashflow.recettes.chargesRecuperees / 12, 6);
    const ligne = (code: string): number =>
      r.cashflow.charges.find((l) => l.code === code)?.annuel ?? 0;
    expect(ligne('menage')).toBeCloseTo(54.75 * 40, 6);
    expect(ligne('conciergerie')).toBeGreaterThan(0);
  });

  it('un régime imposé retire l’impôt mensuel moyen sur la période', () => {
    const r = calculer(variante({ fiscalite: { tmi: 0.3, regime: 'micro_bic' } }));
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
    const r = calculer(projetExemple);
    expect(r.rendement.enrichissement.miseDeDepart).toBe(19_337);
    // 13 646,75 € − 417,86 € d'impôt sur les amortissements réintégrés (ordre d'imputation LMNP).
    expect(multipleSurApport(r)).toBeCloseTo(13_228.9 / 19_337, 4);
  });

  it('sans mise de départ : null', () => {
    const sansMise = {
      rendement: { enrichissement: { miseDeDepart: 0, total: 5_000 } },
    } as unknown as ResultatsComplets;
    expect(multipleSurApport(sansMise)).toBeNull();
  });
});
