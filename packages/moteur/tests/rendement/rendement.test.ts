import { describe, expect, it } from 'vitest';

import { van } from '../../src/commun/flux';
import { projetExemple } from '../../src/exemples/t3-marseille';
import { calculerFinancement } from '../../src/financement';
import { calculerFiscalite } from '../../src/fiscalite';
import { obtenirRegles } from '../../src/regles';
import { calculerRendement, enrichissement, rendements, tri } from '../../src/rendement';
import { calculerRevente } from '../../src/revente';
import { parserComplet, type ProjetEntree } from '../../src/schema';

const regles = obtenirRegles('2026-09');

describe('rendements', () => {
  it('brut, net et net-net sur le coût total', () => {
    const r = rendements({
      coutTotal: 172_987,
      loyersBruts: 11_760,
      loyersNets: 11_081.5,
      chargesAnnuelles: 3_685,
      interetsAnnee1: 5_300,
      assuranceAnnee1: 402.5,
      impotAnnee1: 0,
    });
    expect(r.coutTotal).toBe(172_987);
    expect(r.brut).toBeCloseTo(0.068, 3);
    expect(r.net).toBeCloseTo((11_081.5 - 3_685) / 172_987, 10);
    expect(r.netNet).toBeCloseTo((11_081.5 - 3_685 - 5_300 - 402.5) / 172_987, 10);
  });
});

describe('tri', () => {
  it('−100 puis +110 un an plus tard : 10 %', () => {
    expect(tri([-100, 110])).toBeCloseTo(0.1, 8);
  });

  it('annule la VAN', () => {
    const flux = [
      -19_337, -2_500, -2_500, -2_500, -2_500, -2_500, -2_500, -2_500, -2_500, -2_500, 43_000,
    ];
    const taux = tri(flux)!;
    expect(Math.abs(van(flux, taux))).toBeLessThan(1e-4);
  });

  it('rend null sans entrée ou sans sortie', () => {
    expect(tri([-100, -50, -20])).toBeNull();
    expect(tri([100, 50])).toBeNull();
    expect(tri([])).toBeNull();
  });

  it('rend null quand la VAN ne change pas de signe sur l’intervalle exploré', () => {
    // +1 puis −1 000 000 : la VAN est négative pour tout taux > −99 %.
    expect(tri([1, -1_000_000])).toBeNull();
  });
});

describe('enrichissement', () => {
  it('les deux décompositions coïncident', () => {
    const e = enrichissement({
      miseDeDepart: 19_337,
      cashflowsApresImpot: [-2_500, -2_400, -2_300],
      montantEmprunte: 161_000,
      crdRevente: 140_000,
      valeurRevente: 165_000,
      fraisVente: 7_000,
      ira: 2_000,
      impotPlusValue: 0,
      cashNetVendeur: 165_000 - 7_000 - 140_000 - 2_000,
    });
    expect(e.cashflowsCumules).toBe(-7_200);
    expect(e.capitalRembourse).toBe(21_000);
    expect(e.total).toBeCloseTo(16_000 - 7_200 - 19_337, 8);
    expect(e.capitalRembourse + e.plusValueNette + e.cashflowsCumules).toBeCloseTo(e.total, 8);
  });
});

describe('calculerRendement — T3 Marseille', () => {
  const projet = parserComplet(projetExemple);
  const financement = calculerFinancement(projet, regles);
  const fiscalite = calculerFiscalite(projet, financement, regles);
  const revente = calculerRevente(projet, financement, fiscalite, regles);
  const r = calculerRendement(projet, financement, fiscalite, revente);

  it('brut 6,8 %, net ≈ 4,3 %, net-net plus bas', () => {
    expect(r.rendements.coutTotal).toBeCloseTo(155_000 + 6_000 + 11_987, 0);
    expect(r.rendements.brut).toBeCloseTo(0.068, 3);
    expect(r.rendements.net).toBeCloseTo((11_760 * (49 / 52) - 3_685) / r.rendements.coutTotal, 10);
    expect(r.rendements.netNet).toBeLessThan(r.rendements.net);
  });

  it('construit les flux : mise en 0, dix cash-flows, revente ajoutée la dernière année', () => {
    expect(r.flux).toHaveLength(11);
    expect(r.flux[0]).toBe(-19_337);
    expect(r.cashflowsApresImpot).toHaveLength(10);
    expect(r.flux[10]).toBeCloseTo((r.cashflowsApresImpot[9] ?? 0) + revente.cashNetVendeur, 8);
    expect(r.flux[5]).toBe(r.cashflowsApresImpot[4]);
  });

  it('le TRI annule la VAN et reste modeste sur ce projet', () => {
    expect(r.tri).not.toBeNull();
    expect(Math.abs(van(r.flux, r.tri!))).toBeLessThan(1e-3);
    expect(r.tri!).toBeGreaterThan(-0.1);
    expect(r.tri!).toBeLessThan(0.15);
  });

  it('l’enrichissement recoupe cash net + cash-flows − mise', () => {
    const e = r.enrichissement;
    expect(e.total).toBeCloseTo(revente.cashNetVendeur + e.cashflowsCumules - 19_337, 6);
    expect(e.capitalRembourse).toBeCloseTo(161_000 - revente.crd, 0);
  });

  it('sans emprunt, les flux n’ont ni intérêts ni assurance', () => {
    const cash: ProjetEntree = {
      ...projetExemple,
      hypotheses: {
        ...projetExemple.hypotheses,
        pret: { ...projetExemple.hypotheses.pret, apport: 500_000 },
      },
    };
    const p = parserComplet(cash);
    const f = calculerFinancement(p, regles);
    const fisc = calculerFiscalite(p, f, regles);
    const rr = calculerRendement(p, f, fisc, calculerRevente(p, f, fisc, regles));
    expect(rr.rendements.netNet).toBeCloseTo(
      rr.rendements.net - fisc.regimes.lmnp_reel.annees[0]!.impot / rr.rendements.coutTotal,
      10,
    );
    expect(rr.enrichissement.capitalRembourse).toBe(0);
  });
});
