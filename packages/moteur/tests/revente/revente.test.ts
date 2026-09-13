import { describe, expect, it } from 'vitest';

import { projetExemple } from '../../src/exemples/t3-marseille';
import { calculerFinancement } from '../../src/financement';
import { calculerFiscalite } from '../../src/fiscalite';
import { obtenirRegles } from '../../src/regles';
import {
  abattementsDetention,
  amortissementsAReintegrer,
  calculerRevente,
  fraisVente,
  plusValueImposable,
  tauxSurtaxe,
  valeurRevente,
} from '../../src/revente';
import { ProjetSchema, ReventeSchema, type ProjetEntree } from '../../src/schema';

const regles = obtenirRegles('2026-09');

describe('valeur et frais de vente', () => {
  it('155 000 € à +1,5 %/an sur 10 ans = 179 884 €', () => {
    expect(valeurRevente(155_000, 0.015, 10)).toBeCloseTo(155_000 * 1.015 ** 10, 6);
    expect(valeurRevente(155_000, 0.015, 10)).toBeCloseTo(179_884, 0);
    expect(valeurRevente(155_000, 0, 10)).toBe(155_000);
  });

  it('agence 4 % + diagnostics 500 €', () => {
    const f = fraisVente(179_887, ReventeSchema.parse({}));
    expect(f.agence).toBeCloseTo(7_195.5, 1);
    expect(f.diagnostics).toBe(500);
    expect(f.total).toBeCloseTo(7_695.5, 1);
  });
});

describe('abattements pour durée de détention', () => {
  it('rien avant 6 ans ; 8 ans : IR 18 %, PS 4,95 %', () => {
    expect(abattementsDetention(3, regles)).toEqual({ ir: 0, ps: 0 });
    const a8 = abattementsDetention(8, regles);
    expect(a8.ir).toBeCloseTo(0.18, 10);
    expect(a8.ps).toBeCloseTo(0.0495, 10);
  });

  it('IR exonéré à 22 ans (PS 28 %), PS exonérés à 30 ans', () => {
    const a22 = abattementsDetention(22, regles);
    expect(a22.ir).toBeCloseTo(1, 10);
    expect(a22.ps).toBeCloseTo(0.28, 10);
    expect(abattementsDetention(30, regles)).toEqual({ ir: 1, ps: 1 });
    expect(abattementsDetention(40, regles)).toEqual({ ir: 1, ps: 1 });
  });
});

describe('surtaxe', () => {
  it('0 jusqu’à 50 000 €, puis 2 % à 6 % par tranche', () => {
    expect(tauxSurtaxe(50_000, regles)).toBe(0);
    expect(tauxSurtaxe(60_000, regles)).toBe(0.02);
    expect(tauxSurtaxe(120_000, regles)).toBe(0.03);
    expect(tauxSurtaxe(300_000, regles)).toBe(0.06);
  });

  it('sans tranche applicable, rend 0', () => {
    const sansTranches = {
      ...regles,
      fiscalite: {
        ...regles.fiscalite,
        plusValue: { ...regles.fiscalite.plusValue, surtaxe: [{ jusqua: 60_000, taux: 0.02 }] },
      },
    };
    expect(tauxSurtaxe(70_000, sansTranches)).toBe(0);
  });
});

describe('plusValueImposable', () => {
  const base = {
    valeur: 250_000,
    fraisVente: 10_500,
    prixAcquisition: 155_000,
    fraisAcquisitionReels: 11_987,
    travauxReels: 6_000,
    annees: 10,
    amortissementsReintegres: 0,
  };

  it('retient le max entre frais réels et forfait 7,5 %, travaux réels et forfait 15 % (≥ 5 ans)', () => {
    const pv = plusValueImposable(base, regles);
    expect(pv.fraisRetenus).toBe(11_987); // > 11 625
    expect(pv.travauxRetenus).toBe(23_250); // forfait 15 % > 6 000
    expect(pv.prixAcquisitionMajore).toBe(155_000 + 11_987 + 23_250);
    expect(pv.prixCession).toBe(239_500);
    expect(pv.plusValueBrute).toBe(239_500 - 190_237);
  });

  it('applique les abattements à 10 ans (IR 30 %, PS 8,25 %) puis 19 % et 17,2 %', () => {
    const pv = plusValueImposable(base, regles);
    expect(pv.abattements.ir).toBeCloseTo(0.3, 10);
    expect(pv.baseIr).toBeCloseTo(pv.plusValueBrute * 0.7, 6);
    expect(pv.basePs).toBeCloseTo(pv.plusValueBrute * (1 - 0.0825), 6);
    expect(pv.impotIr).toBeCloseTo(pv.baseIr * 0.19, 6);
    expect(pv.impotPs).toBeCloseTo(pv.basePs * 0.172, 6);
    expect(pv.surtaxe).toBe(0);
    expect(pv.impotTotal).toBeCloseTo(pv.impotIr + pv.impotPs, 8);
  });

  it('avant 5 ans : pas de forfait travaux, les travaux réels comptent', () => {
    const pv = plusValueImposable({ ...base, annees: 3 }, regles);
    expect(pv.travauxRetenus).toBe(6_000);
    expect(pv.abattements).toEqual({ ir: 0, ps: 0 });
  });

  it('réintègre les amortissements, ce qui augmente la plus-value', () => {
    const sans = plusValueImposable(base, regles);
    const avec = plusValueImposable({ ...base, amortissementsReintegres: 40_000 }, regles);
    expect(avec.reintegration).toBe(40_000);
    expect(avec.plusValueBrute).toBeCloseTo(sans.plusValueBrute + 40_000, 6);
    expect(avec.impotTotal).toBeGreaterThan(sans.impotTotal);
  });

  it('plus-value négative : aucun impôt, aucune surtaxe', () => {
    const pv = plusValueImposable({ ...base, valeur: 150_000 }, regles);
    expect(pv.plusValueBrute).toBe(0);
    expect(pv.impotTotal).toBe(0);
    expect(pv.surtaxe).toBe(0);
  });

  it('grosse plus-value : la surtaxe s’applique sur la base IR', () => {
    const pv = plusValueImposable({ ...base, valeur: 400_000, annees: 2 }, regles);
    expect(pv.baseIr).toBeGreaterThan(150_000);
    expect(pv.surtaxe).toBeCloseTo(pv.baseIr * tauxSurtaxe(pv.baseIr, regles), 6);
    expect(pv.surtaxe).toBeGreaterThan(0);
  });
});

describe('calculerRevente — T3 Marseille', () => {
  const projet = ProjetSchema.parse(projetExemple);
  const financement = calculerFinancement(projet, regles);
  const fiscalite = calculerFiscalite(projet, financement, regles);
  const r = calculerRevente(projet, financement, fiscalite, regles);

  it('assemble valeur, frais, CRD, IRA et impôt en un cash net vendeur', () => {
    expect(r.annees).toBe(10);
    expect(r.valeur).toBeCloseTo(179_884, 0);
    expect(r.crd).toBe(financement.crdRevente);
    expect(r.ira).toBe(financement.iraRevente);
    expect(r.cashNetVendeur).toBeCloseTo(
      r.valeur - r.fraisVente.total - r.crd - r.ira - r.plusValue.impotTotal,
      8,
    );
    expect(r.cashNetVendeur).toBeGreaterThan(40_000);
    expect(r.cashNetVendeur).toBeLessThan(70_000);
  });

  it('réintègre les amortissements de l’immeuble car le LMNP réel est retenu', () => {
    expect(r.plusValue.reintegration).toBe(
      fiscalite.regimes.lmnp_reel.amortissementsImmeubleDeduits,
    );
    expect(r.plusValue.reintegration).toBeGreaterThan(0);
  });

  it('ne réintègre rien en micro-BIC ou en nu', () => {
    const enMicro: ProjetEntree = {
      ...projetExemple,
      hypotheses: {
        ...projetExemple.hypotheses,
        fiscalite: { ...projetExemple.hypotheses.fiscalite, regime: 'micro_bic' },
      },
    };
    const p = ProjetSchema.parse(enMicro);
    const f = calculerFiscalite(p, calculerFinancement(p, regles), regles);
    expect(amortissementsAReintegrer(f)).toBe(0);
    expect(
      calculerRevente(p, calculerFinancement(p, regles), f, regles).plusValue.reintegration,
    ).toBe(0);
  });
});
