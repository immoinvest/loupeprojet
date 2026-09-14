import { describe, expect, it } from 'vitest';
import { lireCsv } from '../../../src/commun/csv.ts';
import { decoderTexte, depuisMorceaux } from '../../../src/commun/flux.ts';
import { urlAnneesRei, urlExportRei } from '../../../src/sources/taxe-fonciere/constantes.ts';
import {
  normaliserCodeInsee,
  tauxDepuisLignes,
} from '../../../src/sources/taxe-fonciere/transformer.ts';
import { lireFixture } from '../../aides/faux-contexte.ts';

describe('urlExportRei', () => {
  it('filtre par département, exercice, catégorie Taux et variables retenues', () => {
    const url = new URL(urlExportRei('2A', '2025'));
    expect(url.origin + url.pathname).toBe(
      'https://data.ofgl.fr/api/explore/v2.1/catalog/datasets/rei/exports/csv',
    );
    expect(url.searchParams.get('where')).toBe(
      'dep="2A" and annee="2025" and categorie="Taux" and var in ("E12","E22","E32","E52gGEMAPI","E52","E52A","E52TASA","F22")',
    );
    expect(url.searchParams.get('delimiter')).toBe(';');
    expect(urlAnneesRei()).toContain('/facets?facet=annee');
  });
});

describe('tauxDepuisLignes', () => {
  it('additionne les postes par commune en décimal, TEOM à part, et ignore les taux votés et les montants vides', async () => {
    const octets = await lireFixture('taxe-fonciere/rei-2A-extrait.csv');
    const communes = await tauxDepuisLignes(
      lireCsv(decoderTexte(depuisMorceaux([octets]), 'utf-8'), { separateur: ';' }),
    );
    expect(Object.keys(communes).sort()).toEqual(['2A004', '2A130', '2A215', '2A240', '2A247']);
    expect(communes['2A004']).toEqual({
      commune: 0.3065,
      syndicats: 0,
      intercommunalite: 0.06,
      gemapi: 0.0092,
      tse: 0.00336,
      total: 0.37906,
      teom: 0.125,
    });
    expect(communes['2A130']).toEqual({
      commune: 0.2512,
      syndicats: 0.0522,
      intercommunalite: 0.06,
      gemapi: 0.00127,
      tse: 0.00336,
      total: 0.36803,
    });
    expect(communes['2A247']).toMatchObject({ intercommunalite: 0, total: 0.29304 });
    expect(communes['2A247']).not.toHaveProperty('teom');
  });

  it('ignore une valeur illisible', async () => {
    const communes = await tauxDepuisLignes(
      depuisMorceaux([
        { idcom: '01001', var: 'E12', valeur: 'n/a' },
        { idcom: '01001', var: 'E32', valeur: '2.5' },
      ]),
    );
    expect(communes['01001']).toEqual({
      commune: 0,
      syndicats: 0,
      intercommunalite: 0.025,
      gemapi: 0,
      tse: 0,
      total: 0.025,
    });
  });

  it('rétablit le zéro initial perdu par le REI pour les départements 01 à 09', async () => {
    const communes = await tauxDepuisLignes(
      depuisMorceaux([
        { idcom: '1109', var: 'E12', valeur: '29.9' },
        { idcom: '1109', var: 'E32', valeur: '1.1' },
        { idcom: '97101', var: 'E12', valeur: '40' },
      ]),
    );
    expect(Object.keys(communes).sort()).toEqual(['01109', '97101']);
    expect(communes['01109']).toMatchObject({
      commune: 0.299,
      intercommunalite: 0.011,
      total: 0.31,
    });
  });
});

describe('normaliserCodeInsee', () => {
  it('complète un code de quatre chiffres et laisse les autres intacts', () => {
    expect(normaliserCodeInsee('1109')).toBe('01109');
    expect(normaliserCodeInsee('13055')).toBe('13055');
    expect(normaliserCodeInsee('2A004')).toBe('2A004');
    expect(normaliserCodeInsee('97101')).toBe('97101');
  });
});
