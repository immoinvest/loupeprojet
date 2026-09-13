import { describe, expect, it } from 'vitest';
import { lireCsv } from '../../../src/commun/csv.ts';
import { collecter, decoderTexte, depuisMorceaux } from '../../../src/commun/flux.ts';
import {
  assemblerLoyers,
  indicateurDepuisLigne,
  nombreDecimal,
  type LigneIndicateur,
} from '../../../src/sources/loyers/transformer.ts';
import { lireFixture } from '../../aides/faux-contexte.ts';

async function lignesFixture(nom: string): Promise<LigneIndicateur[]> {
  const octets = await lireFixture(`loyers/${nom}.csv`);
  const enregistrements = await collecter(
    lireCsv(decoderTexte(depuisMorceaux([octets]), 'windows-1252'), { separateur: ';' }),
  );
  return enregistrements
    .map(indicateurDepuisLigne)
    .filter((ligne): ligne is LigneIndicateur => ligne !== null);
}

describe('nombreDecimal', () => {
  it('lit la virgule décimale française et rend NaN pour un champ vide', () => {
    expect(nombreDecimal('15,2151863505039')).toBeCloseTo(15.215, 3);
    expect(nombreDecimal(' 12.5 ')).toBe(12.5);
    expect(Number.isNaN(nombreDecimal(''))).toBe(true);
    expect(Number.isNaN(nombreDecimal('n/a'))).toBe(true);
  });
});

describe('indicateurDepuisLigne', () => {
  it("lit les indicateurs réels d'Ajaccio (commune) et de Carbuccia (maille)", async () => {
    const lignes = await lignesFixture('appartement');
    expect(lignes.find((ligne) => ligne.codeInsee === '2A004')).toEqual({
      codeInsee: '2A004',
      departement: '2A',
      indicateur: {
        loyerM2: 15.22,
        basM2: 11.98,
        hautM2: 19.33,
        maille: false,
        observations: 7460,
      },
    });
    expect(lignes.find((ligne) => ligne.codeInsee === '2A062')?.indicateur).toMatchObject({
      loyerM2: 14.6,
      maille: true,
      observations: 16,
    });
    expect(lignes.map((ligne) => ligne.departement).sort()).toEqual([
      '13',
      '26',
      '2A',
      '2A',
      '2A',
      '75',
    ]);
  });

  it('écarte une ligne sans loyer exploitable et lit zéro observation quand la colonne manque', () => {
    expect(
      indicateurDepuisLigne({ INSEE_C: '2A004', loypredm2: '', 'lwr.IPm2': '1', 'upr.IPm2': '2' }),
    ).toBeNull();
    expect(
      indicateurDepuisLigne({
        INSEE_C: '2A004',
        loypredm2: '10',
        'lwr.IPm2': '0',
        'upr.IPm2': '12',
      }),
    ).toBeNull();
    expect(
      indicateurDepuisLigne({
        INSEE_C: '2A004',
        DEP: '2A',
        loypredm2: '10,5',
        'lwr.IPm2': '8',
        'upr.IPm2': '12',
        TYPPRED: 'commune',
      })?.indicateur.observations,
    ).toBe(0);
  });
});

describe('assemblerLoyers', () => {
  it('rassemble les quatre indicateurs par commune et par département', async () => {
    const assemblage = assemblerLoyers(
      new Map([
        ['appartement', await lignesFixture('appartement')],
        ['appartementT1T2', await lignesFixture('appartement-t1-t2')],
        ['appartementT3Plus', await lignesFixture('appartement-t3-plus')],
        ['maison', await lignesFixture('maison')],
      ]),
    );
    expect([...assemblage.keys()].sort()).toEqual(['13', '26', '2A', '75']);
    const ajaccio = assemblage.get('2A')?.['2A004'];
    expect(ajaccio).toMatchObject({
      appartement: { loyerM2: 15.22 },
      appartementT1T2: { loyerM2: 18.97 },
      appartementT3Plus: { loyerM2: 15.48 },
      maison: { loyerM2: 16.01, observations: 278 },
    });
    expect(Object.keys(assemblage.get('2A') ?? {}).sort()).toEqual(['2A004', '2A062', '2A247']);
  });

  it('accepte un type absent pour une commune', () => {
    const assemblage = assemblerLoyers(
      new Map([
        [
          'maison',
          [
            {
              codeInsee: '01001',
              departement: '01',
              indicateur: { loyerM2: 9, basM2: 7, hautM2: 11, maille: true, observations: 0 },
            },
          ],
        ],
      ]),
    );
    expect(assemblage.get('01')?.['01001']).toEqual({
      maison: { loyerM2: 9, basM2: 7, hautM2: 11, maille: true, observations: 0 },
    });
  });
});
