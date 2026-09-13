import { describe, expect, it } from 'vitest';

import { VERSION_WORKER } from '../src/app';
import { banc, reponseJson } from './aide';

describe('santé et routes', () => {
  it('GET /health répond ok avec la version et l’environnement', async () => {
    const { requete } = banc();
    const r = await requete('/health');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, version: VERSION_WORKER, environnement: 'dev' });
  });

  it('une route inconnue rend 404 INTROUVABLE en JSON', async () => {
    const { requete } = banc();
    const r = await requete('/rien');
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ code: 'INTROUVABLE' });
  });

  it('un service inconnu rend 404 SERVICE_INCONNU', async () => {
    const { requete } = banc();
    const r = await requete('/proxy/meteo?q=amiens');
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ code: 'SERVICE_INCONNU' });
  });

  it('une erreur imprévue rend 500 ERREUR_INTERNE et la journalise', async () => {
    const { requete, journal } = banc({
      limiteur: { limit: () => Promise.reject(new Error('binding absent')) },
    });
    const r = await requete('/proxy/geocodage?q=8+bd+du+port+amiens');
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ code: 'ERREUR_INTERNE' });
    expect(journal.evenements).toEqual([
      {
        niveau: 'erreur',
        evenement: 'erreur.interne',
        donnees: { chemin: '/proxy/geocodage', raison: 'binding absent' },
      },
    ]);
  });
});

describe('CORS', () => {
  it('autorise la production, localhost et les previews Pages', async () => {
    const { requete } = banc();
    for (const origine of [
      'https://loupeprojet.pages.dev',
      'http://localhost:5173',
      'https://feat-worker.loupeprojet.pages.dev',
    ]) {
      const r = await requete('/health', { headers: { Origin: origine } });
      expect(r.headers.get('access-control-allow-origin')).toBe(origine);
    }
  });

  it('refuse les autres origines et répond aux préparations OPTIONS', async () => {
    const { requete } = banc();
    const r = await requete('/health', { headers: { Origin: 'https://pirate.example' } });
    expect(r.headers.get('access-control-allow-origin')).toBeNull();

    const options = await requete('/proxy/geocodage', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'GET' },
    });
    expect(options.status).toBe(204);
    expect(options.headers.get('access-control-allow-methods')).toContain('GET');
  });
});

describe('limite de débit', () => {
  it('refuse la troisième requête d’une même IP dans la minute, puis accepte à la minute suivante', async () => {
    const { requete, horloge, journal } = banc({}, 2);
    expect((await requete('/proxy/geocodage?q=8+bd+du+port+amiens')).status).toBe(200);
    expect((await requete('/proxy/geocodage?q=8+bd+du+port+amiens')).status).toBe(200);
    const refus = await requete('/proxy/geocodage?q=8+bd+du+port+amiens');
    expect(refus.status).toBe(429);
    expect(await refus.json()).toEqual({ code: 'TROP_DE_REQUETES' });
    expect(journal.evenements).toContainEqual({
      niveau: 'info',
      evenement: 'debit.refuse',
      donnees: { chemin: '/proxy/geocodage' },
    });
    // Une autre IP n'est pas concernée ; /health non plus.
    expect(
      (
        await requete('/proxy/geocodage?q=8+bd+du+port+amiens', {
          headers: { 'CF-Connecting-IP': '198.51.100.1' },
        })
      ).status,
    ).toBe(200);
    expect((await requete('/health')).status).toBe(200);
    horloge.valeur += 61_000;
    expect((await requete('/proxy/geocodage?q=8+bd+du+port+amiens')).status).toBe(200);
  });

  it('sans en-tête CF-Connecting-IP, la clé « inconnue » est partagée', async () => {
    const { requete } = banc({}, 1);
    const sans = { headers: {} };
    expect((await requete('/proxy/geocodage?q=8+bd+du+port+amiens', sans)).status).toBe(200);
    expect((await requete('/proxy/geocodage?q=8+bd+du+port+amiens', sans)).status).toBe(429);
  });
});

describe('proxy géocodage', () => {
  it('valide les paramètres et détaille les champs fautifs', async () => {
    const { requete, appels } = banc();
    const sansQ = await requete('/proxy/geocodage');
    expect(sansQ.status).toBe(400);
    expect(await sansQ.json()).toEqual({
      code: 'PARAMETRES_INVALIDES',
      details: { champs: ['q'] },
    });

    const tout = await requete('/proxy/geocodage?q=ab&limit=11&codePostal=1234');
    expect(await tout.json()).toEqual({
      code: 'PARAMETRES_INVALIDES',
      details: { champs: ['q', 'limit', 'codePostal'] },
    });
    expect(appels).toHaveLength(0);
  });

  it('appelle la Géoplateforme avec les seuls paramètres autorisés et normalise la réponse', async () => {
    const { requete, appels } = banc();
    const r = await requete('/proxy/geocodage?q=8+bd+du+port+amiens&codePostal=80000&inconnu=1');
    expect(r.status).toBe(200);
    expect(r.headers.get('x-loupe-cache')).toBe('MISS');
    expect(r.headers.get('cache-control')).toBe('public, max-age=3600');
    expect(r.headers.get('content-type')).toContain('application/json');
    expect(appels).toHaveLength(1);
    expect(appels[0]?.toString()).toBe(
      'https://data.geopf.fr/geocodage/search?q=8+bd+du+port+amiens&limit=5&postcode=80000',
    );
    expect(await r.json()).toEqual({
      service: 'geocodage',
      obtenuLe: '2026-09-13T10:00:00.000Z',
      donnees: {
        resultats: [
          {
            libelle: '8 Boulevard du Port 80000 Amiens',
            score: 0.9587,
            lat: 49.897443,
            lon: 2.290471,
            precision: 'adresse',
            cleBan: '80021_6590_00008',
            codeInsee: '80021',
            codePostal: '80000',
            commune: 'Amiens',
          },
          {
            libelle: 'Boulevard du Port 80000 Amiens',
            score: 0.8,
            lat: 49.9,
            lon: 2.3,
            precision: 'rue',
            cleBan: null,
            codeInsee: '80021',
            codePostal: '80000',
            commune: 'Amiens',
          },
        ],
      },
    });
  });

  it('sert la deuxième requête équivalente depuis le cache, avec la date d’origine', async () => {
    const { requete, appels, horloge } = banc();
    await requete('/proxy/geocodage?q=8+bd+du+port+amiens&limit=5');
    horloge.valeur += 3_600_000;
    const r = await requete('/proxy/geocodage?limit=5&q=8+bd+du+port+amiens');
    expect(r.headers.get('x-loupe-cache')).toBe('HIT');
    expect(appels).toHaveLength(1);
    const corps = await r.json<{ obtenuLe: string }>();
    expect(corps.obtenuLe).toBe('2026-09-13T10:00:00.000Z');
    // Après 24 h, l'entrée a expiré : nouvel appel amont.
    horloge.valeur += 24 * 3_600_000;
    const apres = await requete('/proxy/geocodage?q=8+bd+du+port+amiens');
    expect(apres.headers.get('x-loupe-cache')).toBe('MISS');
    expect(appels).toHaveLength(2);
  });

  it('un cache en panne n’empêche pas de répondre', async () => {
    const { requete, journal } = banc({
      cache: {
        lire: () => Promise.reject(new Error('kv hors service')),
        ecrire: () => Promise.reject(new Error('plein')),
      },
    });
    const r = await requete('/proxy/geocodage?q=8+bd+du+port+amiens');
    expect(r.status).toBe(200);
    expect(journal.evenements.map((e) => e.evenement)).toEqual([
      'cache.lecture_impossible',
      'cache.ecriture_impossible',
    ]);
    expect(journal.evenements[1]?.donnees).toMatchObject({ raison: 'plein' });
  });

  it('amont injoignable ou en erreur → 502, saturé → 503, réponse illisible ou hors contrat → 502', async () => {
    const cas: {
      fetcher: () => Promise<Response>;
      statut: number;
      code: string;
      details?: unknown;
    }[] = [
      {
        fetcher: () => Promise.reject(new Error('délai dépassé')),
        statut: 502,
        code: 'AMONT_INDISPONIBLE',
      },
      {
        fetcher: () => Promise.resolve(reponseJson({ message: 'erreur' }, 500)),
        statut: 502,
        code: 'AMONT_INDISPONIBLE',
        details: { statutAmont: 500 },
      },
      { fetcher: () => Promise.resolve(reponseJson({}, 429)), statut: 503, code: 'AMONT_SATURE' },
      {
        fetcher: () => Promise.resolve(new Response('<html>', { status: 200 })),
        statut: 502,
        code: 'AMONT_INVALIDE',
      },
      {
        fetcher: () => Promise.resolve(reponseJson({ features: [{ geometry: {} }] })),
        statut: 502,
        code: 'AMONT_INVALIDE',
      },
    ];
    for (const c of cas) {
      const { requete, journal } = banc({ fetcher: c.fetcher });
      const r = await requete('/proxy/geocodage?q=8+bd+du+port+amiens');
      expect(r.status).toBe(c.statut);
      expect(await r.json()).toEqual(
        c.details === undefined ? { code: c.code } : { code: c.code, details: c.details },
      );
      expect(journal.evenements).toHaveLength(1);
      expect(journal.evenements[0]?.niveau).toBe('erreur');
    }
  });
});
