import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { calculerProjet } from '../../src/calculer-projet';
import { van } from '../../src/commun/flux';
import { projet92k } from '../../src/exemples/projet-92k';
import { tableauAmortissement } from '../../src/financement';
import { taeg } from '../../src/financement/taeg';
import { tri } from '../../src/rendement/tri';
import type { ProjetEntree } from '../../src/schema/projet';

/**
 * Propriétés du moteur vérifiées sur des entrées tirées au hasard (fast-check) : ce qui doit rester
 * vrai quels que soient les chiffres. Nombre de tirages limité : le PC de développement est lent.
 */

const pret = fc.record({
  capital: fc.integer({ min: 10_000, max: 800_000 }),
  tauxAnnuel: fc.double({ min: 0.001, max: 0.08, noNaN: true }),
  dureeMois: fc.integer({ min: 5, max: 30 }).map((a) => a * 12),
  tauxAssurance: fc.double({ min: 0, max: 0.005, noNaN: true }),
});

describe('propriétés — tableau d’amortissement', () => {
  it('le capital amorti égale le capital emprunté et le capital restant dû décroît jusqu’à zéro', () => {
    fc.assert(
      fc.property(pret, (p) => {
        const t = tableauAmortissement({ ...p, differeTotalMois: 0, differePartielMois: 0 });
        const amorti = t.reduce((acc, l) => acc + l.capital, 0);
        expect(amorti).toBeCloseTo(p.capital, 4);
        for (let i = 1; i < t.length; i += 1) {
          expect(t[i]!.crdFin).toBeLessThan(t[i - 1]!.crdFin);
        }
        expect(Math.abs(t.at(-1)!.crdFin)).toBeLessThan(1e-4);
      }),
      { numRuns: 40 },
    );
  });

  it('le TAEG hors assurance est supérieur ou égal au taux nominal dès qu’il y a des frais', () => {
    fc.assert(
      fc.property(pret, fc.integer({ min: 0, max: 5_000 }), (p, frais) => {
        const t = tableauAmortissement({ ...p, differeTotalMois: 0, differePartielMois: 0 });
        const taux = taeg(p.capital - frais, t, false);
        expect(taux).not.toBeNull();
        // Taux nominal mensuel capitalisé : borne basse du taux actuariel sans frais.
        expect(taux!).toBeGreaterThanOrEqual((1 + p.tauxAnnuel / 12) ** 12 - 1 - 1e-9);
      }),
      { numRuns: 30 },
    );
  });
});

/**
 * Le TRI est une racine de la VAN : juste avant et juste après le taux trouvé, la VAN change de signe.
 * On ne teste pas « VAN ≈ 0 » en euros : pour un TRI très négatif, la VAN varie de plusieurs dizaines
 * d'euros par millionième de taux, et un reste de quelques millièmes d'euro n'est qu'un arrondi machine.
 */
function encadreUneRacine(serie: readonly number[], taux: number): boolean {
  const ecart = 1e-6;
  const avant = van(serie, taux - ecart);
  const apres = van(serie, taux + ecart);
  return van(serie, taux) === 0 || Math.sign(avant) !== Math.sign(apres);
}

describe('propriétés — TRI', () => {
  it('le TRI trouvé est une racine de la valeur actuelle nette', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1_000, max: 100_000 }),
        fc.array(fc.integer({ min: -5_000, max: 20_000 }), { minLength: 1, maxLength: 25 }),
        fc.integer({ min: 0, max: 200_000 }),
        (mise, flux, sortie) => {
          const serie = [-mise, ...flux.slice(0, -1), (flux.at(-1) ?? 0) + sortie];
          const taux = tri(serie);
          if (taux !== null) expect(encadreUneRacine(serie, taux)).toBe(true);
        },
      ),
      { numRuns: 60 },
    );
  });

  it('TRI très négatif (−80 %) : racine encadrée même si la VAN au taux trouvé reste à 0,001 €', () => {
    // Tirage de la CI du 14/09/2026 (graine −1848825631) : VAN −42,82 € et +42,82 € à ±1e-6 du taux.
    const serie = [-1_012, 15_421, 272, 7_076, 9_819, -2_251];
    const taux = tri(serie)!;
    expect(taux).toBeCloseTo(-0.8017, 4);
    expect(encadreUneRacine(serie, taux)).toBe(true);
  });
});

interface Variante {
  readonly loyerChambre: number;
  readonly tauxNominal: number;
  readonly apport: number;
  readonly coproAnnuel: number;
  readonly vacanceSemaines: number;
  readonly regime: 'micro_bic' | 'lmnp_reel';
  readonly annees: number;
  readonly tmi: 0 | 0.11 | 0.3 | 0.41 | 0.45;
}

/** Variantes du projet 92K : loyer, taux, apport, charges, régime et horizon tirés au hasard. */
const variante: fc.Arbitrary<Variante> = fc.record({
  loyerChambre: fc.integer({ min: 150, max: 900 }),
  tauxNominal: fc.double({ min: 0.005, max: 0.06, noNaN: true }),
  apport: fc.integer({ min: 0, max: 60_000 }),
  coproAnnuel: fc.integer({ min: 0, max: 4_000 }),
  vacanceSemaines: fc.integer({ min: 0, max: 12 }),
  regime: fc.constantFrom('micro_bic' as const, 'lmnp_reel' as const),
  annees: fc.integer({ min: 1, max: 30 }),
  tmi: fc.constantFrom(0 as const, 0.11 as const, 0.3 as const, 0.41 as const, 0.45 as const),
});

function projetVariante(v: Variante): ProjetEntree {
  const h = projet92k.hypotheses;
  return {
    ...projet92k,
    hypotheses: {
      ...h,
      pret: { ...h.pret, apport: v.apport, tauxNominal: v.tauxNominal },
      location: {
        mode: 'colocation',
        chambres: 4,
        loyerChambre: v.loyerChambre,
        vacanceSemaines: v.vacanceSemaines,
      },
      charges: { ...h.charges, coproAnnuel: v.coproAnnuel },
      fiscalite: { tmi: v.tmi, regime: v.regime },
      revente: { ...h.revente, annees: v.annees },
    },
  };
}

describe('propriétés — rapport complet', () => {
  it('cash-flow avant impôt = recettes − charges − crédit, impôt des régimes meublés jamais négatif', () => {
    fc.assert(
      fc.property(variante, (v) => {
        const r = calculerProjet(projetVariante(v), { avecScenarios: false });
        if (!r.complet) throw new Error('complet attendu');
        for (const a of r.cashflow.parAnnee) {
          expect(a.avantImpot).toBeCloseTo(a.recettes - a.charges - a.credit, 6);
        }
        for (const regime of ['micro_bic', 'lmnp_reel'] as const) {
          const { annees, cashflow } = r.fiscalite.regimes[regime];
          annees.forEach((a, i) => {
            expect(a.impot).toBeGreaterThanOrEqual(0);
            expect(a.baseImposable).toBeGreaterThanOrEqual(0);
            expect(a.cashflowApresImpot).toBeCloseTo(cashflow.parAnnee[i]!.avantImpot - a.impot, 6);
          });
        }
        expect(r.revente.plusValue.impotTotal).toBeGreaterThanOrEqual(0);
        expect(r.rendement.flux).toHaveLength(v.annees + 1);
      }),
      { numRuns: 25 },
    );
  });

  it('LMNP réel : les amortissements déduits ne dépassent jamais les dotations cumulées', () => {
    fc.assert(
      fc.property(variante, (v) => {
        const r = calculerProjet(projetVariante({ ...v, regime: 'lmnp_reel' }), {
          avecScenarios: false,
        });
        if (!r.complet) throw new Error('complet attendu');
        const lmnp = r.fiscalite.regimes.lmnp_reel;
        const deduits = lmnp.annees.reduce((acc, a) => acc + a.amortissementsDeduits, 0);
        const reportes = lmnp.annees.at(-1)!.stocks.amortissementsReportes;
        // Bâti 124 100 € sur 50 et 20 ans, mobilier 8 000 € sur 7 ans : dotations des N premières années.
        const dotations = Array.from({ length: v.annees }, (_, i) => {
          const annee = i + 1;
          return (
            (124_100 * 0.55) / 50 +
            (annee <= 20 ? (124_100 * 0.45) / 20 : 0) +
            (annee <= 7 ? 8_000 / 7 : 0)
          );
        }).reduce((acc, d) => acc + d, 0);
        expect(deduits + reportes).toBeCloseTo(dotations, 4);
      }),
      { numRuns: 25 },
    );
  });
});
