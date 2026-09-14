import { describe, expect, it } from 'vitest';

import { distanceMetres } from '../src/adresse';
import type { Point } from '../src/adresse/geometrie';
import { communesAutour, pointsAutour, RAYON_VOISINES_M } from '../src/adresse/voisines';
import type { Dependances } from '../src/dependances';
import { cleCache } from '../src/proxy/cache';
import { banc, reponseJson } from './aide';

const CENTRE = { lat: 43.294813, lon: 5.393807 };
const GRENOBLE = { lat: 45.1885, lon: 5.7245 };

type Fetcher = Dependances['fetcher'];

/**
 * Indice, parmi les huit points autour de `centre`, du point que l'URL interroge.
 * Le faux service répond selon le point et non selon l'ordre d'arrivée des appels,
 * qui varie avec les calculs d'empreinte asynchrones faits avant chaque appel.
 */
function indicePoint(centre: Point, url: URL): number {
  const lat = Number(url.searchParams.get('lat'));
  const lon = Number(url.searchParams.get('lon'));
  const indice = pointsAutour(centre, RAYON_VOISINES_M).findIndex(
    (p) => Number(p.lat.toFixed(5)) === lat && Number(p.lon.toFixed(5)) === lon,
  );
  if (indice < 0) throw new Error(`Point inattendu : ${url.search}`);
  return indice;
}

/** Faux API Géo : au nord du bien, le 4e arrondissement ; ailleurs, le 5e. */
function fauxApiGeo(appels: URL[]): Fetcher {
  return (url) => {
    appels.push(url);
    const lat = Number(url.searchParams.get('lat'));
    return Promise.resolve(reponseJson([{ code: lat > CENTRE.lat + 0.001 ? '13204' : '13205' }]));
  };
}

describe('pointsAutour', () => {
  it('huit points à 300 m, tous les 45° depuis le nord', () => {
    const points = pointsAutour(CENTRE, 300);
    expect(points).toHaveLength(8);
    for (const p of points) expect(distanceMetres(CENTRE, p)).toBeCloseTo(300, 0);
    expect(points[0]?.lon).toBeCloseTo(CENTRE.lon, 9);
    expect(points[0]!.lat).toBeGreaterThan(CENTRE.lat);
    expect(points[2]?.lat).toBeCloseTo(CENTRE.lat, 9);
    expect(points[2]!.lon).toBeGreaterThan(CENTRE.lon);
  });
});

describe('communesAutour', () => {
  it('trouve l’arrondissement voisin, interroge les arrondissements, et garde les points en cache', async () => {
    const appels: URL[] = [];
    const { deps } = banc({ fetcher: fauxApiGeo(appels) });
    expect(await communesAutour(deps, CENTRE, '13205')).toEqual({
      codes: ['13204'],
      complet: true,
    });
    expect(appels).toHaveLength(8);
    expect(appels.every((u) => u.searchParams.get('type') === 'arrondissement-municipal')).toBe(
      true,
    );
    expect(`${appels[0]?.origin ?? ''}${appels[0]?.pathname ?? ''}`).toBe(
      'https://geo.api.gouv.fr/communes',
    );
    await communesAutour(deps, CENTRE, '13205');
    expect(appels).toHaveLength(8);
  });

  it('hors Paris, Lyon et Marseille : communes entières ; quatre voisines au plus ; point en mer', async () => {
    // Le deuxième point (nord-est) tombe en mer ; les sept autres sont dans sept communes différentes.
    const communes = ['38001', null, '38002', '38003', '38004', '38005', '38006', '38007'];
    const appels: URL[] = [];
    const { deps } = banc({
      fetcher: (url) => {
        appels.push(url);
        const code = communes[indicePoint(GRENOBLE, url)];
        return Promise.resolve(reponseJson(code ? [{ code }] : []));
      },
    });
    const r = await communesAutour(deps, GRENOBLE, '38185');
    expect(r).toEqual({ codes: ['38001', '38002', '38003', '38004'], complet: true });
    expect(appels).toHaveLength(8);
    expect(appels.some((u) => u.searchParams.has('type'))).toBe(false);
  });

  it('range les voisines dans l’ordre des points, quel que soit l’ordre des réponses', async () => {
    const reponses = new Map<number, () => void>();
    let tousInterroges: () => void = () => undefined;
    const huitAppels = new Promise<void>((resoudre) => {
      tousInterroges = resoudre;
    });
    const { deps } = banc({
      fetcher: (url) => {
        const indice = indicePoint(GRENOBLE, url);
        return new Promise<Response>((resoudre) => {
          reponses.set(indice, () => {
            resoudre(reponseJson([{ code: `3800${String(indice + 1)}` }]));
          });
          if (reponses.size === 8) tousInterroges();
        });
      },
    });
    const resultat = communesAutour(deps, GRENOBLE, '38185');
    await huitAppels;
    // Le dernier point répond le premier : rangés par arrivée, les codes seraient 38008, 38007…
    for (const indice of [7, 6, 5, 4, 3, 2, 1, 0]) {
      reponses.get(indice)?.();
      await new Promise<void>((suite) => {
        setTimeout(suite, 0);
      });
    }
    expect(await resultat).toEqual({
      codes: ['38001', '38002', '38003', '38004'],
      complet: true,
    });
  });

  it('pannes : liste partielle, jamais complète, journalisée ; cache illisible redemandé', async () => {
    const cas: [Fetcher, string][] = [
      [() => Promise.reject(new Error('délai')), 'communes.injoignable'],
      [() => Promise.resolve(reponseJson({}, 500)), 'communes.erreur'],
      [() => Promise.resolve(reponseJson({ code: 'non' })), 'communes.invalide'],
    ];
    for (const [fetcher, evenement] of cas) {
      const { deps, journal } = banc({ fetcher });
      expect(await communesAutour(deps, CENTRE, '13205')).toEqual({ codes: [], complet: false });
      expect(new Set(journal.evenements.map((e) => e.evenement))).toEqual(new Set([evenement]));
    }

    const appels: URL[] = [];
    const { deps } = banc({ fetcher: fauxApiGeo(appels) });
    const [nord] = pointsAutour(CENTRE, 300);
    const cle = await cleCache('commune-point', {
      version: 1,
      lat: Number(nord!.lat.toFixed(5)),
      lon: Number(nord!.lon.toFixed(5)),
      arrondissement: true,
    });
    await deps.cache.ecrire(cle, '{"autre":1}', 60);
    expect((await communesAutour(deps, CENTRE, '13205')).codes).toEqual(['13204']);
    expect(appels).toHaveLength(8);
  });
});
