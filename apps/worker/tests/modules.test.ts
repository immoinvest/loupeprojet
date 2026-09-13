import { afterEach, describe, expect, it, vi } from 'vitest';

import { lireOriginesSupplementaires, origineAutorisee, ORIGINES_DEFAUT } from '../src/cors';
import { dependancesDepuisEnv } from '../src/dependances';
import { ErreurAmontInvalide, ErreurConfiguration, messageDe } from '../src/erreurs';
import { journalConsole } from '../src/journal';
import { cacheKv, cacheMemoire, cleCache, empreinte, jsonCanonique } from '../src/proxy/cache';
import { limiteurMemoire } from '../src/proxy/debit';
import { SERVICES } from '../src/services';
import { REPONSE_GEOPLATEFORME } from './aide';

describe('cache', () => {
  it('le JSON canonique ne dépend pas de l’ordre des clés, y compris imbriquées', () => {
    expect(jsonCanonique({ b: 1, a: [{ d: null, c: 'x' }] })).toBe(
      '{"a":[{"c":"x","d":null}],"b":1}',
    );
    expect(jsonCanonique('texte')).toBe('"texte"');
    expect(jsonCanonique(null)).toBe('null');
  });

  it('la clé combine le service et l’empreinte SHA-256 des paramètres', async () => {
    const a = await cleCache('geocodage', { q: 'amiens', limit: 5 });
    const b = await cleCache('geocodage', { limit: 5, q: 'amiens' });
    const c = await cleCache('geocodage', { q: 'amiens', limit: 6 });
    const d = await cleCache('dpe', { q: 'amiens', limit: 5 });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toBe(d);
    expect(a).toMatch(/^geocodage:[0-9a-f]{64}$/);
    expect(await empreinte('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('le cache mémoire expire ses entrées', async () => {
    let t = 1_000_000;
    const cache = cacheMemoire(() => t);
    expect(await cache.lire('x')).toBeNull();
    await cache.ecrire('x', 'valeur', 60);
    expect(await cache.lire('x')).toBe('valeur');
    expect(cache.taille()).toBe(1);
    t += 60_000;
    expect(await cache.lire('x')).toBeNull();
    expect(cache.taille()).toBe(0);
  });

  it('le cache KV délègue à get(text) et put(expirationTtl)', async () => {
    const appels: unknown[] = [];
    const kv = {
      get: (cle: string, type: 'text') => {
        appels.push(['get', cle, type]);
        return Promise.resolve('trouvé');
      },
      put: (cle: string, valeur: string, options: { expirationTtl: number }) => {
        appels.push(['put', cle, valeur, options]);
        return Promise.resolve();
      },
    };
    const cache = cacheKv(kv);
    expect(await cache.lire('k')).toBe('trouvé');
    await cache.ecrire('k', 'v', 86_400);
    expect(appels).toEqual([
      ['get', 'k', 'text'],
      ['put', 'k', 'v', { expirationTtl: 86_400 }],
    ]);
  });
});

describe('limiteur mémoire', () => {
  it('compte par clé et par fenêtre', async () => {
    let t = 0;
    const limiteur = limiteurMemoire(2, 10, () => t);
    expect((await limiteur.limit({ key: 'a' })).success).toBe(true);
    expect((await limiteur.limit({ key: 'a' })).success).toBe(true);
    expect((await limiteur.limit({ key: 'a' })).success).toBe(false);
    expect((await limiteur.limit({ key: 'b' })).success).toBe(true);
    t = 10_000;
    expect((await limiteur.limit({ key: 'a' })).success).toBe(true);
  });
});

describe('origines', () => {
  it('reconnaît la production, localhost, les previews Pages ; refuse le reste', () => {
    expect(origineAutorisee('https://loupeprojet.pages.dev', ORIGINES_DEFAUT)).toBe(true);
    expect(origineAutorisee('http://localhost:5173', ORIGINES_DEFAUT)).toBe(true);
    expect(origineAutorisee('https://abc123.loupeprojet.pages.dev', ORIGINES_DEFAUT)).toBe(true);
    expect(origineAutorisee('https://loupeprojet.pages.dev.pirate.example', ORIGINES_DEFAUT)).toBe(
      false,
    );
    expect(origineAutorisee('http://loupeprojet.pages.dev', ORIGINES_DEFAUT)).toBe(false);
    expect(origineAutorisee('https://autre.example', ['https://autre.example'])).toBe(true);
  });

  it('lit la liste des origines supplémentaires', () => {
    expect(lireOriginesSupplementaires(undefined)).toEqual([]);
    expect(lireOriginesSupplementaires(' https://a.example , ,https://b.example')).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });
});

describe('dépendances depuis l’environnement', () => {
  const kv = { get: () => Promise.resolve(null), put: () => Promise.resolve() };
  const limiteur = { limit: () => Promise.resolve({ success: true }) };

  it('applique les valeurs par défaut et les origines supplémentaires', () => {
    const deps = dependancesDepuisEnv({
      KV_CACHE: kv,
      LIMITEUR: limiteur,
      LIMITEUR_EXTRACTION: limiteur,
    });
    expect(deps.environnement).toBe('dev');
    expect(deps.origines).toEqual(ORIGINES_DEFAUT);
    expect(deps.services).toBe(SERVICES);
    expect(deps.limiteur).toBe(limiteur);
    expect(deps.journal).toBe(journalConsole);
    expect(Math.abs(deps.maintenant() - Date.now())).toBeLessThan(1000);

    const prod = dependancesDepuisEnv({
      KV_CACHE: kv,
      LIMITEUR: limiteur,
      LIMITEUR_EXTRACTION: limiteur,
      ENVIRONNEMENT: 'production',
      ORIGINES_AUTORISEES: 'https://loupe.example',
    });
    expect(prod.environnement).toBe('production');
    expect(prod.origines).toEqual([...ORIGINES_DEFAUT, 'https://loupe.example']);
  });

  it('refuse un environnement inconnu', () => {
    expect(() =>
      dependancesDepuisEnv({
        KV_CACHE: kv,
        LIMITEUR: limiteur,
        LIMITEUR_EXTRACTION: limiteur,
        ENVIRONNEMENT: 'staging',
      }),
    ).toThrow(ErreurConfiguration);
  });

  it('le fetcher de production appelle fetch avec le délai et les en-têtes', async () => {
    const espion = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));
    const deps = dependancesDepuisEnv({
      KV_CACHE: kv,
      LIMITEUR: limiteur,
      LIMITEUR_EXTRACTION: limiteur,
    });
    const url = new URL('https://exemple.test/x');
    const init = { signal: AbortSignal.timeout(1000), headers: { accept: 'application/json' } };
    const r = await deps.fetcher(url, init);
    expect(r.status).toBe(200);
    expect(espion).toHaveBeenCalledWith(url, init);
  });
});

describe('journal console', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('écrit une ligne JSON par événement, sur la sortie standard ou d’erreur', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    journalConsole.info('demarrage', { version: '0.1.0' });
    journalConsole.erreur('panne');
    expect(log).toHaveBeenCalledWith('{"niveau":"info","evenement":"demarrage","version":"0.1.0"}');
    expect(error).toHaveBeenCalledWith('{"niveau":"erreur","evenement":"panne"}');
  });
});

describe('erreurs', () => {
  it('nomme ses classes et extrait un message de n’importe quoi', () => {
    expect(new ErreurConfiguration('x').name).toBe('ErreurConfiguration');
    expect(new ErreurAmontInvalide('y').name).toBe('ErreurAmontInvalide');
    expect(messageDe(new Error('boum'))).toBe('boum');
    expect(messageDe(42)).toBe('42');
  });
});

describe('service géocodage', () => {
  const geocodage = SERVICES.geocodage!;

  it('construit l’URL amont avec les valeurs par défaut', () => {
    const lecture = geocodage.lireParametres({ q: '  8 bd du port amiens ' });
    expect(lecture.ok).toBe(true);
    if (lecture.ok) {
      expect(lecture.parametres).toEqual({ q: '8 bd du port amiens', limit: 5 });
      expect(lecture.url.toString()).toBe(
        'https://data.geopf.fr/geocodage/search?q=8+bd+du+port+amiens&limit=5',
      );
    }
  });

  it('une réponse hors contrat lève ErreurAmontInvalide avec le chemin fautif', () => {
    expect(() => geocodage.normaliser({ features: 'non' })).toThrow(/geocodage : features/);
    expect(() => geocodage.normaliser(null)).toThrow(/racine/);
  });

  it('classe la précision, « inconnue » pour un type non prévu', () => {
    const amont = {
      ...REPONSE_GEOPLATEFORME,
      features: [
        {
          ...REPONSE_GEOPLATEFORME.features[0],
          properties: { ...REPONSE_GEOPLATEFORME.features[0]!.properties, type: 'poi' },
        },
      ],
    };
    const r = geocodage.normaliser(amont) as { resultats: { precision: string }[] };
    expect(r.resultats[0]?.precision).toBe('inconnue');
  });

  it('un résultat sans commune, code postal ni code INSEE rend des null', () => {
    const amont = {
      features: [
        {
          geometry: { coordinates: [5.37, 43.3] },
          properties: { label: 'Marseille', score: 0.5, type: 'municipality' },
        },
      ],
    };
    expect(geocodage.normaliser(amont)).toEqual({
      resultats: [
        {
          libelle: 'Marseille',
          score: 0.5,
          lat: 43.3,
          lon: 5.37,
          precision: 'commune',
          cleBan: null,
          codeInsee: null,
          codePostal: null,
          commune: null,
        },
      ],
    });
  });
});
