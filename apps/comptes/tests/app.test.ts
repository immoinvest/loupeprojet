import type { D1Database, ExecutionContext } from '@cloudflare/workers-types';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { VERSION_COMPTES } from '../src/app';
import type { Bindings, Dependances } from '../src/dependances';
import { ErreurConfiguration } from '../src/erreurs';
import { creerGestionnaire } from '../src/index';
import { journalMemoire } from '../src/journal';
import { banc } from './aide';

describe('santé et routes', () => {
  it('GET /api/comptes/sante répond ok avec la version et l’environnement', async () => {
    const { requete } = banc();
    const r = await requete('/api/comptes/sante');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, version: VERSION_COMPTES, environnement: 'dev' });
  });

  it('une route inconnue rend 404 INTROUVABLE en JSON', async () => {
    const { requete } = banc();
    const r = await requete('/api/rien');
    expect(r.status).toBe(404);
    expect(r.headers.get('content-type')).toContain('application/json');
    expect(await r.json()).toEqual({ code: 'INTROUVABLE' });
  });

  it('une erreur imprévue rend 500 ERREUR_INTERNE et la journalise sans donnée personnelle', async () => {
    // Une configuration qui explose à la lecture, comme un binding absent en production.
    const fournisseurs: Dependances['fournisseurs'] = {
      get google(): undefined {
        throw new Error('binding absent');
      },
    };
    const { requete, journal } = banc({ fournisseurs });
    const r = await requete('/api/comptes/fournisseurs');
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ code: 'ERREUR_INTERNE' });
    expect(journal.evenements).toEqual([
      {
        niveau: 'erreur',
        evenement: 'erreur.interne',
        donnees: { chemin: '/api/comptes/fournisseurs', raison: 'binding absent' },
      },
    ]);
  });
});

describe('fournisseurs', () => {
  it('en dev sans clé : seul l’e-mail est proposé, sans mise en cache', async () => {
    const { requete } = banc();
    const r = await requete('/api/comptes/fournisseurs');
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(await r.json()).toEqual({ email: true, google: false, apple: false });
  });

  it('reflète Google et Apple quand ils sont configurés', async () => {
    const { requete } = banc({
      fournisseurs: {
        google: { clientId: 'id', clientSecret: 'secret' },
        apple: { clientId: 'com.deklic.web', teamId: 'T', keyId: 'K', privateKey: 'clé' },
      },
    });
    expect(await (await requete('/api/comptes/fournisseurs')).json()).toEqual({
      email: true,
      google: true,
      apple: true,
    });
  });

  it('sans envoyeur, l’e-mail n’est pas proposé', async () => {
    const { requete } = banc({ environnement: 'production', courriel: null });
    expect(await (await requete('/api/comptes/fournisseurs')).json()).toEqual({
      email: false,
      google: false,
      apple: false,
    });
  });
});

describe('gestionnaire Pages (index)', () => {
  const contexte = {
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
    props: {},
  } as unknown as ExecutionContext;
  const env: Bindings = { DB: {} as D1Database };
  const statique = {
    fetch: (): Promise<Response> => Promise.resolve(new Response('<html>site</html>')),
  };

  function appTemoin(): Hono {
    const app = new Hono();
    app.get('/api/ping', (c) => c.text('pong'));
    return app;
  }

  it('envoie /api/* à l’application, construite une seule fois', async () => {
    let constructions = 0;
    const gestionnaire = creerGestionnaire(() => {
      constructions += 1;
      return appTemoin();
    });
    const r1 = await gestionnaire.fetch(new Request('https://deklic.test/api/ping'), env, contexte);
    const r2 = await gestionnaire.fetch(new Request('https://deklic.test/api'), env, contexte);
    expect(await r1.text()).toBe('pong');
    expect(r2.status).toBe(404);
    expect(constructions).toBe(1);
  });

  it('délègue le reste aux fichiers statiques, ou rend 404 sans binding ASSETS', async () => {
    const gestionnaire = creerGestionnaire(appTemoin);
    const site = await gestionnaire.fetch(
      new Request('https://deklic.test/projets'),
      { ...env, ASSETS: statique },
      contexte,
    );
    expect(await site.text()).toBe('<html>site</html>');

    const sans = await gestionnaire.fetch(
      new Request('https://deklic.test/projets'),
      env,
      contexte,
    );
    expect(sans.status).toBe(404);
    expect(await sans.json()).toEqual({ code: 'INTROUVABLE' });
  });

  it('une configuration incomplète rend 503 sur /api/* et laisse le site servi', async () => {
    const journal = journalMemoire();
    const gestionnaire = creerGestionnaire(undefined, journal);
    const api = await gestionnaire.fetch(
      new Request('https://loupeprojet.pages.dev/api/comptes/sante'),
      { ...env, ASSETS: statique },
      contexte,
    );
    expect(api.status).toBe(503);
    expect(await api.json()).toEqual({ code: 'CONFIGURATION_INCOMPLETE' });
    expect(journal.evenements).toEqual([
      {
        niveau: 'erreur',
        evenement: 'configuration.incomplete',
        donnees: { raison: 'BETTER_AUTH_SECRET manquant (obligatoire hors dev)' },
      },
    ]);

    const construireEnEchec = creerGestionnaire(() => {
      throw new ErreurConfiguration('binding D1 « DB » absent');
    }, journal);
    const site = await construireEnEchec.fetch(
      new Request('https://loupeprojet.pages.dev/projets'),
      { ...env, ASSETS: statique },
      contexte,
    );
    expect(await site.text()).toBe('<html>site</html>');
  });

  it('le gestionnaire par défaut construit l’application depuis l’environnement', async () => {
    const { default: parDefaut } = await import('../src/index');
    const r = await parDefaut.fetch(
      new Request('http://localhost:8787/api/comptes/sante'),
      { ...env, ENVIRONNEMENT: 'dev' },
      contexte,
    );
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, version: VERSION_COMPTES, environnement: 'dev' });
  });
});
