import { describe, expect, it } from 'vitest';

import {
  adresseDe,
  analyserAdresse,
  anneauxDe,
  boiteAutour,
  distanceAnneaux,
  distanceMetres,
  distanceParcelles,
  distancePointSegment,
  estComparable,
  groupesDe,
  lireVentes,
  ParametresAdresseSchema,
  quantile,
  statistiquesPrix,
  valeurAuRang,
  voisinageDe,
  type BienAdresse,
  type VenteDvf,
} from '../src/adresse';
import type { Dependances } from '../src/dependances';
import { lecteurMemoire, lecteurR2 } from '../src/donnees/lecteur';
import { cleCache } from '../src/proxy/cache';
import { banc, reponseJson } from './aide';

/** 144 rue de l'Olivier, Marseille 5e (géocodage BAN du 13/09/2026). */
const LAT = 43.294813;
const LON = 5.393807;
const M_LAT = 1 / 111_195;
const M_LON = 1 / (111_195 * Math.cos((LAT * Math.PI) / 180));

const ENTETE =
  'date,prix,surface,type,pieces,lat,lon,idParcelle,numero,suffixe,codeVoie,voie,carrez';

interface Ligne {
  date: string;
  prix: number;
  surface: number;
  type: string;
  pieces: number | '';
  lat: number | string;
  lon: number | '';
  idParcelle: string;
  numero: number | '';
  suffixe: string;
  codeVoie: string;
  voie: string;
  carrez: number | '';
}

const BASE: Ligne = {
  date: '2025-03-01',
  prix: 240000,
  surface: 60,
  type: 'appartement',
  pieces: 3,
  lat: LAT,
  lon: LON,
  idParcelle: '132058200E0318',
  numero: 144,
  suffixe: '',
  codeVoie: '6659',
  voie: 'RUE DE L OLIVIER',
  carrez: 58.5,
};

function ligne(o: Partial<Ligne> = {}): string {
  const l = { ...BASE, ...o };
  return [
    l.date,
    l.prix,
    l.surface,
    l.type,
    l.pieces,
    l.lat,
    l.lon,
    l.idParcelle,
    l.numero,
    l.suffixe,
    l.codeVoie,
    l.voie,
    l.carrez,
  ].join(',');
}

/**
 * Une rue fictive calquée sur la rue de l'Olivier. Prix au m² des six comparables du même côté :
 * 4 000, 3 600, 3 387, 3 600, 2 929, 3 800 → médiane 3 600, quartiles 3 440 et 3 750.
 */
const CSV = `${[
  ENTETE,
  ligne(), // même immeuble, 4 000 €/m²
  ligne({ prix: 234000, surface: 65, date: '2024-11-02' }), // même immeuble, 3 600 €/m²
  ligne({
    idParcelle: '132058200E0319',
    numero: 146,
    prix: 210000,
    surface: 62,
    lon: LON + 12 * M_LON,
  }),
  ligne({
    idParcelle: '132058200E0520',
    numero: 145,
    prix: 180000,
    surface: 58,
    lat: LAT + 18 * M_LAT,
  }),
  ligne({
    idParcelle: '132058200E0600',
    numero: 150,
    prix: 198000,
    surface: 55,
    lon: LON + 40 * M_LON,
  }),
  ligne({
    idParcelle: '132058200E0610',
    numero: 152,
    prix: 205000,
    surface: 70,
    lon: LON + 60 * M_LON,
  }),
  ligne({
    idParcelle: '132058200E0620',
    numero: 160,
    prix: 190000,
    surface: 50,
    lon: LON + 90 * M_LON,
  }),
  ligne({
    idParcelle: '132058200F0001',
    codeVoie: '1234',
    voie: 'BD BAILLE',
    numero: 3,
    prix: 300000,
    lat: LAT + 150 * M_LAT,
  }),
  ligne({
    idParcelle: '132058200F0002',
    codeVoie: '1234',
    voie: 'BD BAILLE',
    numero: 5,
    type: 'maison',
    prix: 400000,
    surface: 110,
    lat: LAT + 250 * M_LAT,
  }),
  ligne({
    idParcelle: '132058200F0003',
    codeVoie: '9999',
    numero: 1,
    prix: 100000,
    lat: LAT + 900 * M_LAT,
  }),
].join('\n')}\n`;

const BIEN: BienAdresse = {
  point: { lat: LAT, lon: LON },
  numero: 144,
  codeVoie: '6659',
  idParcelle: '132058200E0318',
  voisines: ['132058200E0319'],
  type: 'appartement',
  surface: 60,
};

function vente(o: Partial<Ligne> = {}): VenteDvf {
  const [premiere] = lireVentes(`${ENTETE}\n${ligne(o)}`);
  if (premiere === undefined) throw new Error('ligne de test illisible');
  return premiere;
}

function carre(ouest: number, est: number, sud: number, nord: number): number[][][] {
  return [
    [
      [ouest, sud],
      [est, sud],
      [est, nord],
      [ouest, nord],
      [ouest, sud],
    ],
  ];
}

const PARCELLE_BIEN = {
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: carre(5.39375, 5.39386, 43.29476, 43.29486) },
  properties: { idu: '132058200E0318', contenance: 106 },
};
const PARCELLE_VOISINE = {
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: carre(5.39386, 5.39397, 43.29476, 43.29486) },
  properties: { idu: '132058200E0319' },
};
const PARCELLE_LOINTAINE = {
  type: 'Feature',
  geometry: {
    type: 'MultiPolygon',
    coordinates: [carre(5.3941, 5.3942, 43.29476, 43.29486)],
  },
  properties: { idu: '132058200E0400' },
};

type Fetcher = Dependances['fetcher'];

const BOITE_PAR_DEFAUT = (): Promise<Response> =>
  Promise.resolve(reponseJson({ features: [PARCELLE_BIEN, PARCELLE_VOISINE, PARCELLE_LOINTAINE] }));

/** Faux API Carto : la parcelle du bien au point, trois parcelles dans la boîte élargie. */
function fauxCadastre(appels: URL[], boite = BOITE_PAR_DEFAUT): Fetcher {
  return (url) => {
    // API Géo : aucune commune voisine autour de ce point.
    if (url.hostname === 'geo.api.gouv.fr') return Promise.resolve(reponseJson([]));
    appels.push(url);
    const geom = url.searchParams.get('geom') ?? '';
    return geom.includes('"Point"')
      ? Promise.resolve(reponseJson({ type: 'FeatureCollection', features: [PARCELLE_BIEN] }))
      : boite();
  };
}

const REQUETE =
  '/marche/adresse?codeInsee=13205&lat=43.294813&lon=5.393807&numero=144&codeVoie=6659&type=appartement&surface=60';

interface Reponse {
  codeInsee: string;
  millesime: string | null;
  parcelle: string | null;
  parcellesVoisines: string[];
  cadastre: string;
  ventesCommune: number;
  groupes: { code: string; ventes: number; comparables: number }[];
  reference: { code: string; rayonMetres: number; statistiques: Record<string, number> } | null;
  ventesProches: { adresse: string | null; distanceMetres: number | null }[];
  sources: { nom: string }[];
}

describe('lecture du CSV des ventes', () => {
  it('lit les colonnes d’adresse, tolère l’ancien format et ignore les lignes illisibles', () => {
    const ventes = lireVentes(
      `${ENTETE}\n${ligne({ pieces: '', lat: 'x', suffixe: 'B' })}\n\n` +
        `2025-01-01,0,60,appartement,3\n2025/01/01,1000,60,appartement\n2025-01-01,1000,60,terrain\n` +
        `2025-01-01,1000,60,maison\n`,
    );
    expect(ventes).toHaveLength(2);
    expect(ventes[0]).toMatchObject({ pieces: 0, lat: null, lon: LON, suffixe: 'B', carrez: 58.5 });
    expect(ventes[1]).toMatchObject({ type: 'maison', lat: null, idParcelle: null, voie: null });

    expect(
      lireVentes(
        'date,prix,surface,type,pieces,lat,lon\n2024-01-04,197650,60,appartement,3,43.29,5.39\n',
      ),
    ).toEqual([
      {
        date: '2024-01-04',
        prix: 197650,
        surface: 60,
        type: 'appartement',
        pieces: 3,
        lat: 43.29,
        lon: 5.39,
        idParcelle: null,
        numero: null,
        suffixe: null,
        codeVoie: null,
        voie: null,
        carrez: null,
      },
    ]);
    expect(lireVentes('')).toEqual([]);
  });
});

describe('géométrie', () => {
  it('distance à vol d’oiseau et distance à un segment', () => {
    expect(distanceMetres({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(111_195, -1);
    const a = { lat: LAT, lon: LON };
    const b = { lat: LAT, lon: LON + 20 * M_LON };
    expect(
      distancePointSegment({ lat: LAT + 10 * M_LAT, lon: LON + 10 * M_LON }, a, b),
    ).toBeCloseTo(10, 0);
    expect(distancePointSegment({ lat: LAT, lon: LON + 30 * M_LON }, a, b)).toBeCloseTo(10, 0);
    expect(distancePointSegment({ lat: LAT + 5 * M_LAT, lon: LON }, a, a)).toBeCloseTo(5, 0);
  });

  it('deux contours mitoyens sont à 0 m, une parcelle à une rue de là à une vingtaine de mètres', () => {
    const [bien] = anneauxDe(PARCELLE_BIEN.geometry as never);
    const [voisine] = anneauxDe(PARCELLE_VOISINE.geometry as never);
    const [lointaine] = anneauxDe(PARCELLE_LOINTAINE.geometry as never);
    expect(distanceAnneaux(bien!, voisine!)).toBeLessThan(0.01);
    expect(distanceAnneaux(bien!, lointaine!)).toBeGreaterThan(15);
    expect(distanceAnneaux(bien!, [])).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('statistiques et groupes', () => {
  it('quantiles et statistiques de prix', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(() => valeurAuRang([1], 1)).toThrow(RangeError);
    expect(statistiquesPrix([])).toBeNull();
    expect(statistiquesPrix([3000, 4000])).toEqual({
      ventes: 2,
      medianeM2: 3500,
      q1M2: 3250,
      q3M2: 3750,
      minM2: 3000,
      maxM2: 4000,
    });
  });

  it('classe une vente : même immeuble, voisine, même côté, en face, cercles', () => {
    expect(groupesDe(vente(), BIEN, 0)).toEqual([
      'meme_parcelle',
      'meme_cote',
      'rayon_100',
      'rayon_200',
      'rayon_300',
    ]);
    expect(groupesDe(vente({ idParcelle: '132058200E0319', numero: 145 }), BIEN, 150)).toEqual([
      'parcelles_voisines',
      'en_face',
      'rayon_200',
      'rayon_300',
    ]);
    expect(groupesDe(vente({ numero: '' }), { ...BIEN, idParcelle: null }, null)).toEqual([]);
    expect(groupesDe(vente({ idParcelle: '' }), { ...BIEN, codeVoie: null }, 350)).toEqual([]);
  });

  it('comparable : même type, surface à ±40 %', () => {
    expect(estComparable(vente({ type: 'maison' }), BIEN)).toBe(false);
    expect(estComparable(vente({ surface: 100 }), BIEN)).toBe(false);
    expect(estComparable(vente({ surface: 84 }), BIEN)).toBe(true);
    expect(estComparable(vente({ surface: 200 }), { ...BIEN, surface: undefined })).toBe(true);
  });

  it('libellé d’adresse', () => {
    expect(adresseDe(vente({ suffixe: 'B', numero: 12 }))).toBe('12B RUE DE L OLIVIER');
    expect(adresseDe(vente({ numero: '' }))).toBe('RUE DE L OLIVIER');
    expect(adresseDe(vente({ voie: '' }))).toBeNull();
  });
});

describe('analyserAdresse', () => {
  it('prend le même côté de la rue comme repère quand il compte au moins 5 comparables', () => {
    const r = analyserAdresse(lireVentes(CSV), BIEN);
    expect(r.ventesCommune).toBe(10);
    const parCode = Object.fromEntries(r.groupes.map((g) => [g.code, g]));
    expect(parCode.meme_parcelle).toMatchObject({ ventes: 2, comparables: 2 });
    expect(parCode.parcelles_voisines).toMatchObject({ ventes: 1, comparables: 1 });
    expect(parCode.meme_cote).toMatchObject({ ventes: 6, comparables: 6 });
    expect(parCode.en_face).toMatchObject({ ventes: 1, comparables: 1 });
    expect(parCode.rayon_100).toMatchObject({ ventes: 7, comparables: 7 });
    expect(parCode.rayon_200).toMatchObject({ ventes: 8, comparables: 8 });
    expect(parCode.rayon_300).toMatchObject({ ventes: 9, comparables: 8 });
    expect(r.reference).toEqual({
      code: 'meme_cote',
      rayonMetres: 90,
      statistiques: {
        ventes: 6,
        medianeM2: 3600,
        q1M2: 3440,
        q3M2: 3750,
        minM2: 2929,
        maxM2: 4000,
      },
    });
    expect(r.ventesProches).toHaveLength(8);
    expect(r.ventesProches[0]).toMatchObject({
      adresse: '144 RUE DE L OLIVIER',
      distanceMetres: 0,
    });
    expect(r.ventesProches.map((v) => v.distanceMetres)).toEqual([0, 0, 12, 18, 40, 60, 90, 150]);
  });

  it('sans assez de comparables : pas de repère ; ventes sans coordonnées classées en dernier', () => {
    const peu = analyserAdresse(
      lireVentes(`${ENTETE}\n${ligne()}\n${ligne({ numero: 146 })}\n`),
      BIEN,
    );
    expect(peu.reference).toBeNull();

    const sansCoordonnees = [1, 2, 3, 4, 5].map(() => ligne({ lat: '', lon: '' }));
    const autreParcelle = ligne({
      idParcelle: '132058200E0700',
      numero: 146,
      lon: LON + 30 * M_LON,
    });
    const r = analyserAdresse(
      lireVentes(`${ENTETE}\n${sansCoordonnees.join('\n')}\n${autreParcelle}\n`),
      BIEN,
    );
    expect(r.reference).toMatchObject({ code: 'meme_parcelle', rayonMetres: 10 });
    expect(r.ventesProches.map((v) => v.distanceMetres)).toEqual([
      30,
      null,
      null,
      null,
      null,
      null,
    ]);
  });
});

describe('cadastre', () => {
  it('contours d’un polygone, d’un multipolygone, d’un polygone vide ; boîte autour', () => {
    expect(anneauxDe({ type: 'Polygon', coordinates: [] })).toEqual([[]]);
    expect(anneauxDe(PARCELLE_LOINTAINE.geometry as never)[0]).toHaveLength(5);
    expect(boiteAutour([[]], 0.001)).toBeNull();
    const boite = boiteAutour(anneauxDe(PARCELLE_BIEN.geometry as never), 0.0001);
    const sommets = (boite?.coordinates as number[][][] | undefined)?.[0] ?? [];
    const attendus = [
      [5.39365, 43.29466],
      [5.39396, 43.29466],
      [5.39396, 43.29496],
      [5.39365, 43.29496],
      [5.39365, 43.29466],
    ];
    expect(sommets).toHaveLength(5);
    sommets.forEach((sommet, i) => {
      expect(sommet[0]).toBeCloseTo(attendus[i]![0]!, 9);
      expect(sommet[1]).toBeCloseTo(attendus[i]![1]!, 9);
    });
    const bien = { idu: 'a', anneaux: anneauxDe(PARCELLE_BIEN.geometry as never) };
    const loin = { idu: 'b', anneaux: anneauxDe(PARCELLE_LOINTAINE.geometry as never) };
    expect(distanceParcelles(bien, loin)).toBeGreaterThan(15);
  });

  it('trouve la parcelle du bien et ses seules voisines mitoyennes', async () => {
    const appels: URL[] = [];
    const { deps } = banc({ fetcher: fauxCadastre(appels) });
    expect(await voisinageDe(deps, { lat: LAT, lon: LON })).toEqual({
      idParcelle: '132058200E0318',
      voisines: ['132058200E0319'],
    });
    expect(appels).toHaveLength(2);
    expect(`${appels[0]?.origin ?? ''}${appels[0]?.pathname ?? ''}`).toBe(
      'https://apicarto.ign.fr/api/cadastre/parcelle',
    );
  });

  it('aucune parcelle au point, ou une parcelle sans contour', async () => {
    const vide = banc({ fetcher: () => Promise.resolve(reponseJson({ features: [] })) });
    expect(await voisinageDe(vide.deps, { lat: LAT, lon: LON })).toEqual({
      idParcelle: null,
      voisines: [],
    });
    const sansContour = banc({
      fetcher: () =>
        Promise.resolve(
          reponseJson({
            features: [
              { geometry: { type: 'Polygon', coordinates: [] }, properties: { idu: 'X' } },
            ],
          }),
        ),
    });
    expect(await voisinageDe(sansContour.deps, { lat: LAT, lon: LON })).toEqual({
      idParcelle: 'X',
      voisines: [],
    });
  });

  it('rend null et journalise quand le cadastre ne répond pas correctement', async () => {
    const cas: [Fetcher, string][] = [
      [() => Promise.reject(new Error('délai')), 'cadastre.injoignable'],
      [() => Promise.resolve(reponseJson({}, 503)), 'cadastre.erreur'],
      [() => Promise.resolve(new Response('<html>')), 'cadastre.invalide'],
      [() => Promise.resolve(reponseJson({ features: 'non' })), 'cadastre.invalide'],
      [fauxCadastre([], () => Promise.resolve(reponseJson({}, 500))), 'cadastre.erreur'],
    ];
    for (const [fetcher, evenement] of cas) {
      const { deps, journal } = banc({ fetcher });
      expect(await voisinageDe(deps, { lat: LAT, lon: LON })).toBeNull();
      expect(journal.evenements.map((e) => e.evenement)).toEqual([evenement]);
    }
  });
});

describe('GET /marche/adresse', () => {
  it('met le code de voie en majuscules et refuse les paramètres invalides', async () => {
    expect(
      ParametresAdresseSchema.parse({
        codeInsee: '2A004',
        lat: '41.9',
        lon: '8.7',
        codeVoie: 'b180',
      }),
    ).toMatchObject({ codeVoie: 'B180', type: 'appartement' });
    const { requete } = banc();
    const r = await requete('/marche/adresse?codeInsee=13205&lat=abc&codeVoie=66');
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({
      code: 'PARAMETRES_INVALIDES',
      details: { champs: ['lat', 'lon', 'codeVoie'] },
    });
  });

  it('analyse l’adresse avec le cadastre et les ventes de la commune, puis sert le cache', async () => {
    const appels: URL[] = [];
    const donnees = lecteurMemoire({ 'dvf/2025/13205.csv': CSV });
    const { requete } = banc({ fetcher: fauxCadastre(appels), donnees });
    const r = await requete(REQUETE);
    expect(r.status).toBe(200);
    expect(r.headers.get('x-loupe-cache')).toBe('MISS');
    const corps = await r.json<Reponse>();
    expect(corps).toMatchObject({
      codeInsee: '13205',
      millesime: '2025',
      parcelle: '132058200E0318',
      parcellesVoisines: ['132058200E0319'],
      cadastre: 'ok',
      ventesCommune: 10,
      reference: { code: 'meme_cote', rayonMetres: 90, statistiques: { medianeM2: 3600 } },
    });
    expect(corps.sources.map((s) => s.nom)).toEqual([
      'Demandes de valeurs foncières géolocalisées (Etalab, à partir des données DGFiP)',
    ]);
    expect(donnees.lectures).toEqual([
      'dvf/courant.json',
      'dvf/2026/13205.csv',
      'dvf/2025/13205.csv',
      'dvf/2025/tendance/13.json',
    ]);

    expect((await requete(REQUETE)).headers.get('x-loupe-cache')).toBe('HIT');
    // Autre surface : nouvelle analyse, mais le cadastre du même point vient du cache.
    const autre = await requete(REQUETE.replace('surface=60', 'surface=45'));
    expect(autre.headers.get('x-loupe-cache')).toBe('MISS');
    expect(appels).toHaveLength(2);
  });

  it('un cadastre en cache illisible est redemandé ; dvf/courant.json est suivi', async () => {
    const appels: URL[] = [];
    const donnees = lecteurMemoire({
      'dvf/courant.json': { genereLe: '2026-09-13T21:00:00.000Z', millesime: '2025' },
      'dvf/2025/13205.csv': CSV,
    });
    const { requete, deps } = banc({ fetcher: fauxCadastre(appels), donnees });
    const cle = await cleCache('cadastre', { version: 1, lat: LAT, lon: LON });
    await deps.cache.ecrire(cle, '{"autre":1}', 60);
    const corps = await (await requete(REQUETE)).json<Reponse>();
    expect(corps.parcelle).toBe('132058200E0318');
    expect(appels).toHaveLength(2);
    expect(donnees.lectures).not.toContain('dvf/2026/13205.csv');
  });

  it('cadastre indisponible : analyse sans parcelles, jamais mise en cache', async () => {
    const { requete } = banc({
      fetcher: () => Promise.reject(new Error('délai')),
      donnees: lecteurMemoire({ 'dvf/2025/13205.csv': CSV }),
    });
    const corps = await (await requete(REQUETE)).json<Reponse>();
    expect(corps).toMatchObject({
      cadastre: 'indisponible',
      parcelle: null,
      parcellesVoisines: [],
    });
    expect(corps.groupes.find((g) => g.code === 'meme_parcelle')?.ventes).toBe(0);
    expect(corps.groupes.find((g) => g.code === 'meme_cote')?.ventes).toBe(6);
    expect((await requete(REQUETE)).headers.get('x-loupe-cache')).toBe('MISS');
  });

  it('commune non publiée ou bucket en panne : réponse vide, panne jamais mise en cache', async () => {
    const vide = banc({ fetcher: fauxCadastre([]), donnees: lecteurMemoire({}) });
    expect(await (await vide.requete(REQUETE)).json<Reponse>()).toMatchObject({
      millesime: null,
      ventesCommune: 0,
      reference: null,
      sources: [],
    });

    const panne = banc({
      fetcher: fauxCadastre([]),
      donnees: {
        lireJson: () => Promise.resolve(null),
        lireTexte: () => Promise.reject(new Error('R2 indisponible')),
      },
    });
    const corps = await (await panne.requete(REQUETE)).json<Reponse>();
    expect(corps.millesime).toBeNull();
    expect(panne.journal.evenements[0]).toMatchObject({ evenement: 'donnees.lecture_impossible' });
    expect((await panne.requete(REQUETE)).headers.get('x-loupe-cache')).toBe('MISS');
  });

  it('est soumise à la limite de débit générale', async () => {
    const { requete } = banc({ fetcher: fauxCadastre([]), donnees: lecteurMemoire({}) }, 1);
    expect((await requete(REQUETE)).status).toBe(200);
    expect((await requete(REQUETE.replace('surface=60', 'surface=45'))).status).toBe(429);
  });

  it('le lecteur R2 lit un CSV comme texte, et rend null quand il est absent', async () => {
    const lecteur = lecteurR2({
      get: (cle) =>
        Promise.resolve(
          cle === 'dvf/2025/13205.csv'
            ? { json: <T>() => Promise.resolve({} as T), text: () => Promise.resolve(CSV) }
            : null,
        ),
    });
    expect(await lecteur.lireTexte('dvf/2025/13205.csv')).toBe(CSV);
    expect(await lecteur.lireTexte('dvf/2025/13206.csv')).toBeNull();
  });
});
