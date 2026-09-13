import { describe, expect, it } from 'vitest';
import type { TypeLogement, Vente } from '../../../src/schemas/dvf.ts';
import { TendanceDvfDepartementSchema } from '../../../src/schemas/dvf.ts';
import {
  semestreDe,
  serieDesVentes,
  tendanceDesVentes,
} from '../../../src/sources/dvf/tendance.ts';

/** Une vente de 50 m² au prix au m² donné. */
function vente(date: string, prixM2: number, type: TypeLogement = 'appartement'): Vente {
  return {
    date,
    prix: prixM2 * 50,
    surface: 50,
    type,
    pieces: 2,
    lat: null,
    lon: null,
    idParcelle: null,
    numero: null,
    suffixe: null,
    codeVoie: null,
    voie: null,
    carrez: null,
  };
}

describe('semestreDe', () => {
  it('coupe l’année au 30 juin', () => {
    expect(semestreDe('2024-01-01')).toBe('2024-S1');
    expect(semestreDe('2024-06-30')).toBe('2024-S1');
    expect(semestreDe('2024-07-01')).toBe('2024-S2');
    expect(semestreDe('2024-12-31')).toBe('2024-S2');
  });

  it('refuse une date mal formée', () => {
    expect(() => semestreDe('2024/07/01')).toThrow(RangeError);
  });
});

describe('serieDesVentes', () => {
  it('rend la médiane par semestre, triée, en écartant les semestres sous le seuil', () => {
    const ventes = [
      vente('2025-02-01', 3600),
      vente('2024-08-01', 3000),
      vente('2024-09-01', 3500),
      vente('2024-10-01', 3100),
      vente('2025-03-01', 3200),
      vente('2023-05-01', 2800), // seul dans son semestre : écarté
    ];
    expect(serieDesVentes(ventes, 2)).toEqual([
      { periode: '2024-S2', ventes: 3, medianeM2: 3100 },
      { periode: '2025-S1', ventes: 2, medianeM2: 3400 },
    ]);
  });

  it('arrondit la médiane à l’euro et rend une série vide sans vente', () => {
    expect(serieDesVentes([vente('2024-01-10', 3000.4), vente('2024-02-10', 3001)], 1)).toEqual([
      { periode: '2024-S1', ventes: 2, medianeM2: 3001 },
    ]);
    expect(serieDesVentes([], 1)).toEqual([]);
  });
});

describe('tendanceDesVentes', () => {
  const ventesParCommune = new Map<string, Vente[]>([
    [
      '13205',
      [
        vente('2024-02-01', 3000),
        vente('2024-03-01', 3200),
        vente('2024-08-01', 3300),
        vente('2024-09-01', 3500),
        vente('2024-09-02', 2000, 'maison'),
      ],
    ],
    // Un seul semestre exploitable : pas de série pour cette commune.
    ['13201', [vente('2024-04-01', 4000), vente('2024-05-01', 4200)]],
  ]);

  it('publie la série du département et seulement les communes à deux semestres ou plus', () => {
    const tendance = tendanceDesVentes(ventesParCommune, 2);
    expect(tendance.seriesDepartement).toEqual({
      appartement: [
        { periode: '2024-S1', ventes: 4, medianeM2: 3600 },
        { periode: '2024-S2', ventes: 2, medianeM2: 3400 },
      ],
    });
    expect(tendance.communes).toEqual({
      '13205': {
        appartement: [
          { periode: '2024-S1', ventes: 2, medianeM2: 3100 },
          { periode: '2024-S2', ventes: 2, medianeM2: 3400 },
        ],
      },
    });
  });

  it('produit un fichier conforme au schéma publié', () => {
    const fichier = {
      genereLe: '2026-09-14T10:00:00.000Z',
      millesime: '2025',
      source: { nom: 'DVF', url: 'https://www.data.gouv.fr', licence: 'Licence Ouverte 2.0' },
      departement: '13',
      seuilVentes: 2,
      ...tendanceDesVentes(ventesParCommune, 2),
    };
    expect(TendanceDvfDepartementSchema.parse(fichier)).toEqual(fichier);
    expect(tendanceDesVentes(new Map(), 2)).toEqual({ seriesDepartement: {}, communes: {} });
  });
});
