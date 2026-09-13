import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ZonageDepartementSchema } from '../../../src/schemas/zonage.ts';
import { API_JEU_ZONAGE } from '../../../src/sources/zonage/constantes.ts';
import { urlRessourceZonage } from '../../../src/sources/zonage/ressource.ts';
import { executerZonage } from '../../../src/sources/zonage/source.ts';
import {
  dossierTemporaire,
  fauxContexte,
  lireFixture,
  reponseTexte,
  type Repondeur,
} from '../../aides/faux-contexte.ts';

const URL_CSV =
  'https://static.data.gouv.fr/resources/liste-des-communes-selon-le-zonage-abc/20260703-091314/liste-ensemble-des-communes-zonage-abc-en-vigueur-26-juin-2026.csv';

let jeu: string;
let csv: Buffer;
let dossier: string;

beforeAll(async () => {
  jeu = (await lireFixture('zonage/jeu-data-gouv.json')).toString('utf8');
  csv = await lireFixture('zonage/zonage-abc-extrait.csv');
});

beforeEach(async () => {
  dossier = await dossierTemporaire();
});

afterEach(async () => {
  await rm(dossier, { recursive: true, force: true });
});

const repondeur: Repondeur = (url) => {
  if (url === API_JEU_ZONAGE) {
    return reponseTexte(jeu);
  }
  if (url === URL_CSV) {
    return reponseTexte(csv);
  }
  return undefined;
};

describe('urlRessourceZonage', () => {
  it('retient le CSV « ensemble des communes » le plus récent, pas le xlsx ni les listes partielles', async () => {
    const faux = fauxContexte(repondeur, dossier);
    expect(await urlRessourceZonage(faux.contexte)).toBe(URL_CSV);
    expect(faux.journal[0]).toMatchObject({
      message: 'zonage : ressource retenue',
      titre: 'Liste ensemble des communes - Zonage ABC en vigueur 26 juin 2026.csv',
    });
  });

  it('échoue si le jeu ne contient plus de CSV national', async () => {
    const faux = fauxContexte(() => Response.json({ resources: [] }), dossier);
    await expect(urlRessourceZonage(faux.contexte)).rejects.toThrow('aucun CSV');
  });
});

describe('executerZonage', () => {
  it('publie un JSON par département avec la date d’entrée en vigueur comme millésime', async () => {
    const faux = fauxContexte(repondeur, dossier);
    await executerZonage(faux.contexte, { departements: ['2A', '13', '971', '976'] });

    const corse = ZonageDepartementSchema.parse(
      JSON.parse(await readFile(join(dossier, 'zonage', '2A.json'), 'utf8')),
    );
    expect(corse).toMatchObject({
      millesime: '2026-06-26',
      departement: '2A',
      communes: { '2A004': 'A', '2A247': 'A' },
    });
    const guadeloupe = JSON.parse(await readFile(join(dossier, 'zonage', '971.json'), 'utf8')) as {
      communes: Record<string, string>;
    };
    expect(guadeloupe.communes).toEqual({ '97101': 'B1' });
    await expect(readFile(join(dossier, 'zonage', '75.json'))).rejects.toThrow();
    expect(faux.journal).toContainEqual(
      expect.objectContaining({
        message: 'zonage : département absent de la source',
        departement: '976',
      }),
    );
    expect(faux.journal).toContainEqual(
      expect.objectContaining({
        message: 'zonage : fichier lu',
        communes: 8,
        ignorees: 0,
        millesime: '2026-06-26',
      }),
    );
  });

  it('se rabat sur la date du jour quand l’en-tête ne porte pas de date, et compte les zones inconnues', async () => {
    const faux = fauxContexte((url) => {
      if (url === API_JEU_ZONAGE) {
        return reponseTexte(jeu);
      }
      return reponseTexte(
        'CODGEO;DEP;LIBGEO;Zonage ABC\r\n01001;01;Abergement;C\r\n01002;01;Inconnue;Z\r\n',
      );
    }, dossier);
    await executerZonage(faux.contexte, { departements: ['01'] });
    const ain = JSON.parse(await readFile(join(dossier, 'zonage', '01.json'), 'utf8')) as {
      millesime: string;
      communes: Record<string, string>;
    };
    expect(ain.millesime).toBe('2026-09-13');
    expect(ain.communes).toEqual({ '01001': 'C' });
    expect(faux.journal).toContainEqual(
      expect.objectContaining({ niveau: 'avertissement', millesime: '2026-09-13' }),
    );
    expect(faux.journal).toContainEqual(
      expect.objectContaining({ message: 'zonage : fichier lu', ignorees: 1 }),
    );
  });

  it('échoue si le CSV n’a pas de colonne de zone', async () => {
    const faux = fauxContexte((url) => {
      if (url === API_JEU_ZONAGE) {
        return reponseTexte(jeu);
      }
      return reponseTexte('CODGEO;DEP;LIBGEO\r\n01001;01;Abergement\r\n');
    }, dossier);
    await expect(executerZonage(faux.contexte, { departements: ['01'] })).rejects.toThrow(
      'aucune colonne',
    );
  });
});
