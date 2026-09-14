import { describe, expect, it } from 'vitest';

import { projetExemple } from '../../src/exemples/t3-marseille';
import { calculerFinancement } from '../../src/financement';
import { tableauAmortissement } from '../../src/financement/amortissement';
import { fraisAcquisition } from '../../src/financement/frais-acquisition';
import {
  OffrePretSchema,
  ProjetFinanceSchema,
  type OffrePret,
  type OffrePretEntree,
  type ProjetFinance,
  type ProjetFinanceEntree,
} from '../../src/pret/schema';
import { besoinFinancement, fraisBancaires, simulerPret } from '../../src/pret/simuler';
import { obtenirRegles } from '../../src/regles';
import { ProjetSchema } from '../../src/schema';

const regles = obtenirRegles('2026-09');

const projet = (p: Partial<ProjetFinanceEntree> = {}): ProjetFinance =>
  ProjetFinanceSchema.parse({ prix: 100_000, fraisNotaire: 0, ...p });

const offre = (o: Partial<OffrePretEntree> = {}): OffrePret =>
  OffrePretSchema.parse({ tauxNominal: 0.03, dureeAnnees: 20, ...o });

describe('simulerPret — cas de référence sans intérêts', () => {
  // 100 000 € à 0 % sur 20 ans, assurance 0,3 %, 1 500 € de frais bancaires payés comptant.
  const r = simulerPret(
    projet(),
    offre({ tauxNominal: 0, tauxAssurance: 0.003, fraisDossier: 500, fraisGarantie: 1_000 }),
    regles,
  );

  it('emprunte tout le prix et rembourse 100 000 ÷ 240 par mois', () => {
    expect(r.aEmprunter).toBe(true);
    expect(r.besoin).toBe(100_000);
    expect(r.montantEmprunte).toBe(100_000);
    expect(r.mensualiteHorsAssurance).toBeCloseTo(416.67, 2);
    expect(r.assuranceMensuelle).toBe(25);
    expect(r.mensualiteTotale).toBeCloseTo(441.67, 2);
  });

  it('ne coûte que l’assurance et les frais', () => {
    expect(r.totalInterets).toBe(0);
    expect(r.totalAssurance).toBeCloseTo(6_000, 6);
    expect(r.totalMensualites).toBeCloseTo(106_000, 6);
    expect(r.fraisBancaires).toBe(1_500);
    expect(r.coutTotalCredit).toBeCloseTo(7_500, 6);
  });

  it('a un TAEG positif (les frais) et plus haut avec l’assurance', () => {
    expect(r.taegHorsAssurance).not.toBeNull();
    expect(r.taegHorsAssurance!).toBeGreaterThan(0);
    expect(r.taegHorsAssurance!).toBeLessThan(0.002);
    expect(r.taegAvecAssurance!).toBeGreaterThan(r.taegHorsAssurance!);
    expect(r.tauxUsure).toBe(regles.credit.tauxUsure);
    expect(r.tauxUsureDepasse).toBe(false);
  });

  it('a 240 lignes, la dernière soldée, et une année de 12 mois', () => {
    expect(r.tableau).toHaveLength(240);
    expect(Math.abs(r.tableau[239]?.crdFin ?? 1)).toBeLessThan(0.01);
    expect(r.parAnnee).toHaveLength(20);
    expect(r.parAnnee[0]?.capital).toBeCloseTo(5_000, 6);
    expect(r.echeancier).toEqual([
      {
        phase: 'amortissement',
        deMois: 1,
        aMois: 240,
        mensualiteHorsAssurance: r.mensualiteHorsAssurance,
        mensualiteTotale: r.mensualiteTotale,
      },
    ]);
  });
});

describe('simulerPret — cas de référence vérifié à la main', () => {
  it('100 000 € à 12 % sur un an : 8 884,88 € par mois, 6 618,55 € d’intérêts', () => {
    const r = simulerPret(
      projet(),
      offre({ tauxNominal: 0.12, dureeAnnees: 1, tauxAssurance: 0 }),
      regles,
    );
    // 100 000 × 0,01 ÷ (1 − 1,01^−12)
    expect(r.mensualiteHorsAssurance).toBeCloseTo(8_884.88, 2);
    expect(r.totalInterets).toBeCloseTo(6_618.55, 2);
    expect(r.assuranceMensuelle).toBe(0);
    expect(r.totalAssurance).toBe(0);
    expect(r.coutTotalCredit).toBeCloseTo(6_618.55, 2);
    // Sans frais, le TAEG hors assurance est le taux nominal capitalisé mensuellement.
    expect(r.taegHorsAssurance!).toBeCloseTo(1.01 ** 12 - 1, 6);
    expect(r.taegAvecAssurance!).toBeCloseTo(r.taegHorsAssurance!, 8);
  });
});

describe('simulerPret — cohérence avec le rapport d’un projet', () => {
  it('donne, au centime, les chiffres de calculerFinancement sur le projet d’exemple', () => {
    const p = ProjetSchema.parse(projetExemple);
    const f = calculerFinancement(p, regles);
    const { achat, pret, revenusMensuels } = p.hypotheses;
    const r = simulerPret(
      projet({
        prix: achat.prix,
        honorairesAgence: achat.honorairesAgence,
        travaux: achat.travaux,
        fraisNotaire: fraisAcquisition(achat, p.bien.departement, regles).total,
        revenusMensuels,
      }),
      offre({
        apport: pret.apport,
        tauxNominal: pret.tauxNominal,
        dureeAnnees: pret.dureeAnnees,
        tauxAssurance: pret.tauxAssurance,
        fraisDossier: pret.fraisDossier,
        fraisGarantie: pret.fraisGarantie,
        fraisBancairesFinances: true,
      }),
      regles,
    );
    expect(r.montantEmprunte).toBeCloseTo(f.montantEmprunte, 2);
    expect(r.mensualiteHorsAssurance).toBeCloseTo(f.mensualiteHorsAssurance, 2);
    expect(r.assuranceMensuelle).toBeCloseTo(f.assuranceMensuelle, 2);
    expect(r.mensualiteTotale).toBeCloseTo(f.mensualiteTotale, 2);
    expect(r.totalInterets).toBeCloseTo(f.totalInterets, 2);
    expect(r.totalAssurance).toBeCloseTo(f.totalAssurance, 2);
    expect(r.coutTotalCredit).toBeCloseTo(f.coutTotalCredit, 2);
    expect(r.taegHorsAssurance!).toBeCloseTo(f.taegHorsAssurance!, 4);
    expect(r.taegAvecAssurance!).toBeCloseTo(f.taegAvecAssurance!, 4);
    expect(r.tableau).toEqual(f.tableau);
    expect(r.parAnnee).toEqual(f.parAnnee);
    expect(r.echeancier).toEqual(f.echeancier);
    expect(r.tauxUsureDepasse).toBe(f.tauxUsureDepasse);
  });
});

describe('simulerPret — différés', () => {
  const o = offre({ differeTotalMois: 12, differePartielMois: 6 });
  const r = simulerPret(projet(), o, regles);

  it('a trois phases dans l’échéancier', () => {
    expect(r.echeancier.map((e) => [e.phase, e.deMois, e.aMois])).toEqual([
      ['differe_total', 1, 12],
      ['differe_partiel', 13, 18],
      ['amortissement', 19, 240],
    ]);
    expect(r.echeancier[0]?.mensualiteHorsAssurance).toBe(0);
    expect(r.echeancier[1]?.mensualiteHorsAssurance).toBeCloseTo(
      (r.tableau[12]?.crdDebut ?? 0) * (0.03 / 12),
      8,
    );
  });

  it('reprend le tableau d’amortissement du moteur tel quel', () => {
    expect(r.tableau).toEqual(
      tableauAmortissement({
        capital: 100_000,
        tauxAnnuel: 0.03,
        dureeMois: 240,
        differeTotalMois: 12,
        differePartielMois: 6,
        tauxAssurance: 0.0025,
      }),
    );
    expect(r.mensualiteHorsAssurance).toBe(r.tableau[18]?.mensualite);
    expect(r.mensualiteHorsAssurance).toBeGreaterThan(
      simulerPret(projet(), offre(), regles).mensualiteHorsAssurance,
    );
  });
});

describe('simulerPret — l’apport couvre tout', () => {
  const p = projet({ fraisNotaire: 8_000 });
  const o = offre({ apport: 120_000, fraisDossier: 300, fraisGarantie: 200 });

  it('n’emprunte rien : tableau vide, mensualités nulles, TAEG absent, coût = frais bancaires', () => {
    const r = simulerPret(p, o, regles);
    expect(r.aEmprunter).toBe(false);
    expect(r.besoin).toBe(108_000);
    expect(r.montantEmprunte).toBe(0);
    expect(r.tableau).toEqual([]);
    expect(r.parAnnee).toEqual([]);
    expect(r.echeancier).toEqual([]);
    expect(r.mensualiteHorsAssurance).toBe(0);
    expect(r.assuranceMensuelle).toBe(0);
    expect(r.mensualiteTotale).toBe(0);
    expect(r.totalInterets).toBe(0);
    expect(r.totalAssurance).toBe(0);
    expect(r.totalMensualites).toBe(0);
    expect(r.coutTotalCredit).toBe(500);
    expect(r.taegHorsAssurance).toBeNull();
    expect(r.taegAvecAssurance).toBeNull();
    expect(r.tauxUsureDepasse).toBe(false);
    expect(r.endettement).toBeNull();
  });

  it('a un endettement nul avec des revenus', () => {
    expect(simulerPret({ ...p, revenusMensuels: 2_000 }, o, regles).endettement).toBe(0);
  });

  it('un apport égal au besoin n’emprunte rien non plus', () => {
    expect(simulerPret(p, offre({ apport: 108_000 }), regles).aEmprunter).toBe(false);
  });
});

describe('simulerPret — frais bancaires', () => {
  const comptant = offre({ fraisDossier: 800, fraisGarantie: 2_000 });
  const finances = { ...comptant, fraisBancairesFinances: true };

  it('financés : le montant emprunté grossit exactement des frais ; le coût les compte dans les deux cas', () => {
    const rc = simulerPret(projet(), comptant, regles);
    const rf = simulerPret(projet(), finances, regles);
    expect(fraisBancaires(comptant)).toBe(2_800);
    expect(besoinFinancement(projet(), comptant)).toBe(100_000);
    expect(besoinFinancement(projet(), finances)).toBe(102_800);
    expect(rf.montantEmprunte - rc.montantEmprunte).toBe(2_800);
    expect(rc.coutTotalCredit).toBeCloseTo(rc.totalInterets + rc.totalAssurance + 2_800, 8);
    expect(rf.coutTotalCredit).toBeCloseTo(rf.totalInterets + rf.totalAssurance + 2_800, 8);
    // Le capital net des frais est le même (100 000 € disponibles pour l'achat) : TAEG proches,
    // légèrement plus bas quand les frais sont financés (le capital est plus gros).
    expect(rf.taegHorsAssurance!).toBeLessThan(rc.taegHorsAssurance!);
    expect(rc.taegHorsAssurance!).toBeGreaterThan(0.03);
  });

  it('sans frais, le TAEG hors assurance est le taux nominal capitalisé', () => {
    const r = simulerPret(projet(), offre(), regles);
    expect(r.taegHorsAssurance!).toBeCloseTo((1 + 0.03 / 12) ** 12 - 1, 6);
  });
});

describe('simulerPret — usure et endettement', () => {
  it('signale un TAEG avec assurance au-dessus du taux d’usure des règles', () => {
    const r = simulerPret(projet(), offre({ tauxNominal: 0.06, tauxAssurance: 0.01 }), regles);
    expect(regles.credit.tauxUsure).toBe(0.0529);
    expect(r.taegAvecAssurance!).toBeGreaterThan(0.0529);
    expect(r.tauxUsureDepasse).toBe(true);
    expect(simulerPret(projet(), offre({ tauxNominal: 0.04 }), regles).tauxUsureDepasse).toBe(
      false,
    );
  });

  it('endettement = mensualité totale ÷ revenus ; absent sans revenus ou à revenus nuls', () => {
    const o = offre({ tauxNominal: 0, tauxAssurance: 0.003 });
    const r = simulerPret(projet({ revenusMensuels: 2_100 }), o, regles);
    // 441,67 ÷ 2 100
    expect(r.endettement).toBeCloseTo(0.2103, 4);
    expect(r.endettement).toBeCloseTo(r.mensualiteTotale / 2_100, 10);
    expect(simulerPret(projet(), o, regles).endettement).toBeNull();
    expect(simulerPret(projet({ revenusMensuels: 0 }), o, regles).endettement).toBeNull();
  });
});

describe('simulerPret — cas limites', () => {
  it('durée d’un an, travaux et frais de notaire financés', () => {
    const r = simulerPret(
      projet({ travaux: 10_000, fraisNotaire: 8_000 }),
      offre({ dureeAnnees: 1, apport: 18_000 }),
      regles,
    );
    expect(r.besoin).toBe(118_000);
    expect(r.montantEmprunte).toBe(100_000);
    expect(r.tableau).toHaveLength(12);
    expect(r.parAnnee).toHaveLength(1);
  });

  it('différés maximaux sur trois ans : une seule mensualité d’amortissement', () => {
    const r = simulerPret(
      projet(),
      offre({ dureeAnnees: 3, differeTotalMois: 35, differePartielMois: 0 }),
      regles,
    );
    expect(r.echeancier.map((e) => e.phase)).toEqual(['differe_total', 'amortissement']);
    expect(r.echeancier[1]).toMatchObject({ deMois: 36, aMois: 36 });
  });
});
