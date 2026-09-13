import { decodeProtectedHeader, exportPKCS8, generateKeyPair, jwtVerify } from 'jose';
import { describe, expect, it } from 'vitest';

import { optionsAuth } from '../src/auth';
import {
  DUREE_SECRET_APPLE_JOURS,
  ORIGINE_APPLE,
  secretClientApple,
  type ConfigApple,
} from '../src/fournisseurs';
import { banc, ORIGINE } from './aide';

interface CleApple {
  readonly config: ConfigApple;
  readonly publique: CryptoKey;
}

async function cleApple(): Promise<CleApple> {
  const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
  return {
    config: {
      clientId: 'com.deklic.web',
      teamId: 'TEAM123456',
      keyId: 'KEY1234567',
      privateKey: await exportPKCS8(privateKey),
    },
    publique: publicKey,
  };
}

async function lire<T>(r: Response): Promise<T> {
  return (await r.json()) as T;
}

describe('secret client Apple', () => {
  it('est un JWT ES256 signé avec la clé, émis pour Apple, valable 180 jours', async () => {
    const { config, publique } = await cleApple();
    const maintenant = Date.parse('2026-09-13T10:00:00Z');
    const secret = await secretClientApple(config, () => maintenant);
    expect(decodeProtectedHeader(secret)).toEqual({ alg: 'ES256', kid: 'KEY1234567' });
    const { payload } = await jwtVerify(secret, publique, {
      issuer: 'TEAM123456',
      subject: 'com.deklic.web',
      audience: ORIGINE_APPLE,
      currentDate: new Date(maintenant),
    });
    expect(payload.iat).toBe(Math.floor(maintenant / 1000));
    expect(payload.exp).toBe(Math.floor(maintenant / 1000) + DUREE_SECRET_APPLE_JOURS * 86_400);
  });

  it('accepte une clé sur une ligne (\\n littéraux, comme dans une variable d’environnement)', async () => {
    const { config, publique } = await cleApple();
    const surUneLigne = { ...config, privateKey: config.privateKey.replace(/\n/g, '\\n') };
    const secret = await secretClientApple(surUneLigne, () => Date.now());
    await expect(jwtVerify(secret, publique)).resolves.toBeDefined();
  });

  it('refuse une clé illisible', async () => {
    const { config } = await cleApple();
    await expect(
      secretClientApple({ ...config, privateKey: 'pas une clé' }, () => Date.now()),
    ).rejects.toThrow();
  });
});

describe('connexion sociale', () => {
  it('Google configuré : renvoie l’URL d’autorisation avec notre URL de retour', async () => {
    const b = banc({ fournisseurs: { google: { clientId: 'gid', clientSecret: 'gsecret' } } });
    const r = await b.requete('/api/auth/sign-in/social', {
      corps: { provider: 'google', callbackURL: '/projets', errorCallbackURL: '/connexion' },
    });
    expect(r.status).toBe(200);
    const corps = await lire<{ url: string; redirect: boolean }>(r);
    expect(corps.redirect).toBe(true);
    const url = new URL(corps.url);
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('gid');
    expect(url.searchParams.get('redirect_uri')).toBe(`${ORIGINE}/api/auth/callback/google`);
    expect(url.searchParams.get('prompt')).toBe('select_account');
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.searchParams.get('scope')).toContain('email');
  });

  it('Apple configuré : URL Apple en form_post, appleid.apple.com devient une origine de confiance', async () => {
    const { config } = await cleApple();
    const b = banc({ fournisseurs: { apple: config } });
    const r = await b.requete('/api/auth/sign-in/social', {
      corps: { provider: 'apple', callbackURL: '/projets' },
    });
    expect(r.status).toBe(200);
    const url = new URL((await lire<{ url: string }>(r)).url);
    expect(url.hostname).toBe('appleid.apple.com');
    expect(url.searchParams.get('client_id')).toBe('com.deklic.web');
    expect(url.searchParams.get('response_mode')).toBe('form_post');
    expect(url.searchParams.get('redirect_uri')).toBe(`${ORIGINE}/api/auth/callback/apple`);
    expect(optionsAuth(b.deps, ORIGINE).trustedOrigins).toContain(ORIGINE_APPLE);
    expect(optionsAuth(banc().deps, ORIGINE).trustedOrigins).not.toContain(ORIGINE_APPLE);
  });

  it('une clé Apple illisible désactive Apple sans casser le code e-mail', async () => {
    const { config } = await cleApple();
    const b = banc({ fournisseurs: { apple: { ...config, privateKey: 'pas une clé' } } });
    const apple = await b.requete('/api/auth/sign-in/social', {
      corps: { provider: 'apple', callbackURL: '/projets' },
    });
    expect(apple.status).toBe(404);
    expect(b.journal.evenements.some((e) => e.evenement === 'apple.configuration')).toBe(true);
    const code = await b.requete('/api/auth/email-otp/send-verification-otp', {
      corps: { email: 'camille@example.org', type: 'sign-in' },
    });
    expect(code.status).toBe(200);
  });

  it('un fournisseur non configuré est introuvable (404), jamais une erreur interne', async () => {
    const b = banc();
    const r = await b.requete('/api/auth/sign-in/social', {
      corps: { provider: 'google', callbackURL: '/projets' },
    });
    expect(r.status).toBe(404);
    expect((await lire<{ code: string }>(r)).code).toBe('PROVIDER_NOT_FOUND');
    expect(b.journal.evenements.filter((e) => e.evenement === 'erreur.interne')).toHaveLength(0);
  });

  it('refuse une URL de retour vers une autre origine', async () => {
    const b = banc({ fournisseurs: { google: { clientId: 'gid', clientSecret: 'gsecret' } } });
    const r = await b.requete('/api/auth/sign-in/social', {
      corps: { provider: 'google', callbackURL: 'https://pirate.example/vol' },
    });
    expect(r.status).toBe(403);
  });
});
