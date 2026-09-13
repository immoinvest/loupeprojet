import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CommunesDepartementSchema } from '../../../src/schemas/communes.ts';
import { urlArrondissements, urlCommunes } from '../../../src/sources/communes/constantes.ts';
import { executerCommunes } from '../../../src/sources/communes/source.ts';
import { communesDepuisApi } from '../../../src/sources/communes/transformer.ts';
import {
  dossierTemporaire,
  fauxContexte,
  lireFixture,
  reponseTexte,
  type Repondeur,
} from '../../aides/faux-contexte.ts';

const reponses = new Map<string, Buffer>();
let dossier: string;

beforeAll(async () => {
  reponses.set(urlCommunes('2A'), await lireFixture('communes/2A-communes.json'));
  reponses.set(urlCommunes('13'), await lireFixture('communes/13-communes.json'));
  reponses.set(urlArrondissements('13'), await lireFixture('communes/13-arrondissements.json'));
});

beforeEach(async () => {
  dossier = await dossierTemporaire();
});

afterEach(async () => {
  await rm(dossier, { recursive: true, force: true });
});

const repondeur: Repondeur = (url) => {
  const contenu = reponses.get(url);
  return contenu === undefined ? undefined : reponseTexte(contenu);
};

describe('communesDepuisApi', () => {
  it('omet population et EPCI absents et rattache les arrondissements', () => {
    const communes = communesDepuisApi([{ nom: 'Alata', code: '2A006', codesPostaux: ['20167'] }], {
      communeParente: '13055',
      liste: [
        {
          nom: 'Marseille 1er Arrondissement',
          code: '13201',
          codesPostaux: ['13001'],
          population: 37599,
        },
      ],
    });
    expect(communes).toEqual({
      '2A006': { nom: 'Alata', codesPostaux: ['20167'] },
      '13201': {
        nom: 'Marseille 1er Arrondissement',
        codesPostaux: ['13001'],
        population: 37599,
        communeParente: '13055',
      },
    });
  });
});

describe('executerCommunes', () => {
  it('publie les communes par département, arrondissements compris pour Marseille', async () => {
    const faux = fauxContexte(repondeur, dossier);
    await executerCommunes(faux.contexte, { departements: ['2A', '13'] });

    const corse = CommunesDepartementSchema.parse(
      JSON.parse(await readFile(join(dossier, 'communes', '2A.json'), 'utf8')),
    );
    expect(corse).toMatchObject({ millesime: '2026-09-13', departement: '2A' });
    expect(Object.keys(corse.communes)).toEqual(['2A001', '2A004', '2A006']);
    expect(corse.communes['2A004']).toEqual({
      nom: 'Ajaccio',
      codesPostaux: ['20000', '20090', '20167'],
      population: 76320,
      epci: '242010056',
    });
    expect(corse.communes['2A006']).toEqual({ nom: 'Alata', codesPostaux: ['20167'] });

    const bouches = CommunesDepartementSchema.parse(
      JSON.parse(await readFile(join(dossier, 'communes', '13.json'), 'utf8')),
    );
    expect(Object.keys(bouches.communes)).toEqual(['13001', '13055', '13201', '13202']);
    expect(bouches.communes['13201']).toMatchObject({ communeParente: '13055', population: 37599 });
    expect(bouches.communes['13055']).not.toHaveProperty('communeParente');

    expect(faux.appels.map((appel) => appel.url)).toEqual([
      urlCommunes('2A'),
      urlCommunes('13'),
      urlArrondissements('13'),
    ]);
    expect(faux.journal).toContainEqual(
      expect.objectContaining({ departement: '13', communes: 2, arrondissements: 2 }),
    );
  });

  it('refuse une réponse qui ne ressemble pas à l’API Géo', async () => {
    const faux = fauxContexte(() => Response.json([{ nom: 'Sans code' }]), dossier);
    await expect(executerCommunes(faux.contexte, { departements: ['2A'] })).rejects.toThrow();
  });
});
