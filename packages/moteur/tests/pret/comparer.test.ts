import { describe, expect, it } from 'vitest';

import {
  CODES_CRITERES,
  comparerOffres,
  offresIdentiques,
  type CodeCritere,
} from '../../src/pret/comparer';
import { OffrePretSchema, ProjetFinanceSchema, type OffrePretEntree } from '../../src/pret/schema';
import { simulerPret } from '../../src/pret/simuler';
import { obtenirRegles } from '../../src/regles';

const regles = obtenirRegles('2026-09');
const projet = ProjetFinanceSchema.parse({
  prix: 155_000,
  fraisNotaire: 0,
  revenusMensuels: 2_400,
});

const offre = (o: Partial<OffrePretEntree>): ReturnType<typeof OffrePretSchema.parse> =>
  OffrePretSchema.parse({ tauxNominal: 0.033, dureeAnnees: 25, tauxAssurance: 0.0037, ...o });

const simuler = (o: ReturnType<typeof offre>, p = projet): ReturnType<typeof simulerPret> =>
  simulerPret(p, o, regles);

function critere(
  comparaison: ReturnType<typeof comparerOffres>,
  code: CodeCritere,
): NonNullable<ReturnType<typeof comparerOffres>['criteres'][number]> {
  const c = comparaison.criteres.find((x) => x.code === code);
  if (c === undefined) throw new Error(`critère ${code} absent`);
  return c;
}

describe('comparerOffres — nominal', () => {
  // LCL : 3,3 % sur 25 ans (mensualité plus basse) ; CIC : 2,8 % sur 15 ans (coût total plus bas).
  const a = offre({ nom: 'LCL' });
  const b = offre({ nom: 'CIC', tauxNominal: 0.028, dureeAnnees: 15, tauxAssurance: 0.0025 });
  const ra = simuler(a);
  const rb = simuler(b);
  const c = comparerOffres(ra, rb, a, b);

  it('donne la mensualité totale de chaque offre, l’écart a − b et la meilleure', () => {
    const m = critere(c, 'mensualiteTotale');
    expect(m.a).toBeCloseTo(807.23, 1);
    expect(m.b).toBe(rb.mensualiteTotale);
    expect(m.b).toBeGreaterThan(1_080);
    expect(m.ecart).toBeCloseTo(ra.mensualiteTotale - rb.mensualiteTotale, 8);
    expect(m.meilleure).toBe('a');
  });

  it('désigne l’offre au coût total le plus bas', () => {
    const cout = critere(c, 'coutTotalCredit');
    expect(cout.a).toBe(ra.coutTotalCredit);
    expect(cout.b).toBe(rb.coutTotalCredit);
    expect(cout.meilleure).toBe('b');
    expect(critere(c, 'totalInterets').meilleure).toBe('b');
    expect(critere(c, 'totalAssurance').meilleure).toBe('b');
    expect(critere(c, 'taegHorsAssurance').meilleure).toBe('b');
    expect(critere(c, 'taegAvecAssurance').meilleure).toBe('b');
    expect(critere(c, 'endettement').meilleure).toBe('a');
  });

  it('laisse la durée et le montant emprunté informatifs', () => {
    expect(critere(c, 'dureeAnnees')).toEqual({
      code: 'dureeAnnees',
      a: 25,
      b: 15,
      ecart: 10,
      meilleure: null,
    });
    expect(critere(c, 'montantEmprunte')).toEqual({
      code: 'montantEmprunte',
      a: 155_000,
      b: 155_000,
      ecart: 0,
      meilleure: null,
    });
    expect(offresIdentiques(c)).toBe(false);
  });
});

describe('comparerOffres — égalité et absence', () => {
  it('deux offres identiques : ecart 0 et aucune meilleure', () => {
    const o = offre({});
    const r = simuler(o);
    const c = comparerOffres(r, r, o, o);
    for (const x of c.criteres) {
      expect(x.ecart, x.code).toBe(0);
      expect(x.meilleure, x.code).toBeNull();
    }
    expect(offresIdentiques(c)).toBe(true);
  });

  it('un écart sous un centime ou sous 0,001 point est une égalité', () => {
    const o = offre({});
    const r = simuler(o);
    const presque = {
      ...r,
      mensualiteTotale: r.mensualiteTotale + 0.009,
      taegAvecAssurance: (r.taegAvecAssurance ?? 0) + 0.000009,
      coutTotalCredit: r.coutTotalCredit + 0.011,
    };
    const c = comparerOffres(r, presque, o, o);
    expect(critere(c, 'mensualiteTotale').meilleure).toBeNull();
    expect(critere(c, 'taegAvecAssurance').meilleure).toBeNull();
    expect(critere(c, 'coutTotalCredit').meilleure).toBe('a');
    expect(offresIdentiques(c)).toBe(false);
  });

  it('sans revenus, l’endettement est absent : a null, ecart null, meilleure null', () => {
    const o = offre({});
    const sansRevenus = simuler(o, ProjetFinanceSchema.parse({ prix: 155_000, fraisNotaire: 0 }));
    const c = comparerOffres(sansRevenus, simuler(o), o, o);
    expect(critere(c, 'endettement')).toEqual({
      code: 'endettement',
      a: null,
      b: expect.any(Number) as number,
      ecart: null,
      meilleure: null,
    });
    // Les autres critères ne bougent pas : les deux offres sont identiques par ailleurs.
    expect(offresIdentiques(c)).toBe(true);
  });

  it('rien à emprunter d’un côté : TAEG absents, mensualité nulle « meilleure »', () => {
    const o = offre({});
    const tout = offre({ apport: 200_000 });
    const c = comparerOffres(simuler(tout), simuler(o), tout, o);
    expect(critere(c, 'taegAvecAssurance').a).toBeNull();
    expect(critere(c, 'taegAvecAssurance').meilleure).toBeNull();
    expect(critere(c, 'mensualiteTotale').meilleure).toBe('a');
  });
});

describe('comparerOffres — ordre', () => {
  it('rend toujours les neuf critères dans l’ordre déclaré', () => {
    const o = offre({});
    const r = simuler(o);
    expect(comparerOffres(r, r, o, o).criteres.map((c) => c.code)).toEqual([...CODES_CRITERES]);
    expect(CODES_CRITERES).toEqual([
      'mensualiteTotale',
      'coutTotalCredit',
      'totalInterets',
      'totalAssurance',
      'taegHorsAssurance',
      'taegAvecAssurance',
      'montantEmprunte',
      'dureeAnnees',
      'endettement',
    ]);
  });
});
