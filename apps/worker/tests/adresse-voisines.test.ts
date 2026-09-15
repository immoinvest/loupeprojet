import { describe, expect, it } from 'vitest';

import type { Dependances } from '../src/dependances';
import { lecteurMemoire } from '../src/donnees/lecteur';
import { banc, reponseJson } from './aide';

const LAT = 43.294813;
const LON = 5.393807;
const M_LAT = 1 / 111_195;

const ENTETE =
  'date,prix,surface,type,pieces,lat,lon,idParcelle,numero,suffixe,codeVoie,voie,carrez';
const ligne = (date: string, prix: number, lat = LAT): string =>
  `${date},${String(prix)},60,appartement,3,${String(lat)},${String(LON)},,,,,,`;

/** Quatre ventes au bien (5e) à 3 300 €/m², en 2025. */
const CSV_13205 = `${[ENTETE, ...[1, 2, 3, 4].map(() => ligne('2025-03-01', 198000))].join('\n')}\n`;
/** Deux ventes à 80 m au nord, dans le 4e, fin 2024, à 3 000 €/m². */
const CSV_13204 = `${[ENTETE, ...[1, 2].map(() => ligne('2024-11-02', 180000, LAT + 80 * M_LAT))].join('\n')}\n`;

const point = (periode: string, medianeM2: number): Record<string, unknown> => ({
  periode,
  ventes: 100,
  medianeM2,
});

/**
 * Tendance du département : 3 000, 3 000, 3 300 (indices lissés 3 000, 3 100, 3 150).
 * Tendance du 4e : 3 000, 3 000, 3 600 (indices 3 000, 3 200, 3 300) → fin 2024 × 3 300 / 3 200.
 */
const TENDANCE = {
  seriesDepartement: {
    appartement: [point('2024-S1', 3000), point('2024-S2', 3000), point('2025-S1', 3300)],
  },
  communes: {
    '13204': {
      appartement: [point('2024-S1', 3000), point('2024-S2', 3000), point('2025-S1', 3600)],
    },
  },
};

type Fetcher = Dependances['fetcher'];

/** Au nord du bien le 4e arrondissement, ailleurs le 5e ; cadastre sans parcelle. */
const fetcher: Fetcher = (url) => {
  if (url.hostname === 'data.ademe.fr') return Promise.resolve(reponseJson({ results: [] }));
  if (url.hostname !== 'geo.api.gouv.fr') return Promise.resolve(reponseJson({ features: [] }));
  const lat = Number(url.searchParams.get('lat'));
  return Promise.resolve(reponseJson([{ code: lat > LAT + 0.001 ? '13204' : '13205' }]));
};

const REQUETE = `/marche/adresse?codeInsee=13205&lat=${String(LAT)}&lon=${String(LON)}&surface=60`;

interface Reponse {
  ventesCommune: number;
  communesVoisines: { codeInsee: string; ventes: number }[];
  groupes: {
    code: string;
    comparables: number;
    statistiques: { medianeM2: number; minM2: number } | null;
  }[];
  ventesProches: { date: string; prixM2Actualise: number }[];
  tendance: { zone: string } | null;
}

describe('GET /marche/adresse avec une commune voisine', () => {
  it('compte les ventes du 4e dans les cercles, actualisées par la tendance du 4e', async () => {
    const donnees = lecteurMemoire({
      'dvf/2025/13205.csv': CSV_13205,
      'dvf/2025/13204.csv': CSV_13204,
      'dvf/2025/tendance/13.json': TENDANCE,
    });
    const { requete } = banc({ fetcher, donnees });
    const r = await requete(REQUETE);
    const corps = await r.json<Reponse>();
    expect(corps.ventesCommune).toBe(4);
    expect(corps.communesVoisines).toEqual([{ codeInsee: '13204', ventes: 2 }]);
    const rayon100 = corps.groupes.find((g) => g.code === 'rayon_100');
    // 3 000 × 3 300 / 3 200 = 3 094 €/m² (la série du département aurait donné 3 048).
    expect(rayon100).toMatchObject({
      comparables: 6,
      statistiques: { medianeM2: 3300, minM2: 3094 },
    });
    expect(
      corps.ventesProches.filter((v) => v.date === '2024-11-02').map((v) => v.prixM2Actualise),
    ).toEqual([3094, 3094]);
    expect(corps.tendance).toMatchObject({ zone: 'departement' });
    expect(donnees.lectures).toContain('dvf/2025/13204.csv');
    expect((await requete(REQUETE)).headers.get('x-loupe-cache')).toBe('HIT');
  });

  it('commune voisine non publiée : ignorée ; API Géo en panne : analyse sans voisines, pas mise en cache', async () => {
    const sansVoisine = banc({
      fetcher,
      donnees: lecteurMemoire({ 'dvf/2025/13205.csv': CSV_13205 }),
    });
    expect((await (await sansVoisine.requete(REQUETE)).json<Reponse>()).communesVoisines).toEqual(
      [],
    );

    const panne = banc({
      fetcher: (url) =>
        url.hostname === 'geo.api.gouv.fr'
          ? Promise.reject(new Error('délai'))
          : Promise.resolve(reponseJson({ features: [] })),
      donnees: lecteurMemoire({ 'dvf/2025/13205.csv': CSV_13205, 'dvf/2025/13204.csv': CSV_13204 }),
    });
    const corps = await (await panne.requete(REQUETE)).json<Reponse>();
    expect(corps.communesVoisines).toEqual([]);
    expect(corps.ventesCommune).toBe(4);
    expect((await panne.requete(REQUETE)).headers.get('x-loupe-cache')).toBe('MISS');
  });
});
