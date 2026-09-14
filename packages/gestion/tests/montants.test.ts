import { describe, expect, it } from 'vitest';

import { ajouterMois } from '../src/dates';
import { loyerDuMois } from '../src/loyers';
import {
  avecChangement,
  changementRefuse,
  moisModifiables,
  montantsDuMois,
  premierMoisModifiable,
} from '../src/montants';
import { CHANGEMENTS_MAX } from '../src/regles';
import {
  ChangementSchema,
  LocationGereeSchema,
  ModificationLocationSchema,
  type Changement,
} from '../src/schemas';
import { location, paiement } from './exemples';

function changement(
  aPartirDe: string,
  loyerHorsCharges: number,
  charges = 5_000,
  apl = 0,
): Changement {
  return { aPartirDe, loyerHorsCharges, charges, apl };
}

describe('ajouterMois', () => {
  it('avance et recule, passe l’année ; zéro ne change rien', () => {
    expect(ajouterMois('2026-11', 2)).toBe('2027-01');
    expect(ajouterMois('2026-09', 12)).toBe('2027-09');
    expect(ajouterMois('2027-01', -1)).toBe('2026-12');
    expect(ajouterMois('2026-10', 0)).toBe('2026-10');
  });
});

describe('montantsDuMois', () => {
  it('sans changement : les montants d’entrée, sans aide', () => {
    expect(montantsDuMois(location('l1', { debut: '2026-09-01' }), '2027-03')).toEqual({
      loyerHorsCharges: 65_000,
      charges: 5_000,
      apl: 0,
    });
  });

  it('un changement à partir d’octobre : septembre reste à 700 €, octobre et la suite passent à 730 €', () => {
    const l = location('l1', { debut: '2026-09-01', changements: [changement('2026-10', 68_000)] });
    expect(loyerDuMois(l, '2026-09')?.total).toBe(70_000);
    expect(loyerDuMois(l, '2026-10')?.total).toBe(73_000);
    expect(loyerDuMois(l, '2027-06')?.total).toBe(73_000);
  });

  it('plusieurs changements, dans n’importe quel ordre : chaque mois prend le dernier commencé', () => {
    const janvier = changement('2027-01', 70_000, 6_000, 12_000);
    const octobre = changement('2026-10', 68_000);
    for (const changements of [
      [janvier, octobre],
      [octobre, janvier],
    ]) {
      const l = location('l1', { debut: '2026-09-01', apl: 10_000, changements });
      expect(montantsDuMois(l, '2026-09')).toEqual({
        loyerHorsCharges: 65_000,
        charges: 5_000,
        apl: 10_000,
      });
      expect(montantsDuMois(l, '2026-12')).toEqual(octobre);
      expect(montantsDuMois(l, '2027-02')).toEqual(janvier);
    }
  });

  it('prorata : entrée le 12 septembre, changement dès septembre', () => {
    const l = location('l1', {
      debut: '2026-09-12',
      changements: [changement('2026-09', 60_000, 3_000)],
    });
    // 19 jours sur 30 : 60 000 × 19 ÷ 30 = 38 000 ; 3 000 × 19 ÷ 30 = 1 900.
    expect(loyerDuMois(l, '2026-09')).toMatchObject({
      loyerHorsCharges: 38_000,
      charges: 1_900,
      total: 39_900,
    });
  });
});

describe('premierMoisModifiable et moisModifiables', () => {
  const l = location('l1', { debut: '2026-09-01' });

  it('sans paiement de cette location : dès le mois d’entrée', () => {
    expect(premierMoisModifiable(l, [paiement('p', 'autre', '2026-12', 70_000)])).toBe('2026-09');
  });

  it('septembre payé, octobre en partie, dans le désordre : à partir de novembre', () => {
    const paiements = [
      paiement('p0', 'autre', '2027-02', 70_000),
      paiement('p1', 'l1', '2026-09', 40_000),
      paiement('p2', 'l1', '2026-10', 30_000),
      paiement('p3', 'l1', '2026-09', 30_000),
    ];
    expect(premierMoisModifiable(l, paiements)).toBe('2026-11');
  });

  it('jusqu’à un an après le mois en cours, ou jusqu’à la sortie si elle vient avant', () => {
    const mois = moisModifiables(l, [], '2026-09-14');
    expect(mois).toHaveLength(13);
    expect(mois.at(-1)).toBe('2027-09');
    const courte = location('l2', { debut: '2026-09-01', fin: '2026-12-15' });
    expect(moisModifiables(courte, [], '2026-09-14')).toEqual([
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12',
    ]);
    const longue = location('l3', { debut: '2026-09-01', fin: '2030-01-31' });
    expect(moisModifiables(longue, [], '2026-09-14').at(-1)).toBe('2027-09');
  });

  it('une location terminée et toute payée : aucun mois', () => {
    const finie = location('l1', { debut: '2026-09-01', fin: '2026-10-31' });
    const paiements = [
      paiement('p1', 'l1', '2026-09', 70_000),
      paiement('p2', 'l1', '2026-10', 70_000),
    ];
    expect(moisModifiables(finie, paiements, '2026-11-02')).toEqual([]);
  });
});

describe('changementRefuse', () => {
  const l = location('l1', { debut: '2026-09-01', fin: '2027-08-31' });
  const paiements = [paiement('p1', 'l1', '2026-09', 70_000)];
  const aujourdhui = '2026-09-14';

  it('accepte le premier mois non payé et le mois de sortie', () => {
    expect(changementRefuse(l, paiements, '2026-10', aujourdhui)).toBeNull();
    expect(changementRefuse(l, paiements, '2027-08', aujourdhui)).toBeNull();
  });

  it('refuse un mois payé, un mois avant l’entrée, après la sortie ou au-delà d’un an', () => {
    expect(changementRefuse(l, paiements, '2026-09', aujourdhui)).toBe('PERIODE_PAYEE');
    expect(changementRefuse(l, paiements, '2026-08', aujourdhui)).toBe('HORS_LOCATION');
    expect(changementRefuse(l, paiements, '2027-09', aujourdhui)).toBe('HORS_LOCATION');
    const sansFin = location('l2', { debut: '2026-09-01' });
    expect(changementRefuse(sansFin, [], '2027-09', aujourdhui)).toBeNull();
    expect(changementRefuse(sansFin, [], '2027-10', aujourdhui)).toBe('HORS_LOCATION');
  });
});

describe('avecChangement', () => {
  it('range les changements dans l’ordre des mois et remplace celui du même mois', () => {
    const l = location('l1', { changements: [changement('2027-01', 70_000)] });
    const ajoute = avecChangement(l, changement('2026-11', 68_000));
    expect(ajoute.changements?.map((c) => c.aPartirDe)).toEqual(['2026-11', '2027-01']);
    const remplace = avecChangement(ajoute, changement('2027-01', 72_000));
    expect(remplace.changements).toEqual([
      changement('2026-11', 68_000),
      changement('2027-01', 72_000),
    ]);
    expect(avecChangement(location('l2'), changement('2026-11', 1)).changements).toHaveLength(1);
  });
});

describe('schémas des changements', () => {
  it('un changement : un mois valide, une aide au plus égale au loyer charges comprises', () => {
    expect(ChangementSchema.safeParse(changement('2026-10', 65_000, 5_000, 70_000)).success).toBe(
      true,
    );
    expect(ChangementSchema.safeParse(changement('2026-10', 65_000, 5_000, 70_001)).success).toBe(
      false,
    );
    expect(ChangementSchema.safeParse(changement('2026-13', 65_000)).success).toBe(false);
  });

  it('une location enregistrée : aide couverte, 120 changements au plus', () => {
    expect(LocationGereeSchema.safeParse(location('l1', { apl: 70_001 })).success).toBe(false);
    const beaucoup = Array.from({ length: CHANGEMENTS_MAX + 1 }, (_, i) =>
      changement(ajouterMois('2026-01', i), 65_000),
    );
    const assez = location('l1', { changements: beaucoup.slice(1) });
    expect(LocationGereeSchema.safeParse(assez).success).toBe(true);
    expect(LocationGereeSchema.safeParse(location('l1', { changements: beaucoup })).success).toBe(
      false,
    );
  });

  it('une modification change au moins un champ ; un libellé à null le retire', () => {
    expect(ModificationLocationSchema.safeParse({}).success).toBe(false);
    expect(ModificationLocationSchema.parse({ libelle: null })).toEqual({ libelle: null });
    expect(ModificationLocationSchema.parse({ depot: 0 })).toEqual({ depot: 0 });
    expect(ModificationLocationSchema.parse({ jourLoyer: 10, depot: 130_000 })).toEqual({
      jourLoyer: 10,
      depot: 130_000,
    });
    const montants = changement('2026-10', 68_000);
    expect(ModificationLocationSchema.parse({ montants })).toEqual({ montants });
    expect(ModificationLocationSchema.safeParse({ jourLoyer: 29 }).success).toBe(false);
  });
});
