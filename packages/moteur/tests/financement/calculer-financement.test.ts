import { describe, expect, it } from 'vitest';

import { projetExemple } from '../../src/exemples/t3-marseille';
import { calculerFinancement, echeancier } from '../../src/financement';
import { obtenirRegles } from '../../src/regles';
import { ProjetSchema, type ProjetEntree } from '../../src/schema';

const regles = obtenirRegles('2026-09');
const projet = ProjetSchema.parse(projetExemple);

const avecPret = (pret: Partial<ProjetEntree['hypotheses']['pret']>): ProjetEntree => ({
  ...projetExemple,
  hypotheses: { ...projetExemple.hypotheses, pret: { ...projetExemple.hypotheses.pret, ...pret } },
});

describe('calculerFinancement — T3 Marseille', () => {
  const f = calculerFinancement(projet, regles);

  it('emprunte prix + travaux + frais − apport = 161 000 €', () => {
    // 155 000 + 6 000 + 11 987 + 850 + 1 500 − 14 337
    expect(f.montantEmprunte).toBeCloseTo(161_000, 0);
    expect(f.miseDeDepart).toBe(14_337 + 5_000);
    expect(f.coutTotalProjet).toBeCloseTo(155_000 + 11_987 + 6_000 + 5_000 + 2_350, 0);
  });

  it('mensualité 793 € + assurance 34 € = 827 €', () => {
    expect(f.mensualiteHorsAssurance).toBeCloseTo(793.1, 1);
    expect(f.assuranceMensuelle).toBeCloseTo(33.5, 1);
    expect(f.mensualiteTotale).toBeCloseTo(826.65, 1);
  });

  it('coût total du crédit = intérêts + assurance + frais bancaires', () => {
    expect(f.totalInterets).toBeCloseTo(793.1 * 300 - 161_000, -1);
    expect(f.totalAssurance).toBeCloseTo(f.assuranceMensuelle * 300, 6);
    expect(f.totalAssurance).toBeCloseTo(10_062.5, 0);
    expect(f.coutTotalCredit).toBeCloseTo(f.totalInterets + f.totalAssurance + 2_350, 6);
  });

  it('TAEG : nominal < hors assurance < avec assurance < usure', () => {
    expect(f.taegHorsAssurance!).toBeGreaterThan(0.0335);
    expect(f.taegAvecAssurance!).toBeGreaterThan(f.taegHorsAssurance!);
    expect(f.taegAvecAssurance!).toBeLessThan(0.042);
    expect(f.tauxUsureDepasse).toBe(false);
  });

  it('effort HCSF ≈ 25,2 %', () => {
    expect(f.effort.hcsf).toBeCloseTo(0.252, 3);
    expect(f.effort.depasseHcsf).toBe(false);
  });

  it('CRD et IRA à la revente (10 ans) cohérents avec le tableau', () => {
    expect(f.crdRevente).toBeCloseTo(f.parAnnee[9]?.crdFin ?? 0, 8);
    expect(f.crdRevente).toBeGreaterThan(110_000);
    expect(f.crdRevente).toBeLessThan(115_000);
    expect(f.iraRevente).toBeCloseTo(((f.crdRevente * 0.0335) / 12) * 6, 6);
  });

  it('a un échéancier à une seule période sans différé', () => {
    expect(f.echeancier).toEqual([
      {
        phase: 'amortissement',
        deMois: 1,
        aMois: 300,
        mensualiteHorsAssurance: f.mensualiteHorsAssurance,
        mensualiteTotale: f.mensualiteTotale,
      },
    ]);
  });
});

describe('calculerFinancement — cas limites', () => {
  it('apport couvrant tout : aucun emprunt, aucune mensualité, TAEG null', () => {
    const f = calculerFinancement(ProjetSchema.parse(avecPret({ apport: 500_000 })), regles);
    expect(f.montantEmprunte).toBe(0);
    expect(f.tableau).toEqual([]);
    expect(f.mensualiteTotale).toBe(0);
    expect(f.taegAvecAssurance).toBeNull();
    expect(f.crdRevente).toBe(0);
    expect(f.iraRevente).toBe(0);
    expect(f.tauxUsureDepasse).toBe(false);
  });

  it('différé total puis partiel : trois périodes dans l’échéancier', () => {
    const f = calculerFinancement(
      ProjetSchema.parse(avecPret({ differeTotalMois: 12, differePartielMois: 12 })),
      regles,
    );
    expect(f.echeancier.map((e) => [e.phase, e.deMois, e.aMois])).toEqual([
      ['differe_total', 1, 12],
      ['differe_partiel', 13, 24],
      ['amortissement', 25, 300],
    ]);
    expect(f.echeancier[0]?.mensualiteHorsAssurance).toBe(0);
    expect(f.echeancier[0]?.mensualiteTotale).toBeCloseTo(f.assuranceMensuelle, 8);
    expect(f.mensualiteHorsAssurance).toBeGreaterThan(793.1);
  });

  it('signale un TAEG au-dessus du taux d’usure', () => {
    const f = calculerFinancement(ProjetSchema.parse(avecPret({ tauxNominal: 0.06 })), regles);
    expect(f.tauxUsureDepasse).toBe(true);
  });

  it('echeancier vide pour un tableau vide', () => {
    expect(echeancier([])).toEqual([]);
  });
});
