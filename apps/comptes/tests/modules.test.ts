import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  dependancesDepuisEnv,
  lireOriginesSupplementaires,
  lireVariables,
  ORIGINES_DEFAUT,
  SECRET_DEV,
} from '../src/dependances';
import { ErreurConfiguration, reponseErreur } from '../src/erreurs';
import { disponibles, lireConfigFournisseurs } from '../src/fournisseurs';
import { journalConsole, journalMemoire } from '../src/journal';

const DB = {} as D1Database;
const SECRET = 'un-secret-de-production-suffisamment-long-0123456789';

describe('variables et dépendances', () => {
  it('en dev, tout est optionnel : secret de dev, aucun fournisseur, origines par défaut', () => {
    const deps = dependancesDepuisEnv({ DB });
    expect(deps.environnement).toBe('dev');
    expect(deps.secret).toBe(SECRET_DEV);
    expect(deps.fournisseurs).toEqual({ google: undefined, apple: undefined });
    expect(deps.origines).toEqual(ORIGINES_DEFAUT);
    expect(deps.journal).toBe(journalConsole);
    expect(typeof deps.maintenant()).toBe('number');
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
      ORIGINES_AUTORISEES: 'https://a.test, ,https://b.test',
    });
    expect(deps.origines).toEqual([...ORIGINES_DEFAUT, 'https://a.test', 'https://b.test']);
    expect(lireOriginesSupplementaires(undefined)).toEqual([]);
  });

  it('hors dev, BETTER_AUTH_SECRET est obligatoire et doit faire 32 caractères', () => {
    expect(() => dependancesDepuisEnv({ DB, ENVIRONNEMENT: 'production' })).toThrow(
      ErreurConfiguration,
    );
    expect(() =>
      dependancesDepuisEnv({ DB, ENVIRONNEMENT: 'preview', BETTER_AUTH_SECRET: 'court' }),
    ).toThrow(/BETTER_AUTH_SECRET/);
    const deps = dependancesDepuisEnv({
      DB,
      ENVIRONNEMENT: 'production',
      BETTER_AUTH_SECRET: SECRET,
    });
    expect(deps.environnement).toBe('production');
    expect(deps.secret).toBe(SECRET);
  });

  it('refuse un environnement inconnu avec le nom de la variable', () => {
    expect(() => dependancesDepuisEnv({ DB, ENVIRONNEMENT: 'staging' })).toThrow(/ENVIRONNEMENT/);
  });

  it('lit Google et Apple quand ils sont complets', () => {
    const deps = dependancesDepuisEnv({
      DB,
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

describe('erreurs et journal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reponseErreur rend un JSON { code } avec le statut', async () => {
    const r = reponseErreur(503, 'COURRIEL_INDISPONIBLE');
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ code: 'COURRIEL_INDISPONIBLE' });
    expect(new ErreurConfiguration('x').name).toBe('ErreurConfiguration');
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
