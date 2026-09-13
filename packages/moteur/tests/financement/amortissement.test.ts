import { describe, expect, it } from 'vitest';

import { ErreurHypotheseInvalide } from '../../src/commun/erreurs';
import {
  crdFinAnnee,
  mensualiteAmortissement,
  regrouperParAnnee,
  tableauAmortissement,
  type ParametresPret,
} from '../../src/financement/amortissement';

const pretSimple: ParametresPret = {
  capital: 161_000,
  tauxAnnuel: 0.0335,
  dureeMois: 300,
  differeTotalMois: 0,
  differePartielMois: 0,
  tauxAssurance: 0.0025,
};

describe('tableauAmortissement sans différé', () => {
  const lignes = tableauAmortissement(pretSimple);

  it('a une ligne par mois, numérotée, avec l’année', () => {
    expect(lignes).toHaveLength(300);
    expect(lignes[0]?.mois).toBe(1);
    expect(lignes[0]?.annee).toBe(1);
    expect(lignes[12]?.annee).toBe(2);
    expect(lignes[299]?.annee).toBe(25);
  });

  it('a une mensualité constante et un CRD final nul', () => {
    expect(lignes[0]?.mensualite).toBeCloseTo(793.1, 1);
    expect(lignes[150]?.mensualite).toBeCloseTo(lignes[0]?.mensualite ?? 0, 8);
    expect(Math.abs(lignes[299]?.crdFin ?? 1)).toBeLessThan(0.01);
  });

  it('la première ligne porte surtout des intérêts, la dernière surtout du capital', () => {
    expect(lignes[0]?.interets).toBeCloseTo((161_000 * 0.0335) / 12, 6);
    expect(lignes[299]?.interets).toBeLessThan(5);
  });
});

describe('tableauAmortissement avec différés', () => {
  const pret: ParametresPret = {
    capital: 100_000,
    tauxAnnuel: 0.03,
    dureeMois: 240,
    differeTotalMois: 12,
    differePartielMois: 12,
    tauxAssurance: 0.002,
  };
  const lignes = tableauAmortissement(pret);

  it('capitalise les intérêts pendant le différé total', () => {
    const premiere = lignes[0]!;
    expect(premiere.phase).toBe('differe_total');
    expect(premiere.capital).toBe(0);
    expect(premiere.mensualite).toBe(0);
    expect(premiere.crdFin).toBeCloseTo(100_000 + 250, 6);
    expect(lignes[11]?.crdFin).toBeCloseTo(100_000 * (1 + 0.03 / 12) ** 12, 4);
  });

  it('ne paie que les intérêts pendant le différé partiel', () => {
    const ligne = lignes[12]!;
    expect(ligne.phase).toBe('differe_partiel');
    expect(ligne.capital).toBe(0);
    expect(ligne.mensualite).toBeCloseTo(ligne.interets, 10);
    expect(ligne.crdFin).toBeCloseTo(ligne.crdDebut, 10);
  });

  it('amortit ensuite sur la durée restante jusqu’à un CRD nul', () => {
    expect(lignes[24]?.phase).toBe('amortissement');
    expect(lignes[24]?.mensualite).toBeCloseTo(mensualiteAmortissement(pret), 8);
    expect(Math.abs(lignes[239]?.crdFin ?? 1)).toBeLessThan(0.01);
  });

  it('l’assurance reste due chaque mois, même en différé', () => {
    expect(lignes[0]?.assurance).toBeCloseTo((100_000 * 0.002) / 12, 8);
    expect(lignes[239]?.assurance).toBeCloseTo((100_000 * 0.002) / 12, 8);
  });
});

describe('cas limites', () => {
  it('lève ErreurHypotheseInvalide si le différé couvre tout le prêt', () => {
    expect(() =>
      tableauAmortissement({ ...pretSimple, differeTotalMois: 200, differePartielMois: 100 }),
    ).toThrow(ErreurHypotheseInvalide);
  });

  it('rend un tableau vide sans capital', () => {
    expect(tableauAmortissement({ ...pretSimple, capital: 0 })).toEqual([]);
  });
});

describe('regrouperParAnnee / crdFinAnnee', () => {
  const lignes = tableauAmortissement(pretSimple);
  const parAnnee = regrouperParAnnee(lignes);

  it('produit 25 années dont les totaux recoupent le tableau mensuel', () => {
    expect(parAnnee).toHaveLength(25);
    const interetsAnnee1 = lignes.slice(0, 12).reduce((acc, l) => acc + l.interets, 0);
    expect(parAnnee[0]?.interets).toBeCloseTo(interetsAnnee1, 8);
    expect(parAnnee[0]?.mensualites).toBeCloseTo(12 * (lignes[0]?.mensualite ?? 0), 6);
    expect(parAnnee[0]?.crdFin).toBeCloseTo(lignes[11]?.crdFin ?? 0, 8);
  });

  it('donne le CRD de fin d’année, et 0 après la fin du prêt', () => {
    expect(crdFinAnnee(parAnnee, 10)).toBeCloseTo(lignes[119]?.crdFin ?? 0, 8);
    expect(crdFinAnnee(parAnnee, 10)).toBeGreaterThan(110_000);
    expect(crdFinAnnee(parAnnee, 30)).toBe(0);
  });
});
