import { describe, expect, it } from 'vitest';

import { projet92k } from '../../src/exemples/projet-92k';
import { projetExemple } from '../../src/exemples/t3-marseille';
import { calculerFinancement } from '../../src/financement';
import { REGIMES, calculerFiscalite } from '../../src/fiscalite';
import { bilanRegime } from '../../src/fiscalite/bilan';
import { obtenirRegles } from '../../src/regles';
import {
  amortissementsAReintegrer,
  calculerRevente,
  reventeDuRegime,
  reventeParRegime,
} from '../../src/revente';
import type { ResultatFinancement } from '../../src/financement';
import type { ResultatFiscalite } from '../../src/fiscalite/types';
import { parserComplet, type ProjetComplet, type ProjetEntree } from '../../src/schema';
import { FiscaliteResultatSchema } from '../../src/schema/resultats';

const regles = obtenirRegles('2026-09');

interface Calcul {
  readonly projet: ProjetComplet;
  readonly financement: ResultatFinancement;
  readonly fiscalite: ResultatFiscalite;
}

const aHorizon = (base: ProjetEntree, annees: number, evolutionAnnuelle: number): ProjetEntree => ({
  ...base,
  hypotheses: {
    ...base.hypotheses,
    revente: { ...base.hypotheses.revente, annees, evolutionAnnuelle },
  },
});

function calculer(entree: ProjetEntree): Calcul {
  const projet = parserComplet(entree);
  const financement = calculerFinancement(projet, regles);
  const fiscalite = calculerFiscalite(projet, financement, regles);
  return { projet, financement, fiscalite };
}

describe('amortissementsAReintegrer', () => {
  it('LMNP réel seulement : le micro-BIC et le nu ne déduisent aucun amortissement', () => {
    expect(
      amortissementsAReintegrer({ regime: 'lmnp_reel', amortissementsImmeubleDeduits: 12 }),
    ).toBe(12);
    for (const regime of ['micro_bic', 'micro_foncier', 'nu_reel'] as const) {
      expect(amortissementsAReintegrer({ regime, amortissementsImmeubleDeduits: 12 })).toBe(0);
    }
  });
});

/**
 * Cas de référence vérifié à la main : le projet 92K de l'audit (colocation meublée, 155 000 €,
 * frais d'acquisition réels 11 831,56 €, sans travaux) revendu à 10 ans, +2 %/an, agence 4,5 %,
 * diagnostics 1 100 €.
 *
 * - Valeur : 155 000 × 1,02¹⁰ = 188 944,14 € ; prix de cession : × 0,955 − 1 100 = 179 341,65 €.
 * - Prix d'acquisition majoré sans réintégration : 155 000 + max(11 831,56 ; 7,5 % = 11 625)
 *   + forfait travaux 15 % (≥ 5 ans) 23 250 = 190 081,56 € > prix de cession : aucune plus-value.
 * - Micro-BIC (et nu) : rien à réintégrer, impôt à la revente nul.
 * - LMNP réel : les amortissements du bâti déduits R (au plus 10 × 4 157,35 = 41 573,50 €) réduisent
 *   le prix majoré ; plus-value brute = R − 10 739,91 €. À 10 ans, abattements IR 30 % et PS 8,25 % :
 *   impôt = PV × (0,70 × 19 % + 0,9175 × 17,2 %) ; base IR sous 50 000 € : pas de surtaxe.
 */
describe('reventeParRegime — projet 92K revendu à 10 ans (calcul à la main)', () => {
  const { projet, financement, fiscalite } = calculer(aHorizon(projet92k, 10, 0.02));
  const reel = fiscalite.regimes.lmnp_reel;
  const micro = fiscalite.regimes.micro_bic;
  const valeur = 155_000 * 1.02 ** 10;
  const prixCession = valeur * 0.955 - 1_100;
  const majoreSansReintegration = 155_000 + 11_831.56 + 23_250;

  it('frais réels et prix de cession conformes au calcul à la main', () => {
    expect(financement.fraisAcquisition.total).toBeCloseTo(11_831.56, 2);
    expect(valeur).toBeCloseTo(188_944.14, 2);
    expect(prixCession).toBeCloseTo(179_341.65, 2);
    expect(reel.revente.plusValue.prixCession).toBeCloseTo(prixCession, 6);
  });

  it('micro-BIC : prix de cession sous le prix majoré, aucun impôt à la revente', () => {
    expect(micro.revente.plusValue.reintegration).toBe(0);
    expect(micro.revente.plusValue.prixAcquisitionMajore).toBeCloseTo(majoreSansReintegration, 2);
    expect(micro.revente.plusValue.plusValueBrute).toBe(0);
    expect(micro.impotRevente).toBe(0);
  });

  it('LMNP réel : la réintégration crée une plus-value imposée à 29,081 %', () => {
    const r = reel.amortissementsImmeubleDeduits;
    expect(r).toBeGreaterThan(20_000);
    expect(r).toBeLessThanOrEqual(41_573.5 + 1e-6);
    expect(reel.revente.plusValue.reintegration).toBe(r);
    const plusValue = r - (majoreSansReintegration - prixCession);
    expect(reel.revente.plusValue.plusValueBrute).toBeCloseTo(plusValue, 2);
    expect(reel.revente.plusValue.surtaxe).toBe(0);
    expect(reel.impotRevente).toBeCloseTo(plusValue * (0.7 * 0.19 + 0.9175 * 0.172), 2);
    expect(reel.impotRevente).toBeGreaterThan(0);
  });

  it('impôt total = exploitation + revente ; ce qui reste = cash-flow après impôt + cash net', () => {
    for (const regime of REGIMES) {
      const b = fiscalite.regimes[regime];
      expect(b.impotGlobal).toBeCloseTo(b.impotTotal + b.impotRevente, 8);
      expect(b.enrichissementFinal).toBeCloseTo(
        b.cashflowApresImpotTotal + b.revente.cashNetVendeur,
        8,
      );
    }
    // Même valeur et même crédit : les cash nets ne diffèrent que de l'impôt à la revente.
    expect(micro.revente.cashNetVendeur - reel.revente.cashNetVendeur).toBeCloseTo(
      reel.impotRevente,
      6,
    );
  });

  it('le plus avantageux au total laisse le plus d’argent parmi les régimes compatibles', () => {
    const candidats = fiscalite.compatibles.filter((r) => fiscalite.regimes[r].eligible);
    const plusHaut = Math.max(...candidats.map((r) => fiscalite.regimes[r].enrichissementFinal));
    expect(fiscalite.regimes[fiscalite.meilleurAuTotal].enrichissementFinal).toBe(plusHaut);
    expect(candidats).toContain(fiscalite.meilleurAuTotal);
  });

  it('reventeParRegime rend une revente par régime, identique à reventeDuRegime', () => {
    const projections = REGIMES.map((r) => fiscalite.regimes[r]);
    const reventes = reventeParRegime(projet, financement, projections, regles);
    for (const regime of REGIMES) {
      expect(reventes[regime]).toEqual(
        reventeDuRegime(projet, financement, fiscalite.regimes[regime], regles),
      );
      expect(reventes[regime]).toEqual(fiscalite.regimes[regime].revente);
    }
  });

  it('le résultat respecte le schéma de sortie', () => {
    expect(() => FiscaliteResultatSchema.parse(fiscalite)).not.toThrow();
  });
});

describe('non-régression : la revente du régime retenu ne change pas', () => {
  it('pour chaque régime retenu, Resultats.revente = la revente de ce régime', () => {
    const tous = calculer(projetExemple).fiscalite;
    for (const regime of REGIMES) {
      const entree: ProjetEntree = {
        ...projetExemple,
        hypotheses: {
          ...projetExemple.hypotheses,
          fiscalite: { ...projetExemple.hypotheses.fiscalite, regime },
        },
      };
      const { projet, financement, fiscalite } = calculer(entree);
      const revente = calculerRevente(projet, financement, fiscalite, regles);
      expect(revente).toEqual(fiscalite.regimes[regime].revente);
      expect(revente).toEqual(tous.regimes[regime].revente);
      expect(revente.plusValue.reintegration).toBe(
        regime === 'lmnp_reel' ? fiscalite.regimes.lmnp_reel.amortissementsImmeubleDeduits : 0,
      );
    }
  });
});

describe('seuils de détention', () => {
  it('revente à perte : aucun impôt à la revente, impôt total = impôt d’exploitation', () => {
    const { fiscalite } = calculer(aHorizon(projet92k, 10, -0.03));
    for (const regime of REGIMES) {
      const b = fiscalite.regimes[regime];
      expect(b.revente.plusValue.plusValueBrute).toBe(0);
      expect(b.impotRevente).toBe(0);
      expect(b.impotGlobal).toBe(b.impotTotal);
    }
  });

  it('22 ans : plus d’impôt sur le revenu, prélèvements sociaux sur 72 % de la plus-value', () => {
    const { fiscalite } = calculer(aHorizon(projet92k, 22, 0.03));
    for (const regime of REGIMES) {
      const pv = fiscalite.regimes[regime].revente.plusValue;
      expect(pv.plusValueBrute).toBeGreaterThan(0);
      expect(pv.impotIr).toBe(0);
      expect(pv.surtaxe).toBe(0);
      expect(fiscalite.regimes[regime].impotRevente).toBeCloseTo(
        pv.plusValueBrute * 0.72 * 0.172,
        6,
      );
    }
    expect(fiscalite.regimes.lmnp_reel.impotRevente).toBeGreaterThan(
      fiscalite.regimes.micro_bic.impotRevente,
    );
  });

  it('30 ans : exonération totale, même avec les amortissements réintégrés', () => {
    const { fiscalite } = calculer(aHorizon(projet92k, 30, 0.03));
    expect(fiscalite.regimes.lmnp_reel.revente.plusValue.reintegration).toBeGreaterThan(0);
    expect(fiscalite.regimes.lmnp_reel.revente.plusValue.plusValueBrute).toBeGreaterThan(0);
    for (const regime of REGIMES) expect(fiscalite.regimes[regime].impotRevente).toBe(0);
  });
});

describe('bilanRegime', () => {
  it('additionne les impôts et le cash net sans toucher à la projection', () => {
    const { fiscalite } = calculer(projetExemple);
    const b = bilanRegime(fiscalite.regimes.nu_reel, fiscalite.regimes.lmnp_reel.revente);
    expect(b.impotTotal).toBe(fiscalite.regimes.nu_reel.impotTotal);
    expect(b.impotRevente).toBe(fiscalite.regimes.lmnp_reel.revente.plusValue.impotTotal);
    expect(b.revente).toBe(fiscalite.regimes.lmnp_reel.revente);
  });
});
