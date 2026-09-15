import type { D1Database } from '@cloudflare/workers-types';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DUREE_CODE_MINUTES,
  ErreurCourriel,
  envoyeurJournal,
  envoyeurResend,
  messageCode,
  URL_RESEND,
} from '../src/courriel';
import {
  dependancesDepuisEnv,
  lireOriginesSupplementaires,
  lireVariables,
  ORIGINES_DEV,
  ORIGINES_SITE,
  SECRET_DEV,
} from '../src/dependances';
import { ErreurConfiguration, messageDe, reponseErreur } from '../src/erreurs';
import { disponibles, lireConfigFournisseurs } from '../src/fournisseurs';
import { origineConnue } from '../src/garde';
import { journalConsole, journalMemoire } from '../src/journal';

const DB = {} as D1Database;
const SECRET = 'un-secret-de-production-suffisamment-long-0123456789';

describe('variables et dépendances', () => {
  it('en dev, tout est optionnel : secret de dev, aucun fournisseur, localhost autorisé', () => {
    const deps = dependancesDepuisEnv({ DB, ENVIRONNEMENT: 'dev' });
    expect(deps.environnement).toBe('dev');
    expect(deps.secret).toBe(SECRET_DEV);
    expect(deps.base).toBe(DB);
    expect(deps.fournisseurs).toEqual({ google: undefined, apple: undefined });
    expect(deps.origines).toEqual([...ORIGINES_SITE, ...ORIGINES_DEV]);
    expect(deps.journal).toBe(journalConsole);
    expect(typeof deps.maintenant()).toBe('number');
  });

  it('sans ENVIRONNEMENT, c’est la production : secret exigé, aucune origine locale', () => {
    expect(() => dependancesDepuisEnv({ DB })).toThrow(ErreurConfiguration);
    expect(() => dependancesDepuisEnv({ DB })).toThrow(/BETTER_AUTH_SECRET/);
    const deps = dependancesDepuisEnv({ DB, BETTER_AUTH_SECRET: SECRET });
    expect(deps.environnement).toBe('production');
    expect(deps.secret).toBe(SECRET);
    expect(deps.origines).toEqual(ORIGINES_SITE);
  });

  it('refuse un secret trop court, un environnement inconnu et une base absente', () => {
    expect(() =>
      dependancesDepuisEnv({ DB, ENVIRONNEMENT: 'preview', BETTER_AUTH_SECRET: 'court' }),
    ).toThrow(/BETTER_AUTH_SECRET/);
    expect(() => dependancesDepuisEnv({ DB, ENVIRONNEMENT: 'staging' })).toThrow(/ENVIRONNEMENT/);
    expect(() => dependancesDepuisEnv({ ENVIRONNEMENT: 'dev' })).toThrow(
      'binding D1 « DB » absent',
    );
  });

  it('une variable vide vaut « absente » ; les origines supplémentaires s’ajoutent', () => {
    const v = lireVariables({
      DB,
      GOOGLE_CLIENT_ID: '  ',
      ORIGINES_AUTORISEES: 'https://a.test, ,https://b.test',
    });
    expect(v.GOOGLE_CLIENT_ID).toBeUndefined();
    const deps = dependancesDepuisEnv({
      DB,
      BETTER_AUTH_SECRET: SECRET,
      ORIGINES_AUTORISEES: 'https://deklic.io, ,https://www.deklic.io',
    });
    expect(deps.origines).toEqual([...ORIGINES_SITE, 'https://deklic.io', 'https://www.deklic.io']);
    expect(lireOriginesSupplementaires(undefined)).toEqual([]);
  });

  it('lit Google et Apple quand ils sont complets', () => {
    const deps = dependancesDepuisEnv({
      DB,
      ENVIRONNEMENT: 'dev',
      GOOGLE_CLIENT_ID: 'gid',
      GOOGLE_CLIENT_SECRET: 'gsecret',
      APPLE_CLIENT_ID: 'com.deklic.web',
      APPLE_TEAM_ID: 'TEAM',
      APPLE_KEY_ID: 'KEY',
      APPLE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----',
    });
    expect(deps.fournisseurs).toEqual({
      google: { clientId: 'gid', clientSecret: 'gsecret' },
      apple: {
        clientId: 'com.deklic.web',
        teamId: 'TEAM',
        keyId: 'KEY',
        privateKey: '-----BEGIN PRIVATE KEY-----',
      },
    });
  });

  it('branche l’envoi des codes : Resend avec une clé, le journal en dev, rien sinon', () => {
    expect(dependancesDepuisEnv({ DB, ENVIRONNEMENT: 'dev' }).courriel).not.toBeNull();
    expect(dependancesDepuisEnv({ DB, BETTER_AUTH_SECRET: SECRET }).courriel).toBeNull();
    const avecResend = dependancesDepuisEnv({
      DB,
      BETTER_AUTH_SECRET: SECRET,
      RESEND_API_KEY: 're_x',
    });
    expect(avecResend.courriel).not.toBeNull();
  });
});

describe('fournisseurs', () => {
  it('une configuration à moitié remplie nomme les variables manquantes', () => {
    expect(() => lireConfigFournisseurs({ GOOGLE_CLIENT_ID: 'gid' })).toThrow(
      'Google : variables manquantes GOOGLE_CLIENT_SECRET',
    );
    expect(() => lireConfigFournisseurs({ APPLE_CLIENT_ID: 'a', APPLE_KEY_ID: 'k' })).toThrow(
      'Apple : variables manquantes APPLE_TEAM_ID, APPLE_PRIVATE_KEY',
    );
  });

  it('disponibles reflète la configuration et l’envoyeur', () => {
    expect(disponibles({}, false)).toEqual({ email: false, google: false, apple: false });
    expect(
      disponibles({ google: { clientId: 'g', clientSecret: 's' }, apple: undefined }, true),
    ).toEqual({ email: true, google: true, apple: false });
  });
});

describe('origines connues', () => {
  const motifs = ['http://localhost:5173', 'https://*.loupeprojet.pages.dev'];

  it('reconnaît les origines exactes et un sous-domaine à la place de *', () => {
    expect(origineConnue('http://localhost:5173', motifs)).toBe(true);
    expect(origineConnue('https://feat-comptes.loupeprojet.pages.dev', motifs)).toBe(true);
    expect(origineConnue('https://3f2a9c1b.loupeprojet.pages.dev', motifs)).toBe(true);
  });

  it('refuse les imitations, les sous-domaines imbriqués et les autres ports', () => {
    expect(origineConnue('http://localhost:5174', motifs)).toBe(false);
    expect(origineConnue('https://loupeprojet.pages.dev.pirate.example', motifs)).toBe(false);
    expect(origineConnue('https://a.b.loupeprojet.pages.dev', motifs)).toBe(false);
    expect(origineConnue('https://xloupeprojetxpagesxdev', ['https://loupeprojet.pages.dev'])).toBe(
      false,
    );
  });

  it('le site est connu à ses deux adresses et sur ses previews, jamais par imitation', () => {
    for (const origine of [
      'https://loupeprojet.pages.dev',
      'https://app.deklic.pro',
      'https://feat-partage.loupeprojet.pages.dev',
    ]) {
      expect(origineConnue(origine, ORIGINES_SITE)).toBe(true);
    }
    for (const origine of [
      'https://app.deklic.pro.pirate.example',
      'http://app.deklic.pro',
      'https://x.app.deklic.pro',
      'http://localhost:5173',
    ]) {
      expect(origineConnue(origine, ORIGINES_SITE)).toBe(false);
    }
  });
});

describe('courriel', () => {
  const MESSAGE = { a: 'camille@example.org', sujet: 'Sujet', texte: 'Texte', html: '<b>HTML</b>' };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('Resend : POST /emails avec la clé, l’expéditeur, le destinataire et le contenu', async () => {
    const appels: { url: string; init: RequestInit }[] = [];
    const envoyeur = envoyeurResend('re_test', 'Deklic <bonjour@deklic.test>', (url, init) => {
      appels.push({ url, init });
      return Promise.resolve(new Response('{"id":"1"}', { status: 200 }));
    });
    await envoyeur.envoyer(MESSAGE);
    expect(appels[0]?.url).toBe(URL_RESEND);
    expect(appels[0]?.init.method).toBe('POST');
    expect(appels[0]?.init.headers).toEqual({
      Authorization: 'Bearer re_test',
      'Content-Type': 'application/json',
    });
    const corps = appels[0]?.init.body;
    expect(JSON.parse(typeof corps === 'string' ? corps : '{}')).toEqual({
      from: 'Deklic <bonjour@deklic.test>',
      to: ['camille@example.org'],
      subject: 'Sujet',
      text: 'Texte',
      html: '<b>HTML</b>',
    });
  });

  it('Resend : une réponse non 2xx est une ErreurCourriel qui ne cite que le statut', async () => {
    const envoyeur = envoyeurResend('re_test', 'x@y.z', () =>
      Promise.resolve(new Response('{"message":"camille@example.org refusé"}', { status: 422 })),
    );
    await expect(envoyeur.envoyer(MESSAGE)).rejects.toThrow(
      new ErreurCourriel('Resend a répondu 422'),
    );
  });

  it('Resend : sans fetcher fourni, utilise fetch global', async () => {
    const fetchSimule = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })));
    vi.stubGlobal('fetch', fetchSimule);
    await envoyeurResend('re_test', 'x@y.z').envoyer(MESSAGE);
    expect(fetchSimule).toHaveBeenCalledWith(
      URL_RESEND,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('journal : écrit le sujet et le texte, jamais le destinataire', async () => {
    const j = journalMemoire();
    await envoyeurJournal(j).envoyer(MESSAGE);
    expect(j.evenements).toEqual([
      { niveau: 'info', evenement: 'courriel.dev', donnees: { sujet: 'Sujet', texte: 'Texte' } },
    ]);
    expect(JSON.stringify(j.evenements)).not.toContain('camille');
  });

  it('messageCode : le code et la durée figurent dans le sujet, le texte et le HTML', () => {
    const m = messageCode('482913');
    expect(m.sujet).toBe('482913 est votre code Deklic');
    expect(m.texte).toContain('482913');
    expect(m.texte).toContain(`${String(DUREE_CODE_MINUTES)} minutes`);
    expect(m.html).toContain('482913');
    expect(m.html).not.toContain('<script');
  });
});

describe('erreurs et journal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reponseErreur rend un JSON { code } avec le statut ; messageDe lit tout type d’erreur', async () => {
    const r = reponseErreur(503, 'COURRIEL_INDISPONIBLE');
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ code: 'COURRIEL_INDISPONIBLE' });
    expect(new ErreurConfiguration('x').name).toBe('ErreurConfiguration');
    expect(messageDe(new Error('réseau coupé'))).toBe('réseau coupé');
    expect(messageDe('délai dépassé')).toBe('délai dépassé');
  });

  it('journalConsole écrit une ligne JSON par événement', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    journalConsole.info('test.info', { a: 1 });
    journalConsole.erreur('test.erreur');
    expect(log).toHaveBeenCalledWith('{"niveau":"info","evenement":"test.info","a":1}');
    expect(error).toHaveBeenCalledWith('{"niveau":"erreur","evenement":"test.erreur"}');
  });

  it('journalMemoire garde les événements', () => {
    const j = journalMemoire();
    j.info('a');
    j.erreur('b', { x: 1 });
    expect(j.evenements).toEqual([
      { niveau: 'info', evenement: 'a', donnees: undefined },
      { niveau: 'erreur', evenement: 'b', donnees: { x: 1 } },
    ]);
  });
});
