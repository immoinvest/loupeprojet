import { describe, expect, it } from 'vitest';

import { dependancesDepuisEnv, type Bindings } from '../src/dependances';
import type { KvMinimal } from '../src/proxy/cache';
import { limiteurMemoire } from '../src/proxy/debit';
import { LIMITE_SUGGESTIONS, URL_AUTOCOMPLETION, type SuggestionAdresse } from '../src/services';
import { banc, reponseJson } from './aide';

/** Réponse Géoplateforme en autocomplétion pour « 144 rue de l'oli » (numéro, rue, commune). */
const AUTOCOMPLETION = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [5.393807, 43.294813] },
      properties: {
        label: "144 Rue de l'Olivier 13005 Marseille",
        type: 'housenumber',
        id: '13205_6659_00144',
        housenumber: '144',
        street: "Rue de l'Olivier",
        name: "144 Rue de l'Olivier",
        postcode: '13005',
        citycode: '13205',
        city: 'Marseille',
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [5.3941, 43.2951] },
      properties: {
        label: "Rue de l'Olivier 13005 Marseille",
        type: 'street',
        id: '13205_6659',
        name: "Rue de l'Olivier",
        postcode: '13005',
        citycode: '13205',
        city: 'Marseille',
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [5.42, 43.52] },
      properties: { label: 'Les Olivades', type: 'locality', name: 'Les Olivades' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [4.8, 43.9] },
      properties: { label: 'Olivier', type: 'municipality', citycode: '84999', city: 'Olivier' },
    },
  ],
};

interface Enveloppe {
  service: string;
  donnees: { suggestions: SuggestionAdresse[] };
}

describe('GET /proxy/adresses', () => {
  it('autocomplétion de la Géoplateforme, biais de position, sans les communes seules', async () => {
    const { requete, appels } = banc({
      fetcher: (url) => {
        appels.push(url);
        return Promise.resolve(reponseJson(AUTOCOMPLETION));
      },
    });
    const r = await requete(
      `/proxy/adresses?q=${encodeURIComponent("144 rue de l'oli")}&lat=43.29&lon=5.39&codePostal=13005`,
    );
    expect(r.status).toBe(200);
    const url = appels[0];
    expect(`${String(url?.origin)}${String(url?.pathname)}`).toBe(URL_AUTOCOMPLETION);
    expect(Object.fromEntries(url?.searchParams ?? [])).toEqual({
      q: "144 rue de l'oli",
      autocomplete: '1',
      index: 'address',
      limit: String(LIMITE_SUGGESTIONS),
      lat: '43.29',
      lon: '5.39',
      postcode: '13005',
    });
    const corps = await r.json<Enveloppe>();
    expect(corps.service).toBe('adresses');
    expect(corps.donnees.suggestions).toEqual([
      {
        libelle: "144 Rue de l'Olivier 13005 Marseille",
        precision: 'adresse',
        numero: '144',
        rue: "Rue de l'Olivier",
        codePostal: '13005',
        commune: 'Marseille',
        codeInsee: '13205',
        lat: 43.294813,
        lon: 5.393807,
        cleBan: '13205_6659_00144',
      },
      {
        libelle: "Rue de l'Olivier 13005 Marseille",
        precision: 'rue',
        numero: null,
        rue: "Rue de l'Olivier",
        codePostal: '13005',
        commune: 'Marseille',
        codeInsee: '13205',
        lat: 43.2951,
        lon: 5.3941,
        cleBan: '13205_6659',
      },
      {
        libelle: 'Les Olivades',
        precision: 'lieu_dit',
        numero: null,
        rue: 'Les Olivades',
        codePostal: null,
        commune: null,
        codeInsee: null,
        lat: 43.52,
        lon: 5.42,
        cleBan: null,
      },
    ]);
  });

  it('sans biais ni code postal ; une précision inconnue et un numéro sans rue restent lisibles', async () => {
    const { requete, appels } = banc({
      fetcher: (url) => {
        appels.push(url);
        return Promise.resolve(
          reponseJson({
            features: [
              {
                geometry: { coordinates: [1, 2] },
                properties: { label: 'X', type: 'poi' },
              },
              {
                geometry: { coordinates: [1, 2] },
                properties: { label: '3 Y', type: 'housenumber', name: '3 Y', housenumber: '3' },
              },
            ],
          }),
        );
      },
    });
    const r = await requete('/proxy/adresses?q=abc&limit=2');
    expect(appels[0]?.searchParams.has('lat')).toBe(false);
    expect(appels[0]?.searchParams.has('postcode')).toBe(false);
    expect(appels[0]?.searchParams.get('limit')).toBe('2');
    const suggestions = (await r.json<Enveloppe>()).donnees.suggestions;
    expect(suggestions.map((s) => [s.precision, s.rue])).toEqual([
      ['inconnue', null],
      ['adresse', null],
    ]);
  });

  it('ne lit ni n’écrit jamais le cache KV', async () => {
    let lectures = 0;
    let ecritures = 0;
    const { requete } = banc({
      cache: {
        lire: () => {
          lectures += 1;
          return Promise.resolve(null);
        },
        ecrire: () => {
          ecritures += 1;
          return Promise.resolve();
        },
      },
      fetcher: () => Promise.resolve(reponseJson(AUTOCOMPLETION)),
    });
    for (const q of ['144 r', '144 ru', '144 rue']) {
      const r = await requete(`/proxy/adresses?q=${encodeURIComponent(q)}`);
      expect(r.headers.get('X-Loupe-Cache')).toBe('MISS');
    }
    expect({ lectures, ecritures }).toEqual({ lectures: 0, ecritures: 0 });
  });

  it('refuse lat sans lon, un texte trop court ou un code postal invalide', async () => {
    const { requete } = banc();
    const r = await requete('/proxy/adresses?q=ab&lat=43&codePostal=1300');
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({
      code: 'PARAMETRES_INVALIDES',
      details: { champs: ['q', 'codePostal', 'lat'] },
    });
  });

  it('Géoplateforme en panne ou réponse invalide : 502', async () => {
    const panne = banc({ fetcher: () => Promise.resolve(reponseJson({}, 500)) });
    expect((await panne.requete('/proxy/adresses?q=144 rue')).status).toBe(502);
    const invalide = banc({ fetcher: () => Promise.resolve(reponseJson({ features: 'non' })) });
    expect(await (await invalide.requete('/proxy/adresses?q=144 rue')).json()).toMatchObject({
      code: 'AMONT_INVALIDE',
    });
  });

  it('limite dédiée : les suggestions ne consomment pas la limite des autres services', async () => {
    const { requete } = banc({ fetcher: () => Promise.resolve(reponseJson(AUTOCOMPLETION)) }, 1);
    // Banc à 1 requête/min pour le proxy, 2 pour les suggestions.
    expect((await requete('/proxy/adresses?q=144 rue')).status).toBe(200);
    expect((await requete('/proxy/adresses?q=144 rue de')).status).toBe(200);
    expect((await requete('/proxy/adresses?q=144 rue de l')).status).toBe(429);
    // Le géocodage garde sa propre limite (sa réponse simulée n'est pas la sienne : 502, mais pas 429).
    expect((await requete('/proxy/geocodage?q=144 rue')).status).not.toBe(429);
    expect((await requete('/proxy/geocodage?q=144 rue de')).status).toBe(429);
  });
});

describe('limiteur des suggestions en production', () => {
  const kv: KvMinimal = { get: () => Promise.resolve(null), put: () => Promise.resolve() };
  const limiteur = limiteurMemoire(60, 60, () => 0);
  const base: Bindings = {
    KV_CACHE: kv,
    LIMITEUR: limiteur,
    LIMITEUR_EXTRACTION: limiteur,
    LIMITEUR_LECTURE: limiteur,
    DONNEES: { get: () => Promise.resolve(null) },
  };

  it('binding dédié s’il existe, limite du proxy sinon', () => {
    const suggestions = limiteurMemoire(120, 60, () => 0);
    expect(dependancesDepuisEnv(base).limiteurSuggestions).toBe(limiteur);
    expect(
      dependancesDepuisEnv({ ...base, LIMITEUR_SUGGESTIONS: suggestions }).limiteurSuggestions,
    ).toBe(suggestions);
  });
});
