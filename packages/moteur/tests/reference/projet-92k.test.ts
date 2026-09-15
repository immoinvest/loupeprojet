import { describe, expect, it } from 'vitest';

import { calculerProjet, type ResultatsComplets } from '../../src/calculer-projet';
import { van } from '../../src/commun/flux';
import { projet92k } from '../../src/exemples/projet-92k';
import { calculerMensualite, tableauAmortissement } from '../../src/financement';

/**
 * Cas de référence « Projet 92K » : le modèle Excel de Pierre recoupé avec le moteur, le 15/09/2026.
 * Lecture de l'Excel : `.product/audit/excel-92k.md`. Verdicts : `.product/audit/calculs-2026-09.md`.
 *
 * Pour chaque indicateur : la valeur enregistrée par l'Excel, la valeur du moteur et, quand elles
 * diffèrent, la raison (🟦 écart voulu, 🟧 écart d'hypothèse). Les calculs à la main sont écrits dans
 * les tests. Un changement du moteur qui déplace un de ces chiffres doit s'expliquer ici.
 */

function calculer(): ResultatsComplets {
  const r = calculerProjet(projet92k);
  if (!r.complet) throw new Error('Le projet 92K doit être complet');
  return r;
}

const r = calculer();
const PMT = (capital: number, taux: number, mois: number): number =>
  (capital * (taux / 12)) / (1 - (1 + taux / 12) ** -mois);

/** Valeurs enregistrées par Excel dans le fichier (arrondies à l'affichage près). */
const EXCEL = {
  fraisNotaire: 14_725,
  tauxPmt: 0.033 + (2_000 + 850) / 25 / 155_000,
  mensualiteHorsAssurance: 765.494_562_039_555,
  assuranceMensuelle: 47.791_666_666_666_664,
  mensualiteTotale: 813.286_228_706_221_7,
  endettement: 0.387_279_156_526_772_2,
  crd120: 114_039.054_522_642_79,
  crd300: 15_293.312_137_653_484,
  interetsAnnee1: 5_743.839_328_974_513,
  cashflowMensuel: 496.713_771_293_778_34,
  impotMicroBic: 5_210.88,
  baseReelAnnee1: -18_782.339_328_974_515,
  anneesAvantImpot: 4.242_437_352_307_300_5,
  plusValueTaxable: 27_578.626_564_880_768,
  ira5ans: 4_082.635_280_452_593_6,
  brut: 0.130_092_797_171_895_7,
  net: 0.092_620_415_377_817_05,
  netNet: 0.051_812_092_520_987_35,
  gainTotal: 37_474.691_276_505_167,
  triExcel: 0.508_994_109_018_745_9,
};

describe('Projet 92K — entrées', () => {
  it('colocation de 4 chambres à 460 € : 22 080 € de loyers par an, sans vacance comme l’Excel', () => {
    expect(r.cashflow.recettes.loyersBruts).toBe(22_080);
    expect(r.cashflow.recettes.vacance).toBe(0);
    expect(r.fiscalite.retenu).toBe('lmnp_reel');
    expect(r.fiscalite.compatibles).toEqual(['micro_bic', 'lmnp_reel']);
  });
});

describe('Projet 92K — frais d’acquisition (🟦 forfait 9,5 % de l’Excel)', () => {
  it('Excel : 155 000 × 9,5 % = 14 725 €, honoraires d’agence compris dans l’assiette', () => {
    expect(155_000 * 0.095).toBeCloseTo(EXCEL.fraisNotaire, 6);
  });

  it('moteur : assiette 146 000 € (hors 9 000 € d’honoraires), barème réel à 5 % = 11 831,56 €', () => {
    const f = r.financement.fraisAcquisition;
    expect(f.base).toBe(146_000);
    // Droits : 146 000 × (5 % × 1,0237 + 1,2 %) = 9 225,01
    expect(f.droits).toBeCloseTo(9_225.01, 2);
    // Émoluments HT : 6 500 × 3,87 % + 10 500 × 1,596 % + 43 000 × 1,064 % + 86 000 × 0,799 % = 1 563,79
    expect(f.emolumentsHt).toBeCloseTo(1_563.79, 2);
    // TTC 1 876,55 + CSI 146 + débours 584
    expect(f.total).toBeCloseTo(9_225.01 + 1_563.79 * 1.2 + 146 + 584, 2);
  });
});

describe('Projet 92K — prêt (feuille « Calculs prêt immo »)', () => {
  it('🟦 Excel calcule la mensualité au « TAEG » bricolé 3,3735 % au lieu du taux nominal', () => {
    expect(PMT(155_000, EXCEL.tauxPmt, 300)).toBeCloseTo(EXCEL.mensualiteHorsAssurance, 8);
    expect(calculerMensualite(155_000, EXCEL.tauxPmt, 300)).toBeCloseTo(
      EXCEL.mensualiteHorsAssurance,
      8,
    );
    // Au taux nominal, sur le même capital : 759,44 €.
    expect(calculerMensualite(155_000, 0.033, 300)).toBeCloseTo(759.44, 2);
  });

  it('assurance : même formule que l’Excel (0,37 % × capital ÷ 12)', () => {
    expect((155_000 * 0.0037) / 12).toBeCloseTo(EXCEL.assuranceMensuelle, 10);
    expect(r.financement.assuranceMensuelle).toBeCloseTo(
      (r.financement.montantEmprunte * 0.0037) / 12,
      10,
    );
  });

  it('🟧 moteur : 154 956,56 € empruntés (frais réels et frais bancaires financés), mensualité 807,01 €', () => {
    // 155 000 + 11 831,56 + 850 + 2 000 − 14 725
    expect(r.financement.montantEmprunte).toBeCloseTo(154_956.558, 3);
    expect(r.financement.mensualiteHorsAssurance).toBeCloseTo(PMT(154_956.558, 0.033, 300), 8);
    expect(r.financement.mensualiteTotale).toBeCloseTo(807.01, 2);
    expect(EXCEL.mensualiteTotale - r.financement.mensualiteTotale).toBeCloseTo(6.28, 2);
  });

  it('🟦 le tableau de l’Excel calcule les intérêts au taux + assurance : 15 293 € restent dus au bout de 25 ans', () => {
    let crd = 155_000;
    let interetsAnnee1 = 0;
    for (let mois = 1; mois <= 300; mois += 1) {
      const interets = (crd * (EXCEL.tauxPmt + 0.0037)) / 12;
      if (mois <= 12) interetsAnnee1 += interets;
      crd -= EXCEL.mensualiteHorsAssurance - interets;
      if (mois === 120) expect(crd).toBeCloseTo(EXCEL.crd120, 6);
    }
    expect(crd).toBeCloseTo(EXCEL.crd300, 6);
    expect(interetsAnnee1).toBeCloseTo(EXCEL.interetsAnnee1, 6);
  });

  it('moteur : tableau soldé à zéro, intérêts de l’année 1 = 5 052,55 €, capital restant dû à 5 ans = 133 259,70 €', () => {
    const { parAnnee, tableau } = r.financement;
    expect(tableau.at(-1)!.crdFin).toBeCloseTo(0, 6);
    // Premier mois : 154 956,56 × 3,3 % ÷ 12 = 426,13 € d'intérêts.
    expect(tableau[0]!.interets).toBeCloseTo(426.13, 2);
    expect(parAnnee[0]!.interets).toBeCloseTo(5_052.55, 2);
    expect(r.financement.crdRevente).toBeCloseTo(133_259.7, 2);
    expect(r.financement.totalInterets).toBeCloseTo(72_811.72, 2);
  });

  it('🟦 TAEG : l’Excel additionne taux + frais ÷ 25 ÷ capital + assurance (3,74 %), le moteur résout le taux actuariel (4,13 %)', () => {
    expect(EXCEL.tauxPmt + 0.0037).toBeCloseTo(0.037_435_5, 6);
    expect(r.financement.taegHorsAssurance).toBeCloseTo(0.035_281_5, 6);
    expect(r.financement.taegAvecAssurance).toBeCloseTo(0.041_251_2, 6);
    // Vérification : au taux mensuel équivalent, les 300 échéances actualisées rendent le capital net.
    const mensuel = (1 + r.financement.taegAvecAssurance!) ** (1 / 12) - 1;
    const capitalNet = r.financement.montantEmprunte - 2_850;
    const actualise = r.financement.tableau.reduce(
      (acc, l) => acc + (l.mensualite + l.assurance) / (1 + mensuel) ** l.mois,
      0,
    );
    expect(actualise).toBeCloseTo(capitalNet, 2);
  });

  it('🟦 endettement : l’Excel divise par les revenus seuls (38,7 %), le HCSF compte 70 % des loyers (23,8 %)', () => {
    expect(EXCEL.mensualiteTotale / 2_100).toBeCloseTo(EXCEL.endettement, 10);
    expect(r.financement.effort.hcsf).toBeCloseTo(807.0059 / (2_100 + 0.7 * 1_840), 5);
    expect(r.financement.effort.sansLoyers).toBeCloseTo(807.0059 / 2_100, 5);
  });

  it('🟦 IRA à 5 ans : l’Excel prend 3 % du capital restant dû, le moteur le plus petit des deux plafonds', () => {
    expect(0.03 * 136_087.842_681_753_13).toBeCloseTo(EXCEL.ira5ans, 6);
    // 6 mois d'intérêts : 133 259,70 × 3,3 % ÷ 2 = 2 198,79 ; 3 % du CRD = 3 997,79
    expect(r.financement.iraRevente).toBeCloseTo(2_198.79, 2);
  });
});

describe('Projet 92K — autofinancement', () => {
  it('🟧 cash-flow : 582,99 € au moteur = 496,71 € de l’Excel + 80 € de charges « Autre » + 6,28 € de mensualité', () => {
    // (22 080 − 5 400 de charges − 807,01 × 12) ÷ 12
    expect(r.cashflow.chargesAnnuelles).toBe(5_400);
    expect(r.cashflow.mensuel).toBeCloseTo((22_080 - 5_400) / 12 - 807.0059, 3);
    expect(
      r.cashflow.mensuel - 80 - (EXCEL.mensualiteTotale - r.financement.mensualiteTotale),
    ).toBeCloseTo(EXCEL.cashflowMensuel, 6);
  });

  it('couverture 43,9 %, point mort 1 257 € de loyer total', () => {
    expect(r.cashflow.tauxCouverture).toBeCloseTo(807.0059 / 1_840, 5);
    expect(r.cashflow.pointMort).toBeCloseTo(1_257.01, 2);
  });
});

describe('Projet 92K — imposition', () => {
  it('🟦 micro-BIC : même base (11 040 €) ; prélèvements sociaux 18,6 % (LFSS 2026) au lieu de 17,2 %', () => {
    const a1 = r.fiscalite.regimes.micro_bic.annees[0]!;
    expect(a1.baseImposable).toBe(11_040);
    expect(11_040 * (0.3 + 0.172)).toBeCloseTo(EXCEL.impotMicroBic, 6);
    expect(a1.impot).toBeCloseTo(11_040 * (0.3 + 0.186), 6);
    expect(a1.impot - EXCEL.impotMicroBic).toBeCloseTo(154.56, 2);
  });

  it('🟦 réel année 1 : l’Excel déduit l’amortissement en créant un déficit (−18 782 €), interdit par l’art. 39 C', () => {
    // Recettes − frais (notaire, agence, dossier) − charges (intérêts, assurance, TF, copro, CFE, comptable, PNO, autre) − amortissements
    const excel =
      22_080 -
      (14_725 + 9_000 + 850) -
      (EXCEL.interetsAnnee1 + 573.5 + 960 + 1_080 + 120 + 360 + 240 + 960) -
      4_650 -
      1_600;
    expect(excel).toBeCloseTo(EXCEL.baseReelAnnee1, 6);

    const a1 = r.fiscalite.regimes.lmnp_reel.annees[0]!;
    // Frais d'acquisition 11 831,56 + agence 9 000 + dossier 850 + garantie 2 000, charges 5 400, assurance 573,34
    expect(a1.chargesDeductibles).toBeCloseTo(11_831.558 + 9_000 + 2_850 + 5_400 + 573.339, 2);
    expect(a1.impot).toBe(0);
    expect(a1.amortissementsDeduits).toBe(0);
    // Déficit hors amortissement reportable 10 ans : 12 627,45 € ; amortissements différés : 5 300,21 €
    expect(a1.stocks.deficitReportable).toBeCloseTo(12_627.45, 2);
    // Bâti 146 000 × 85 % × (55 % ÷ 50 + 45 % ÷ 20) = 4 157,35 ; mobilier 8 000 ÷ 7 = 1 142,86
    expect(a1.stocks.amortissementsReportes).toBeCloseTo(4_157.35 + 1_142.857, 2);
  });

  it('🟦 première année imposable au réel : 4,24 ans selon la formule de l’Excel, année 4 au moteur', () => {
    expect(24_575 / (22_080 - 16_287.339_328_974_513)).toBeCloseTo(EXCEL.anneesAvantImpot, 6);
    const lmnp = r.fiscalite.regimes.lmnp_reel;
    expect(lmnp.premiereAnneeImposable).toBe(4);
    expect(lmnp.annees[3]!.baseImposable).toBeCloseTo(168.21, 2);
    expect(lmnp.annees[4]!.impot).toBeCloseTo(3_074.29, 2);
    expect(lmnp.impotTotal).toBeCloseTo(3_156.04, 2);
    expect(r.fiscalite.meilleur).toBe('lmnp_reel');
  });
});

describe('Projet 92K — revente à 5 ans', () => {
  it('🟦 plus-value taxable : l’Excel déduit l’IRA du prix et réintègre le mobilier et le terrain (27 579 €)', () => {
    const prixVente = 160_000 * 1.02 ** 5;
    const excel =
      prixVente -
      8_000 -
      1_100 -
      EXCEL.ira5ans -
      (155_000 + 0 + 14_725) +
      (155_000 / 30) * 5 +
      8_000;
    expect(excel).toBeCloseTo(EXCEL.plusValueTaxable, 6);
  });

  it('🟧 moteur : valeur 155 000 × 1,02⁵, réintégration du bâti seul (20 786,75 €), aucune plus-value après forfaits', () => {
    const { revente } = r;
    expect(revente.valeur).toBeCloseTo(155_000 * 1.02 ** 5, 6);
    expect(revente.plusValue.reintegration).toBeCloseTo(4_157.35 * 5, 2);
    expect(revente.plusValue.plusValueBrute).toBe(0);
    expect(revente.plusValue.impotTotal).toBe(0);
    // Valeur − agence 4,5 % − diagnostics − CRD − IRA
    expect(revente.cashNetVendeur).toBeCloseTo(
      revente.valeur * 0.955 - 1_100 - 133_259.699 - 2_198.785,
      2,
    );
  });
});

describe('Projet 92K — rendement', () => {
  it('🟦 brut : l’Excel divise par prix + notaire forfaitaire (13,01 %), le moteur par prix + frais réels (13,23 %)', () => {
    expect(22_080 / (155_000 + 14_725)).toBeCloseTo(EXCEL.brut, 10);
    expect(r.rendement.rendements.brut).toBeCloseTo(22_080 / (155_000 + 11_831.558), 10);
  });

  it('🟧 net : 9,26 % dans l’Excel (charges « Autre » comprises), 10,00 % au moteur', () => {
    expect((22_080 - (960 + 1_080 + 2_280 + 2_040)) / 169_725).toBeCloseTo(EXCEL.net, 10);
    expect(r.rendement.rendements.net).toBeCloseTo((22_080 - 5_400) / 166_831.558, 10);
  });

  it('🟦 net-net : l’Excel prend des intérêts « annualisés » assurance comprise et un impôt d’année courante', () => {
    expect((22_080 - 6_360 - 2_734.135_836_724_03 - 4_192.056_760_151_393) / 169_725).toBeCloseTo(
      EXCEL.netNet,
      10,
    );
    // Moteur, première année : (16 680 − 5 052,55 − 573,34 − 0 d'impôt) ÷ 166 831,56
    expect(r.rendement.rendements.netNet).toBeCloseTo(
      (16_680 - 5_052.552 - 573.339) / 166_831.558,
      6,
    );
  });

  it('🟦 « TRI » de l’Excel = multiple sur apport ÷ années (50,9 %) ; le moteur résout le vrai TRI (31,2 %)', () => {
    expect(EXCEL.gainTotal / 14_725 / 5).toBeCloseTo(EXCEL.triExcel, 10);
    const { flux, tri } = r.rendement;
    expect(flux[0]).toBe(-22_725);
    expect(tri).toBeCloseTo(0.3124, 4);
    expect(van(flux, tri!)).toBeCloseTo(0, 4);
  });

  it('enrichissement = cash net vendeur + cash-flows après impôt − mise de départ', () => {
    const e = r.rendement.enrichissement;
    expect(e.total).toBeCloseTo(r.revente.cashNetVendeur + e.cashflowsCumules - 22_725, 6);
    expect(e.capitalRembourse).toBeCloseTo(154_956.558 - 133_259.699, 2);
  });
});

describe('Projet 92K — verdict', () => {
  it('rendement, cash-flow, couverture et risques au vert ; prix inconnu sans ventes DVF', () => {
    expect(r.verdict.feux.map((f) => [f.axe, f.feu])).toEqual([
      ['prix', 'inconnu'],
      ['rendement', 'bon'],
      ['cashflow', 'bon'],
      ['couverture', 'bon'],
      ['risques', 'bon'],
    ]);
  });
});

describe('Projet 92K — contrôle du tableau moteur à la main', () => {
  it('le tableau d’amortissement rembourse exactement le capital', () => {
    const t = tableauAmortissement({
      capital: 155_000,
      tauxAnnuel: 0.033,
      dureeMois: 300,
      differeTotalMois: 0,
      differePartielMois: 0,
      tauxAssurance: 0.0037,
    });
    expect(t.reduce((acc, l) => acc + l.capital, 0)).toBeCloseTo(155_000, 6);
  });
});
