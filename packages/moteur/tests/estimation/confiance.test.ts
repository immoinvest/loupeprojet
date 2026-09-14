import { describe, expect, it } from 'vitest';

import {
  confianceEstimation,
  dispersionDe,
  interpolerPaliers,
  pointsLocalisation,
  precisionDe,
} from '../../src/estimation';
import { obtenirRegles } from '../../src/regles';
import type { PalierRayon, Regles, SeuilNiveau } from '../../src/regles/types';
import { DvfSchema, type Dvf } from '../../src/schema';

const regles = obtenirRegles('2026-09');
const c = regles.estimation.confiance;

const dvf = (d: Partial<Dvf> & { medianM2: number; nombreVentes: number }): Dvf =>
  DvfSchema.parse(d);

function avecConfiance(surcharges: Partial<typeof c>): Regles {
  return {
    ...regles,
    estimation: { ...regles.estimation, confiance: { ...c, ...surcharges } },
  };
}

function avecQuartier(quartier: readonly PalierRayon[]): Regles {
  return avecConfiance({ localisation: { ...c.localisation, quartier } });
}

describe('interpolerPaliers', () => {
  it('borne au premier et au dernier palier, interpole entre deux (comparables)', () => {
    expect(interpolerPaliers(c.comparables, 2)).toBe(0);
    expect(interpolerPaliers(c.comparables, 3)).toBe(0);
    expect(interpolerPaliers(c.comparables, 5)).toBeCloseTo((12 * 2) / 7, 10);
    expect(interpolerPaliers(c.comparables, 10)).toBe(12);
    expect(interpolerPaliers(c.comparables, 20)).toBe(16);
    expect(interpolerPaliers(c.comparables, 30)).toBe(20);
    expect(interpolerPaliers(c.comparables, 50)).toBe(20);
  });

  it('un barème décroissant (dispersion, ancienneté) et un barème vide', () => {
    expect(interpolerPaliers(c.dispersion, 0.05)).toBe(30);
    expect(interpolerPaliers(c.dispersion, 0.275)).toBeCloseTo(15, 10);
    expect(interpolerPaliers(c.dispersion, 0.6)).toBe(0);
    expect(interpolerPaliers(c.anciennete, 18)).toBe(7.5);
    expect(interpolerPaliers([], 4)).toBe(0);
  });
});

describe('précision, dispersion et localisation du repère', () => {
  it('précision écrite, sinon déduite du rayon', () => {
    expect(precisionDe(dvf({ medianM2: 3000, nombreVentes: 5, precision: 'rue' }))).toBe('rue');
    expect(precisionDe(dvf({ medianM2: 3000, nombreVentes: 5, rayonMetres: 500 }))).toBe(
      'quartier',
    );
    expect(precisionDe(dvf({ medianM2: 3000, nombreVentes: 5 }))).toBe('commune');
  });

  it('dispersion = écart interquartile ÷ médiane, null sans les deux quartiles', () => {
    expect(
      dispersionDe(dvf({ medianM2: 3423, q1M2: 2833, q3M2: 4135, nombreVentes: 1 })),
    ).toBeCloseTo(0.3804, 4);
    expect(dispersionDe(dvf({ medianM2: 3000, q1M2: 2800, nombreVentes: 1 }))).toBeNull();
  });

  it('localisation : immeuble, rue, quartier par rayon, commune', () => {
    expect(pointsLocalisation('immeuble', undefined, regles)).toBe(35);
    expect(pointsLocalisation('rue', 90, regles)).toBe(30);
    expect(pointsLocalisation('quartier', 90, regles)).toBe(26);
    expect(pointsLocalisation('quartier', 100, regles)).toBe(26);
    expect(pointsLocalisation('quartier', 150, regles)).toBe(22);
    expect(pointsLocalisation('quartier', 300, regles)).toBe(18);
    expect(pointsLocalisation('quartier', 500, regles)).toBe(12);
    expect(pointsLocalisation('quartier', undefined, regles)).toBe(12);
    expect(pointsLocalisation('commune', undefined, regles)).toBe(4);
  });

  it('barème de quartier sans palier ouvert : le dernier palier ; sans palier : zéro', () => {
    const sansOuvert = avecQuartier([{ jusquaMetres: 100, points: 26 }]);
    expect(pointsLocalisation('quartier', 500, sansOuvert)).toBe(26);
    expect(pointsLocalisation('quartier', undefined, avecQuartier([]))).toBe(0);
    expect(pointsLocalisation('quartier', 50, avecQuartier([]))).toBe(0);
  });
});

describe('confianceEstimation', () => {
  it('sans adresse, arrondissement aux prix dispersés (cas de Pierre) : faible', () => {
    const marseille5 = dvf({
      medianM2: 3423,
      q1M2: 2833,
      q3M2: 4135,
      nombreVentes: 1823,
      precision: 'commune',
      ancienneteMedianeMois: 12,
    });
    // 4 + 20 + 30 × (0,45 − 0,3804) ÷ 0,35 = 5,97 → 6 + 15 × (30 − 12) ÷ 24 = 11,25 → 11.
    expect(confianceEstimation(marseille5, regles)).toEqual({
      note: 41,
      niveau: 'faible',
      precision: 'commune',
      composantes: [
        { code: 'localisation', valeur: null, points: 4, maximum: 35, supposee: false },
        { code: 'comparables', valeur: 1823, points: 20, maximum: 20, supposee: false },
        { code: 'dispersion', valeur: 0.3804, points: 6, maximum: 30, supposee: false },
        { code: 'anciennete', valeur: 12, points: 11, maximum: 15, supposee: false },
      ],
    });
  });

  it('adresse, 15 ventes à moins de 100 m, resserrées et récentes (cas de Pierre) : élevée', () => {
    const proche = dvf({
      medianM2: 3600,
      q1M2: 3384,
      q3M2: 3816,
      nombreVentes: 15,
      rayonMetres: 90,
      precision: 'quartier',
      ancienneteMedianeMois: 8,
    });
    // 26 + (12 + 8 × 5 ÷ 20 = 14) + (dispersion 0,12 → 28,3 → 28) + (8 mois → 13,75 → 14).
    const confiance = confianceEstimation(proche, regles);
    expect(confiance).toMatchObject({ note: 82, niveau: 'elevee', precision: 'quartier' });
    expect(confiance.composantes.map((x) => [x.code, x.valeur, x.points])).toEqual([
      ['localisation', 90, 26],
      ['comparables', 15, 14],
      ['dispersion', 0.12, 28],
      ['anciennete', 8, 14],
    ]);
  });

  it('même immeuble, six ventes resserrées récentes : élevée ; même rue : bonne', () => {
    const immeuble = dvf({
      medianM2: 3600,
      q1M2: 3420,
      q3M2: 3780,
      nombreVentes: 6,
      rayonMetres: 10,
      precision: 'immeuble',
      ancienneteMedianeMois: 4,
    });
    expect(confianceEstimation(immeuble, regles)).toMatchObject({ note: 85, niveau: 'elevee' });
    const rue = dvf({ ...immeuble, precision: 'rue', rayonMetres: 90, ancienneteMedianeMois: 15 });
    // 30 + 5 + 30 + (15 mois → 9,4 → 9) = 74.
    expect(confianceEstimation(rue, regles)).toMatchObject({ note: 74, niveau: 'bonne' });
  });

  it('projet enregistré avant la feature : précision déduite du rayon, ancienneté supposée', () => {
    const ancien = dvf({
      medianM2: 3050,
      q1M2: 2700,
      q3M2: 3400,
      nombreVentes: 31,
      rayonMetres: 500,
    });
    // 12 + 20 + (0,2295 → 18,9 → 19) + (12 mois supposés → 11) = 62.
    const confiance = confianceEstimation(ancien, regles);
    expect(confiance).toMatchObject({ note: 62, niveau: 'moyenne', precision: 'quartier' });
    expect(confiance.composantes[0]).toEqual({
      code: 'localisation',
      valeur: 500,
      points: 12,
      maximum: 35,
      supposee: false,
    });
    expect(confiance.composantes[3]).toEqual({
      code: 'anciennete',
      valeur: 12,
      points: 11,
      maximum: 15,
      supposee: true,
    });
    expect(confianceEstimation(dvf({ ...ancien, rayonMetres: undefined }), regles)).toMatchObject({
      note: 54,
      precision: 'commune',
    });
    // Précision « quartier » écrite sans rayon : dernier palier, rayon inconnu.
    const sansRayon = confianceEstimation(
      dvf({ ...ancien, rayonMetres: undefined, precision: 'quartier' }),
      regles,
    );
    expect(sansRayon.composantes[0]).toMatchObject({ valeur: null, points: 12 });
  });

  it('sans quartiles (repère saisi à la main) : dispersion inconnue, zéro point', () => {
    const confiance = confianceEstimation(dvf({ medianM2: 3000, nombreVentes: 40 }), regles);
    expect(confiance).toMatchObject({ note: 35, niveau: 'faible' });
    expect(confiance.composantes[2]).toEqual({
      code: 'dispersion',
      valeur: null,
      points: 0,
      maximum: 30,
      supposee: false,
    });
  });

  it('très faible : commune, deux ventes, sans quartiles, ventes anciennes', () => {
    const confiance = confianceEstimation(
      dvf({ medianM2: 3000, nombreVentes: 2, ancienneteMedianeMois: 40 }),
      regles,
    );
    expect(confiance).toMatchObject({ note: 4, niveau: 'tres_faible' });
  });

  it('sans seuil à zéro dans les règles, le niveau retombe sur « très faible »', () => {
    const niveaux: readonly SeuilNiveau[] = [{ des: 80, niveau: 'elevee' }];
    const confiance = confianceEstimation(
      dvf({ medianM2: 3000, nombreVentes: 40 }),
      avecConfiance({ niveaux }),
    );
    expect(confiance.niveau).toBe('tres_faible');
  });

  it('les maxima des quatre composantes font 100', () => {
    const confiance = confianceEstimation(dvf({ medianM2: 3000, nombreVentes: 1 }), regles);
    expect(confiance.composantes.reduce((somme, x) => somme + x.maximum, 0)).toBe(100);
  });
});
