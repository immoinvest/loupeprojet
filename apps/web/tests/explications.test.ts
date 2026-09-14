import { calculerProjet, projetExemple, type Resultats } from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import {
  EXPLICATIONS,
  explicationAutofinancement,
  explicationCouverture,
  explicationEffort,
  explicationFiscalite,
  explicationMultiple,
  explicationPointMort,
  explicationPrix,
  explicationRendement,
  explicationRevente,
} from '@/textes/explications';

import { courteDuree, variante } from './projets';

/** Les montants portent des espaces insécables : on les ramène à des espaces simples. */
const n = (s: string): string => s.replace(/\s/g, ' ');

const exemple = calculerProjet(projetExemple);
/** Loyer 1 600 € sans vacance : cash-flow positif, loyer au-dessus du point mort. */
const confortable = calculerProjet(
  variante({ location: { mode: 'meuble', loyerHc: 1_600, vacanceSemaines: 0 } }),
);
const microBic = calculerProjet(variante({ fiscalite: { tmi: 0.3, regime: 'micro_bic' } }));
const nuitees = calculerProjet(courteDuree());
/** Une colocation : seuls les deux régimes du meublé sont possibles. */
const coloc = calculerProjet(
  variante({ location: { mode: 'colocation', chambres: 3, loyerChambre: 450 } }),
);

describe('explications fixes', () => {
  it('restent disponibles pour la page Méthode', () => {
    expect(Object.keys(EXPLICATIONS)).toEqual([
      'prix',
      'cashflow',
      'fiscalite',
      'revente',
      'leviers',
    ]);
    expect(EXPLICATIONS.prix).toContain('ventes signées chez le notaire');
  });
});

describe('prix', () => {
  it('compare au prix estimé avec les ventes réelles', () => {
    const t = n(explicationPrix(exemple));
    expect(t).toContain('2 385 €/m²');
    expect(t).toContain('prix estimé de 3 181 €/m²');
    expect(t).toContain('31 ventes signées chez le notaire');
    expect(t).toContain('−25 %');
  });

  it('sans estimation, compare à la médiane', () => {
    const t = n(explicationPrix({ ...exemple, estimation: null }));
    expect(t).toContain('médiane de 3 050 €/m²');
    expect(t).toContain('−25 %');
  });

  it('sans ventes réelles, dit qu’il n’y a pas de repère', () => {
    const t = n(explicationPrix(calculerProjet(variante({}, { risques: [] }))));
    expect(t).toContain("n'a pas encore de repère");
    expect(t).toContain('155 000 €');
    expect(t).toContain('2 385 €/m²');
  });
});

describe('autofinancement', () => {
  it('déroule la cascade avec les chiffres de l’exemple', () => {
    const t = n(explicationAutofinancement(exemple));
    expect(t).toContain('loyer de 980 €');
    expect(t).toContain("crédit et l'assurance (827 €)");
    expect(t).toContain('entretien (307 €)');
    expect(t).toContain('3 semaines sans locataire (57 €)');
    expect(t).toContain('Il manque 210 € avant impôt.');
    expect(t).toContain("Au meublé au réel, l'impôt est nul sur 10 ans.");
  });

  it('cash-flow positif sans vacance, régime imposé, courte durée', () => {
    const positif = n(explicationAutofinancement(confortable));
    expect(positif).toContain('Il reste ');
    expect(positif).not.toContain('sans locataire');

    expect(n(explicationAutofinancement(microBic))).toContain(
      "L'impôt du meublé micro-BIC coûte en moyenne 224 € par mois sur 10 ans.",
    );

    // En courte durée, le ménage facturé s'ajoute au loyer ; ménage payé et conciergerie sont des charges.
    const cd = n(explicationAutofinancement(nuitees));
    expect(cd).toContain('de forfaits et de ménage facturés');
    expect(cd).toContain('entretien, conciergerie, ménage (');
    expect(cd).not.toContain('semaines');
  });
});

describe('repères', () => {
  it('couverture : sous 100 %, au-dessus, sans loyer', () => {
    const t = n(explicationCouverture(exemple));
    expect(t).toContain('(827 €), représente 84 % du loyer (980 €)');
    expect(t).toContain('Sous 100 %');

    const cher = calculerProjet(variante({ location: { mode: 'meuble', loyerHc: 700 } }));
    expect(n(explicationCouverture(cher))).toContain('118 %');
    expect(explicationCouverture(cher)).toContain('Au-dessus de 100 %');

    // Courte durée : le loyer mensuel équivalent vaut nuitée × nuits par mois (80 € × 18,25).
    expect(n(explicationCouverture(nuitees))).toContain('du loyer (1 460 €)');
    const sansLoyer = calculerProjet(variante({ location: { mode: 'nu', loyerHc: 0 } }));
    expect(explicationCouverture(sansLoyer)).toContain('Sans loyer');
  });

  it('effort d’épargne ou excédent', () => {
    const t = n(explicationEffort(exemple));
    expect(t).toContain('210 €');
    expect(t).toContain('2 523 € par an');
    expect(explicationEffort(confortable)).toContain('Ce que le projet vous laisse');
  });

  it('loyer d’équilibre : il manque, au-dessus, courte durée', () => {
    const t = n(explicationPointMort(exemple));
    expect(t).toContain('1 203 €');
    expect(t).toContain('contre 980 € visés');
    expect(t).toContain('il manque 223 € par mois');
    expect(explicationPointMort(confortable)).toContain('vous êtes au-dessus');
    expect(explicationPointMort(nuitees)).toContain('En courte durée');
    // Colocation : le point mort se compare au loyer total des chambres.
    expect(n(explicationPointMort(coloc))).toContain('contre 1 350 € visés');
  });
});

describe('rendements', () => {
  it('brut, net et net-net avec la formule chiffrée', () => {
    const brut = n(explicationRendement(exemple, 'brut'));
    expect(brut).toContain('11 760 € ÷ 172 987 € = 6,8 %');

    const net = n(explicationRendement(exemple, 'net'));
    expect(net).toContain('la vacance (678 €)');
    expect(net).toContain('charges (3 685 €');
    expect(net).toContain('7 397 € ÷ 172 987 € = 4,3 %');

    const netNet = n(explicationRendement(exemple, 'netNet'));
    expect(netNet).toContain('première année (5 732 €)');
    expect(netNet).toContain('(0 €, meublé au réel)');
    expect(netNet).toContain('1 664 € ÷ 172 987 € = 1,0 %');
  });

  it('en courte durée, le net ne retire pas de vacance et nomme les frais du type', () => {
    const net = explicationRendement(nuitees, 'net');
    expect(net).toContain('les nuits non louées (déjà hors des recettes)');
    expect(net).toContain('conciergerie, ménage)');
  });
});

describe('impôts et revente', () => {
  it('fiscalité : régime retenu, réserve, le moins cher des autres', () => {
    const t = n(explicationFiscalite(exemple));
    expect(t).toContain('Sur 10 ans, le meublé au réel ne coûte aucun impôt.');
    expect(t).toContain('50 807 € restent en réserve');
    expect(t).toContain('Le moins cher des trois autres régimes est le nu au réel (4 235 €)');

    const m = n(explicationFiscalite(microBic));
    expect(m).toContain("le meublé micro-BIC coûte 26 928 € d'impôt");
    expect(m).toContain('Abattement de 50 %');
    expect(m).toContain('est le meublé au réel (0 €)');

    // Colocation : un seul autre régime possible, jamais un régime nu.
    const c = n(explicationFiscalite(coloc));
    expect(c).toMatch(/L'autre régime possible est le meublé micro-BIC \(/);
    expect(c).not.toContain(' nu ');
  });

  it('revente : valeur, frais, capital restant dû, IRA, impôt, net vendeur', () => {
    const t = n(explicationRevente(exemple));
    expect(t).toContain('179 884 € dans 10 ans (+1,5 % par an)');
    expect(t).toContain('diagnostics (7 695 €)');
    expect(t).toContain('capital restant dû (112 094 €)');
    expect(t).toContain('anticipé (1 878 €)');
    expect(t).toContain('plus-value (0 €)');
    expect(t).toContain('58 217 € net vendeur');
  });

  it('multiple sur apport : exemple, perte, sans mise', () => {
    const t = n(explicationMultiple(exemple));
    expect(t).toContain('13 647 € ÷ 19 337 € = × 0,7.');
    expect(t).toContain('en rend 0,7');

    const perte = {
      rendement: { enrichissement: { miseDeDepart: 10_000, total: -5_000 } },
      projet: { hypotheses: { revente: { annees: 10 } } },
    } as unknown as Resultats;
    const p = n(explicationMultiple(perte));
    expect(p).toContain('= × −0,5.');
    expect(p).toContain('en perd 0,5');

    const sansMise = {
      rendement: { enrichissement: { miseDeDepart: 0, total: 5_000 } },
    } as unknown as Resultats;
    expect(explicationMultiple(sansMise)).toContain('Sans mise de départ');
  });
});
