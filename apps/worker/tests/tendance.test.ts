import { describe, expect, it } from 'vitest';

import {
  coefficientPour,
  lireTendance,
  lisser,
  resumeTendance,
  semestreDe,
  semestreDecale,
  serieRetenue,
  type PointIndice,
  type PointTendance,
  type Tendance,
} from '../src/adresse';
import { lecteurMemoire } from '../src/donnees/lecteur';
import { nouvellePasse } from '../src/donnees/passe';
import { banc, reponseJson } from './aide';

const point = (periode: string, medianeM2: number, ventes = 100): PointTendance => ({
  periode,
  ventes,
  medianeM2,
});

/** Trois semestres : 3 000, 3 000 puis 3 300 €/m² → indices lissés 3 000, 3 100, 3 150. */
const POINTS = [point('2024-S1', 3000), point('2024-S2', 3000), point('2025-S1', 3300)];
const INDICES = lisser(POINTS);

const indice = (periode: string, valeur: number): PointIndice => ({
  ...point(periode, valeur),
  indice: valeur,
});

describe('semestres', () => {
  it('coupe l’année au 30 juin et décale d’un nombre de semestres', () => {
    expect(semestreDe('2024-06-30')).toBe('2024-S1');
    expect(semestreDe('2024-07-01')).toBe('2024-S2');
    expect(semestreDecale('2025-S1', -1)).toBe('2024-S2');
    expect(semestreDecale('2025-S1', -2)).toBe('2024-S1');
    expect(semestreDecale('2024-S2', 1)).toBe('2025-S1');
  });
});

describe('lisser', () => {
  it('moyenne mobile sur trois semestres pondérée par les ventes', () => {
    expect(
      lisser([
        point('2024-S1', 3000, 100),
        point('2024-S2', 3200, 300),
        point('2025-S1', 3600),
      ]).map((p) => p.indice),
    ).toEqual([3150, 3240, 3300]);
    expect(INDICES.map((p) => p.indice)).toEqual([3000, 3100, 3150]);
  });
});

describe('coefficientPour', () => {
  it('ramène une vente au dernier semestre publié', () => {
    expect(coefficientPour(INDICES, '2024-08-01')).toBeCloseTo(3150 / 3100, 10);
    expect(coefficientPour(INDICES, '2025-05-01')).toBe(1);
    expect(coefficientPour(INDICES, '2026-01-15')).toBe(1);
  });

  it('semestre non publié : le plus proche avant ; avant la série : le premier ; sans série : 1', () => {
    const troue = [indice('2024-S1', 3000), indice('2025-S1', 3150)];
    expect(coefficientPour(troue, '2024-09-01')).toBeCloseTo(1.05, 10);
    expect(coefficientPour(INDICES, '2023-03-01')).toBeCloseTo(1.05, 10);
    expect(coefficientPour([], '2024-09-01')).toBe(1);
  });
});

describe('resumeTendance', () => {
  it('évolution sur un an et deux ans, null quand le semestre de départ manque', () => {
    expect(resumeTendance('commune', INDICES)).toEqual({
      zone: 'commune',
      periodeReference: '2025-S1',
      evolution1an: 0.05,
      evolution2ans: null,
      points: INDICES,
    });
    const cinq = [
      indice('2023-S1', 2800),
      indice('2023-S2', 2900),
      indice('2024-S1', 3000),
      indice('2024-S2', 3100),
      indice('2025-S1', 3150),
    ];
    expect(resumeTendance('departement', cinq)).toMatchObject({
      evolution1an: 0.05,
      evolution2ans: 0.125,
    });
    expect(resumeTendance('departement', [])).toMatchObject({
      periodeReference: '',
      evolution1an: null,
      evolution2ans: null,
    });
  });
});

describe('serieRetenue', () => {
  const tendance: Tendance = {
    seriesDepartement: { appartement: POINTS },
    communes: {
      '13205': { appartement: POINTS, maison: [point('2024-S1', 2000), point('2024-S2', 2100)] },
      '13201': { appartement: [point('2023-S2', 4000), point('2024-S2', 4100)] },
    },
  };

  it('la commune quand elle va jusqu’au dernier semestre du département, sinon le département', () => {
    expect(serieRetenue(tendance, '13205', 'appartement')?.zone).toBe('commune');
    expect(serieRetenue(tendance, '13201', 'appartement')?.zone).toBe('departement');
    expect(serieRetenue(tendance, '13206', 'appartement')?.zone).toBe('departement');
    expect(serieRetenue(tendance, '13205', 'maison')?.zone).toBe('commune');
    expect(serieRetenue(tendance, '13206', 'maison')).toBeNull();
    const vides: Tendance = {
      seriesDepartement: { appartement: [] },
      communes: { '13205': { appartement: [] } },
    };
    expect(serieRetenue(vides, '13205', 'appartement')?.zone).toBe('commune');
  });
});

describe('lireTendance', () => {
  it('lit le fichier du département ; absent → null sans panne ; hors contrat → null journalisé', async () => {
    const fichier = { seriesDepartement: { appartement: POINTS }, communes: {} };
    const { deps, journal } = banc({
      donnees: lecteurMemoire({
        'dvf/2025/tendance/2A.json': fichier,
        'dvf/2025/tendance/13.json': { communes: 'non' },
      }),
    });
    const passe = nouvellePasse(deps);
    expect(await lireTendance(passe, '2025', '2A004')).toEqual(fichier);
    expect(await lireTendance(passe, '2025', '97411')).toBeNull();
    expect(passe.panne).toBe(false);
    expect(await lireTendance(passe, '2025', '13205')).toBeNull();
    expect(journal.evenements.map((e) => e.evenement)).toEqual(['donnees.invalides']);
  });
});

const ENTETE =
  'date,prix,surface,type,pieces,lat,lon,idParcelle,numero,suffixe,codeVoie,voie,carrez';
const ligne = (date: string, prix: number): string =>
  `${date},${String(prix)},60,appartement,3,43.294813,5.393807,132058200E0318,144,,6659,RUE DE L OLIVIER,`;
/** Une vente de fin 2024 à 3 000 €/m² et quatre ventes de 2025 à 3 300 €/m², au même point. */
const CSV = `${[
  ENTETE,
  ligne('2024-11-02', 180000),
  ...[1, 2, 3, 4].map(() => ligne('2025-03-01', 198000)),
].join('\n')}\n`;
const REQUETE = '/marche/adresse?codeInsee=13205&lat=43.294813&lon=5.393807&surface=60';
const SANS_PARCELLE = (): Promise<Response> => Promise.resolve(reponseJson({ features: [] }));

interface Reponse {
  reference: { code: string; statistiques: { medianeM2: number; minM2: number } } | null;
  ventesProches: { date: string; prixM2: number; prixM2Actualise: number; coefficient: number }[];
  tendance: unknown;
}

describe('GET /marche/adresse avec tendance', () => {
  it('actualise les prix avant les statistiques et renvoie la tendance retenue', async () => {
    const donnees = lecteurMemoire({
      'dvf/2025/13205.csv': CSV,
      'dvf/2025/tendance/13.json': {
        seriesDepartement: { appartement: POINTS },
        communes: { '13205': { appartement: POINTS } },
      },
    });
    const { requete } = banc({ fetcher: SANS_PARCELLE, donnees });
    const corps = await (await requete(REQUETE)).json<Reponse>();
    expect(corps.reference).toMatchObject({
      code: 'rayon_100',
      statistiques: { medianeM2: 3300, minM2: 3048 },
    });
    expect(corps.ventesProches.find((v) => v.date === '2024-11-02')).toMatchObject({
      prixM2: 3000,
      prixM2Actualise: 3048,
      coefficient: 1.0161,
    });
    expect(corps.tendance).toEqual({
      zone: 'commune',
      periodeReference: '2025-S1',
      evolution1an: 0.05,
      evolution2ans: null,
      points: INDICES,
    });
  });

  it('sans fichier de tendance : prix de l’acte, tendance nulle, réponse mise en cache', async () => {
    const { requete } = banc({
      fetcher: SANS_PARCELLE,
      donnees: lecteurMemoire({ 'dvf/2025/13205.csv': CSV }),
    });
    const corps = await (await requete(REQUETE)).json<Reponse>();
    expect(corps.tendance).toBeNull();
    expect(corps.ventesProches[0]).toMatchObject({ coefficient: 1 });
    expect(corps.reference?.statistiques.minM2).toBe(3000);
    expect((await requete(REQUETE)).headers.get('x-loupe-cache')).toBe('HIT');
  });

  it('tendance sans série pour ce type de logement : tendance nulle', async () => {
    const { requete } = banc({
      fetcher: SANS_PARCELLE,
      donnees: lecteurMemoire({
        'dvf/2025/13205.csv': CSV,
        'dvf/2025/tendance/13.json': { seriesDepartement: {}, communes: {} },
      }),
    });
    expect((await (await requete(REQUETE)).json<Reponse>()).tendance).toBeNull();
  });
});
