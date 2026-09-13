import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TaxeFonciereDepartementSchema } from '../../../src/schemas/taxe-fonciere.ts';
import { detecterAnneeRei } from '../../../src/sources/taxe-fonciere/annee.ts';
import { urlAnneesRei, urlExportRei } from '../../../src/sources/taxe-fonciere/constantes.ts';
import { executerTaxeFonciere } from '../../../src/sources/taxe-fonciere/source.ts';
import {
  dossierTemporaire,
  fauxContexte,
  lireFixture,
  reponseTexte,
  type Repondeur,
} from '../../aides/faux-contexte.ts';

let extrait: Buffer;
let dossier: string;

beforeAll(async () => {
  extrait = await lireFixture('taxe-fonciere/rei-2A-extrait.csv');
});

beforeEach(async () => {
  dossier = await dossierTemporaire();
});

afterEach(async () => {
  await rm(dossier, { recursive: true, force: true });
});

const FACETTES = {
  facets: [
    { name: 'annee', facets: [{ name: '2024' }, { name: '2025' }] },
    { name: 'dep', facets: [{ name: '2A' }] },
  ],
};

const repondeur: Repondeur = (url) => {
  if (url === urlAnneesRei()) {
    return Response.json(FACETTES);
  }
  if (url === urlExportRei('2A', '2025')) {
    return reponseTexte(extrait);
  }
  if (url === urlExportRei('2B', '2025')) {
    return reponseTexte('﻿annee;dep;idcom;libcom;var;varlib;valeur\r\n');
  }
  return undefined;
};

describe('detecterAnneeRei', () => {
  it('rend le dernier exercice de la facette annee', async () => {
    const faux = fauxContexte(repondeur, dossier);
    expect(await detecterAnneeRei(faux.contexte)).toBe('2025');
  });

  it('échoue sans exercice exploitable', async () => {
    const faux = fauxContexte(
      () => Response.json({ facets: [{ name: 'dep', facets: [] }] }),
      dossier,
    );
    await expect(detecterAnneeRei(faux.contexte)).rejects.toThrow('aucun exercice trouvé');
  });
});

describe('executerTaxeFonciere', () => {
  it('publie les taux par commune du département, exercice détecté sur l’API', async () => {
    const faux = fauxContexte(repondeur, dossier);
    await executerTaxeFonciere(faux.contexte, { departements: ['2A', '2B'] });

    const corse = TaxeFonciereDepartementSchema.parse(
      JSON.parse(await readFile(join(dossier, 'taxe-fonciere', '2025', '2A.json'), 'utf8')),
    );
    expect(corse).toMatchObject({
      millesime: '2025',
      departement: '2A',
      source: { licence: 'Licence Ouverte 2.0' },
    });
    expect(Object.keys(corse.communes)).toEqual(['2A004', '2A130', '2A215', '2A240', '2A247']);
    expect(corse.communes['2A004']?.total).toBe(0.37906);

    await expect(readFile(join(dossier, 'taxe-fonciere', '2025', '2B.json'))).rejects.toThrow();
    expect(faux.journal).toContainEqual(
      expect.objectContaining({ niveau: 'avertissement', departement: '2B' }),
    );
    expect(faux.journal[0]).toMatchObject({
      message: 'taxe foncière : exercice REI retenu',
      annee: '2025',
    });
    expect(
      JSON.parse(await readFile(join(dossier, 'taxe-fonciere', 'courant.json'), 'utf8')),
    ).toEqual({ genereLe: '2026-09-13T10:00:00.000Z', millesime: '2025' });
  });

  it('accepte un exercice imposé sans interroger la facette', async () => {
    const faux = fauxContexte(repondeur, dossier);
    await executerTaxeFonciere(faux.contexte, { departements: ['2A'], annee: '2025' });
    expect(faux.appels.map((appel) => appel.url)).toEqual([urlExportRei('2A', '2025')]);
  });
});
