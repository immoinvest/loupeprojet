import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ErreurCsv } from '../../../src/commun/csv.ts';
import { ErreurTelechargement } from '../../../src/commun/telechargement.ts';
import {
  IndexDvfDepartementSchema,
  IndexDvfNationalSchema,
  TendanceDvfDepartementSchema,
} from '../../../src/schemas/dvf.ts';
import { urlDvf } from '../../../src/sources/dvf/constantes.ts';
import { detecterMillesime, executerDvf } from '../../../src/sources/dvf/source.ts';
import {
  dossierTemporaire,
  fauxContexte,
  lireFixture,
  reponseGzip,
  type Repondeur,
} from '../../aides/faux-contexte.ts';

const fixtures = new Map<number, Buffer>();
let dossier: string;

beforeAll(async () => {
  for (const annee of [2023, 2024, 2025]) {
    fixtures.set(annee, await lireFixture(`dvf/2A-${String(annee)}.csv`));
  }
});

beforeEach(async () => {
  dossier = await dossierTemporaire();
});

afterEach(async () => {
  await rm(dossier, { recursive: true, force: true });
});

/** Sert les trois fixtures annuelles de la Corse-du-Sud ; le dossier 2026 n'existe pas encore. */
const repondeurCorse: Repondeur = (url, init) => {
  const annee = [2023, 2024, 2025].find((candidat) => url === urlDvf(candidat, '2A'));
  if (annee === undefined) {
    return undefined;
  }
  const contenu = fixtures.get(annee);
  if (init?.method === 'HEAD') {
    return new Response(null);
  }
  return contenu === undefined ? undefined : reponseGzip(contenu);
};

async function lireSortie(relatif: string): Promise<string> {
  return readFile(join(dossier, relatif), 'utf8');
}

describe('detecterMillesime', () => {
  it("sonde par HEAD depuis l'année courante et rend le premier dossier existant", async () => {
    const faux = fauxContexte(repondeurCorse, dossier);
    expect(await detecterMillesime(faux.contexte, '2A')).toBe(2025);
    expect(faux.appels.map((appel) => appel.url)).toEqual([urlDvf(2026, '2A'), urlDvf(2025, '2A')]);
    expect(faux.appels.every((appel) => appel.methode === 'HEAD')).toBe(true);
  });

  it("échoue si aucun dossier récent n'existe", async () => {
    const faux = fauxContexte(() => undefined, dossier);
    await expect(detecterMillesime(faux.contexte, '2A')).rejects.toThrow(
      'aucun dossier DVF trouvé entre 2022 et 2026',
    );
  });
});

describe('executerDvf', () => {
  it("publie un CSV par commune et l'index du département sur une fenêtre de 24 mois", async () => {
    const faux = fauxContexte(repondeurCorse, dossier);
    await executerDvf(faux.contexte, { departements: ['2A'], passeComplete: false });

    expect(await lireSortie('dvf/2025/2A004.csv')).toBe(
      'date,prix,surface,type,pieces,lat,lon,idParcelle,numero,suffixe,codeVoie,voie,carrez\n' +
        '2024-01-01,150000,50,appartement,2,41.9,8.7,2A004000CB0005,6,,0700,RUE DES TROIS MARIE,50.4\n' +
        '2025-01-09,136000,66,appartement,4,41.934774,8.740565,2A004000BO0412,9001,,A090,RES DES CANNES,67.09\n' +
        '2025-01-13,93000,27,appartement,1,41.924773,8.735188,2A004000BW0375,9002,,0990,AV NAPOLEON 3,27.01\n' +
        '2025-06-15,120000,31,appartement,0,,,2A004000BW0999,9002,,0990,AV NAPOLEON 3,31.5\n' +
        '2025-12-31,160000,40,appartement,2,41.92,8.73,2A004000CA0004,5,,0600,RUE DU ROI DE ROME,40.3\n',
    );
    expect(await lireSortie('dvf/2025/2A062.csv')).toBe(
      'date,prix,surface,type,pieces,lat,lon,idParcelle,numero,suffixe,codeVoie,voie,carrez\n' +
        '2024-07-10,250000,100,maison,4,42.0381,8.9494,2A0620000B1204,5012,,B180,SAINT SYLVESTRE,\n' +
        '2025-01-02,311610,118,maison,4,42.038082,8.949341,2A0620000B1203,5011,,B180,SAINT SYLVESTRE,\n',
    );
    await expect(lireSortie('dvf/2025/2A041.csv')).rejects.toThrow(); // VEFA écartée
    await expect(lireSortie('dvf/2025/index.json')).rejects.toThrow(); // passe partielle
    await expect(lireSortie('dvf/courant.json')).rejects.toThrow(); // passe partielle

    const index = IndexDvfDepartementSchema.parse(
      JSON.parse(await lireSortie('dvf/2025/index/2A.json')),
    );
    expect(index).toMatchObject({
      genereLe: '2026-09-13T10:00:00.000Z',
      millesime: '2025',
      departement: '2A',
      fenetre: { debut: '2024-01-01', fin: '2025-12-31' },
      source: { licence: 'Licence Ouverte 2.0' },
    });
    expect(index.communes).toEqual({
      '2A004': {
        appartement: {
          ventes: 5,
          medianeM2: 3444,
          q1M2: 3000,
          q3M2: 3871,
          dateMediane: '2025-01-13',
        },
      },
      '2A062': {
        maison: { ventes: 2, medianeM2: 2570, q1M2: 2535, q3M2: 2606, dateMediane: '2024-07-10' },
      },
      '2A065': {
        appartement: {
          ventes: 1,
          medianeM2: 3804,
          q1M2: 3804,
          q3M2: 3804,
          dateMediane: '2025-01-22',
        },
      },
      '2A247': {
        appartement: {
          ventes: 1,
          medianeM2: 5217,
          q1M2: 5217,
          q3M2: 5217,
          dateMediane: '2025-01-20',
        },
      },
    });

    // Trop peu de ventes par semestre dans les fixtures : la tendance est publiée, vide.
    const tendance = TendanceDvfDepartementSchema.parse(
      JSON.parse(await lireSortie('dvf/2025/tendance/2A.json')),
    );
    expect(tendance).toMatchObject({
      millesime: '2025',
      departement: '2A',
      seuilVentes: 20,
      seriesDepartement: {},
      communes: {},
    });

    const bilan = faux.journal.find((entree) => entree.message === 'DVF : département publié');
    expect(bilan).toMatchObject({
      communes: 4,
      ventes: 9,
      mutations: 21,
      exclusions: {
        nature: 3,
        prix: 2,
        local_commercial: 1,
        logements: 2,
        surface: 1,
        prix_m2: 1,
        date: 0,
        rupture: 1,
      },
    });
    expect(faux.journal[0]).toMatchObject({ message: 'DVF : millésime retenu', millesime: 2025 });
  });

  it("écrit l'index national quand la passe est complète et accepte un millésime imposé", async () => {
    const faux = fauxContexte(repondeurCorse, dossier);
    await executerDvf(faux.contexte, {
      departements: ['2A'],
      passeComplete: true,
      millesime: 2025,
    });
    expect(faux.appels.some((appel) => appel.methode === 'HEAD')).toBe(false);
    const national = IndexDvfNationalSchema.parse(
      JSON.parse(await lireSortie('dvf/2025/index.json')),
    );
    expect(national.departements).toEqual(['2A']);
    expect(Object.keys(national.communes)).toEqual(['2A004', '2A062', '2A065', '2A247']);
    expect(JSON.parse(await lireSortie('dvf/courant.json'))).toEqual({
      genereLe: '2026-09-13T10:00:00.000Z',
      millesime: '2025',
    });
  });

  it('tolère un dossier annuel absent (404) avec un avertissement', async () => {
    const faux = fauxContexte(
      (url, init) => (url === urlDvf(2023, '2A') ? undefined : repondeurCorse(url, init)),
      dossier,
    );
    await executerDvf(faux.contexte, {
      departements: ['2A'],
      passeComplete: false,
      millesime: 2025,
    });
    expect(faux.journal).toContainEqual(
      expect.objectContaining({
        niveau: 'avertissement',
        message: 'dossier DVF absent pour cette année',
        url: urlDvf(2023, '2A'),
      }),
    );
    expect(await lireSortie('dvf/2025/2A247.csv')).toContain('2025-01-20,240000,46');
  });

  it('signale un département sans vente retenue et publie un index national vide', async () => {
    const enTete = fixtures.get(2025)?.toString('utf8').split('\n')[0] ?? '';
    const faux = fauxContexte(() => reponseGzip(`${enTete}\n`), dossier);
    await executerDvf(faux.contexte, {
      departements: ['2B'],
      passeComplete: true,
      millesime: 2025,
    });
    expect(faux.journal).toContainEqual(
      expect.objectContaining({ message: 'aucune vente de logement retenue', departement: '2B' }),
    );
    await expect(lireSortie('dvf/2025/index/2B.json')).rejects.toThrow();
    expect(JSON.parse(await lireSortie('dvf/2025/index.json'))).toMatchObject({
      departements: [],
      communes: {},
    });
  });

  it('propage les erreurs de téléchargement autres que 404 et les CSV mal formés', async () => {
    const enPanne = fauxContexte(() => new Response('', { status: 503 }), dossier);
    await expect(
      executerDvf(enPanne.contexte, {
        departements: ['2A'],
        passeComplete: false,
        millesime: 2025,
      }),
    ).rejects.toBeInstanceOf(ErreurTelechargement);
    expect(enPanne.pauses).toEqual([2000, 4000]);

    const malForme = fauxContexte(
      () => reponseGzip('id_mutation,valeur_fonciere\n2025-1\n'),
      dossier,
    );
    await expect(
      executerDvf(malForme.contexte, {
        departements: ['2A'],
        passeComplete: false,
        millesime: 2025,
      }),
    ).rejects.toBeInstanceOf(ErreurCsv);
  });
});
