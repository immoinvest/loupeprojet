import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { LoyersDepartementSchema } from '../../../src/schemas/loyers.ts';
import { FICHIERS_LOYERS } from '../../../src/sources/loyers/constantes.ts';
import { executerLoyers } from '../../../src/sources/loyers/source.ts';
import {
  dossierTemporaire,
  fauxContexte,
  lireFixture,
  reponseTexte,
  type Repondeur,
} from '../../aides/faux-contexte.ts';

const fixtures = new Map<string, Buffer>();
let dossier: string;

beforeAll(async () => {
  fixtures.set(FICHIERS_LOYERS.appartement, await lireFixture('loyers/appartement.csv'));
  fixtures.set(FICHIERS_LOYERS.appartementT1T2, await lireFixture('loyers/appartement-t1-t2.csv'));
  fixtures.set(
    FICHIERS_LOYERS.appartementT3Plus,
    await lireFixture('loyers/appartement-t3-plus.csv'),
  );
  fixtures.set(FICHIERS_LOYERS.maison, await lireFixture('loyers/maison.csv'));
});

beforeEach(async () => {
  dossier = await dossierTemporaire();
});

afterEach(async () => {
  await rm(dossier, { recursive: true, force: true });
});

const repondeur: Repondeur = (url) => {
  const contenu = fixtures.get(url);
  return contenu === undefined ? undefined : reponseTexte(contenu);
};

describe('executerLoyers', () => {
  it('publie un JSON par département demandé, avec la mention ANIL et les communes triées', async () => {
    const faux = fauxContexte(repondeur, dossier);
    await executerLoyers(faux.contexte, { departements: ['2A', '13', '976'] });

    const corse = LoyersDepartementSchema.parse(
      JSON.parse(await readFile(join(dossier, 'loyers', '2025', '2A.json'), 'utf8')),
    );
    expect(corse).toMatchObject({
      genereLe: '2026-09-13T10:00:00.000Z',
      millesime: '2025',
      departement: '2A',
      source: {
        mention: 'Estimations ANIL, à partir des données du Groupe SeLoger et de leboncoin',
      },
    });
    expect(Object.keys(corse.communes)).toEqual(['2A004', '2A062', '2A247']);
    expect(corse.communes['2A004']).toEqual({
      appartement: {
        loyerM2: 15.22,
        basM2: 11.98,
        hautM2: 19.33,
        maille: false,
        observations: 7460,
      },
      appartementT1T2: {
        loyerM2: 18.97,
        basM2: 15.33,
        hautM2: 23.47,
        maille: false,
        observations: 3879,
      },
      appartementT3Plus: {
        loyerM2: 15.48,
        basM2: 11.56,
        hautM2: 20.73,
        maille: false,
        observations: 3623,
      },
      maison: { loyerM2: 16.01, basM2: 10.51, hautM2: 24.39, maille: false, observations: 278 },
    });

    const marseille = LoyersDepartementSchema.parse(
      JSON.parse(await readFile(join(dossier, 'loyers', '2025', '13.json'), 'utf8')),
    );
    expect(marseille.communes['13214']?.appartement?.loyerM2).toBe(14.31);

    await expect(readFile(join(dossier, 'loyers', '2025', '75.json'))).rejects.toThrow();
    expect(faux.journal).toContainEqual(
      expect.objectContaining({
        niveau: 'avertissement',
        message: 'loyers : département absent de la source',
        departement: '976',
      }),
    );
    expect(faux.journal.filter((entree) => entree.message === 'loyers : fichier lu')).toHaveLength(
      4,
    );
    expect(faux.journal).toContainEqual(
      expect.objectContaining({
        message: 'loyers : fichier lu',
        type: 'appartement',
        communes: 6,
        ignorees: 1,
      }),
    );
    expect(faux.journal.at(-1)).toMatchObject({
      message: 'loyers : départements publiés',
      departements: 2,
    });
    expect(JSON.parse(await readFile(join(dossier, 'loyers', 'courant.json'), 'utf8'))).toEqual({
      genereLe: '2026-09-13T10:00:00.000Z',
      millesime: '2025',
    });
  });
});
