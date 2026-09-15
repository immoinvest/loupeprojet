import { describe, expect, it } from 'vitest';

import { REGLES, estAConfirmer, texteRegle, valeurRegle } from '../src/lib/regles';

function simple(texte: string): string {
  return texte.replace(/\s/g, ' ');
}

describe('règles citées dans les guides', () => {
  it('lit une valeur par son chemin, tableaux compris', () => {
    expect(valeurRegle('fiscalite.microBic.plafond')).toBe(REGLES.fiscalite.microBic.plafond);
    expect(valeurRegle('fiscalite.amortissement.composants.0.part')).toBe(
      REGLES.fiscalite.amortissement.composants[0]?.part,
    );
  });

  it.each([
    'fiscalite.microBic.inconnu',
    'fiscalite.microBic',
    'fiscalite.microBic.plafond.encore',
    'toString',
    '',
  ])('refuse « %s », qui ne mène pas à un nombre', (chemin) => {
    expect(() => valeurRegle(chemin)).toThrow(/Règle introuvable ou non numérique/);
  });

  it('formate selon le type de chiffre', () => {
    expect(simple(texteRegle('fiscalite.microBic.plafond', 'euros'))).toBe(
      simple(`${new Intl.NumberFormat('fr-FR').format(REGLES.fiscalite.microBic.plafond)} €`),
    );
    expect(simple(texteRegle('fiscalite.microBic.abattement', 'taux'))).toBe('50 %');
    expect(simple(texteRegle('fiscalite.deficitFoncier.plafondRevenuGlobal', 'nombre'))).toBe(
      '10 700',
    );
    expect(texteRegle('fiscalite.deficitFoncier.reportAnnees', 'annees')).toBe('10 ans');
    expect(texteRegle('exploitation.interdictionLocationDpe.F', 'annee')).toBe('2028');
    expect(simple(texteRegle('credit.hcsf.seuilEffort', 'taux'))).toBe('35 %');
  });

  it('dit « an » au singulier', () => {
    const regles = {
      ...REGLES,
      fiscalite: { ...REGLES.fiscalite, deficitBic: { reportAnnees: 1 } },
    };
    expect(texteRegle('fiscalite.deficitBic.reportAnnees', 'annees', regles)).toBe('1 an');
  });

  it('repère les valeurs « à confirmer »', () => {
    expect(estAConfirmer('fiscalite.prelevementsSociaux.bic')).toBe(true);
    expect(estAConfirmer('fiscalite.microBic.plafond')).toBe(false);
  });
});
