import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CompteProvider, useCompte } from '@/compte/CompteContext';
import { clientMemoire, CODE_MEMOIRE, TOUS_FOURNISSEURS } from '@/compte/memoire';
import { clientReseau, type Recuperateur } from '@/compte/reseau';
import type { ClientCompte } from '@/compte/types';
import { ERREURS_COMPTE, initiales, nomAffiche, NOMS_FOURNISSEURS } from '@/textes/compte';

const EMAIL = 'camille@example.org';
const UTILISATEUR_SERVEUR = {
  id: 'u_1',
  name: 'Camille Durand',
  email: EMAIL,
  emailVerified: true,
  image: null,
  createdAt: '2026-09-13T10:00:00.000Z',
  updatedAt: '2026-09-13T10:00:00.000Z',
};

function json(corps: unknown, status = 200): Response {
  return new Response(JSON.stringify(corps), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface Appel {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

/** Un serveur simulé : une réponse par chemin (404 sinon), et la liste des appels. */
function serveur(reponses: Readonly<Record<string, () => Response>>): {
  recuperer: Recuperateur;
  appels: Appel[];
} {
  const appels: Appel[] = [];
  return {
    appels,
    recuperer: (url, init) => {
      appels.push({ url, init });
      const reponse = reponses[url];
      return Promise.resolve(
        reponse === undefined ? json({ code: 'INTROUVABLE' }, 404) : reponse(),
      );
    },
  };
}

const enPanne: Recuperateur = () => Promise.reject(new TypeError('Failed to fetch'));

function corpsDe(appel: Appel | undefined): unknown {
  const corps = appel?.init?.body;
  return typeof corps === 'string' ? JSON.parse(corps) : undefined;
}

describe('client réseau', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.location.hash = '';
  });

  it('lit la session : utilisateur, personne, ou panne (vue comme « personne »)', async () => {
    const connecte = serveur({
      '/api/auth/get-session': () => json({ session: { id: 's' }, user: UTILISATEUR_SERVEUR }),
    });
    expect(await clientReseau(connecte.recuperer).session()).toEqual({
      id: 'u_1',
      nom: 'Camille Durand',
      email: EMAIL,
      image: null,
    });
    expect(connecte.appels[0]?.init).toEqual({});

    const anonyme = serveur({ '/api/auth/get-session': () => json(null) });
    expect(await clientReseau(anonyme.recuperer).session()).toBeNull();

    const html = serveur({ '/api/auth/get-session': () => new Response('<html>site</html>') });
    expect(await clientReseau(html.recuperer).session()).toBeNull();
    expect(await clientReseau(enPanne).session()).toBeNull();
  });

  it('lit les fournisseurs, et n’en propose aucun si le serveur est indisponible', async () => {
    const ok = serveur({
      '/api/comptes/fournisseurs': () => json({ email: true, google: true, apple: false }),
    });
    expect(await clientReseau(ok.recuperer).fournisseurs()).toEqual({
      email: true,
      google: true,
      apple: false,
    });
    const indisponible = serveur({
      '/api/comptes/fournisseurs': () => json({ code: 'CONFIGURATION_INCOMPLETE' }, 503),
    });
    expect(await clientReseau(indisponible.recuperer).fournisseurs()).toEqual({
      email: false,
      google: false,
      apple: false,
    });
  });

  it('demande un code en POST JSON et traduit les erreurs du serveur', async () => {
    const ok = serveur({
      '/api/auth/email-otp/send-verification-otp': () => json({ success: true }),
    });
    expect(await clientReseau(ok.recuperer).demanderCode(EMAIL)).toEqual({
      ok: true,
      valeur: undefined,
    });
    expect(ok.appels[0]?.init?.method).toBe('POST');
    expect(ok.appels[0]?.init?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(corpsDe(ok.appels[0])).toEqual({ email: EMAIL, type: 'sign-in' });

    const cas: [Response, string][] = [
      [json({ code: 'INVALID_EMAIL', message: 'Invalid email' }, 400), 'email_invalide'],
      [json({ code: 'RATE_LIMITED' }, 429), 'trop_de_demandes'],
      [json({ code: 'COURRIEL_INDISPONIBLE' }, 503), 'indisponible'],
      [json({ code: 'QUELQUE_CHOSE' }, 500), 'indisponible'],
      [new Response('Bad Gateway', { status: 502 }), 'indisponible'],
      [json({ code: 'QUELQUE_CHOSE' }, 400), 'inconnue'],
    ];
    for (const [reponse, code] of cas) {
      const s = serveur({ '/api/auth/email-otp/send-verification-otp': () => reponse });
      expect(await clientReseau(s.recuperer).demanderCode(EMAIL)).toEqual({ ok: false, code });
    }
    expect(await clientReseau(enPanne).demanderCode(EMAIL)).toEqual({ ok: false, code: 'reseau' });
  });

  it('vérifie un code : utilisateur sans nom, codes d’erreur, réponse illisible', async () => {
    const ok = serveur({
      '/api/auth/sign-in/email-otp': () =>
        json({ token: 't', user: { ...UTILISATEUR_SERVEUR, name: null } }),
    });
    expect(await clientReseau(ok.recuperer).verifierCode(EMAIL, '482913')).toEqual({
      ok: true,
      valeur: { id: 'u_1', nom: '', email: EMAIL, image: null },
    });
    expect(corpsDe(ok.appels[0])).toEqual({ email: EMAIL, otp: '482913' });

    for (const [codeServeur, code] of [
      ['INVALID_OTP', 'code_invalide'],
      ['OTP_EXPIRED', 'code_expire'],
      ['TOO_MANY_ATTEMPTS', 'trop_essais'],
    ]) {
      const s = serveur({ '/api/auth/sign-in/email-otp': () => json({ code: codeServeur }, 400) });
      expect(await clientReseau(s.recuperer).verifierCode(EMAIL, '000000')).toEqual({
        ok: false,
        code,
      });
    }
    const illisible = serveur({ '/api/auth/sign-in/email-otp': () => json({ token: 't' }) });
    expect(await clientReseau(illisible.recuperer).verifierCode(EMAIL, '1')).toEqual({
      ok: false,
      code: 'inconnue',
    });
  });

  it('continue avec Google : demande l’URL puis y envoie le navigateur', async () => {
    const naviguer = vi.fn();
    const ok = serveur({
      '/api/auth/sign-in/social': () =>
        json({ url: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=x', redirect: true }),
    });
    expect(await clientReseau(ok.recuperer, naviguer).continuerAvec('google', '/projets')).toEqual({
      ok: true,
      valeur: undefined,
    });
    expect(corpsDe(ok.appels[0])).toEqual({
      provider: 'google',
      callbackURL: '/projets',
      errorCallbackURL: '/connexion?fournisseur=google',
    });
    expect(naviguer).toHaveBeenCalledWith(
      'https://accounts.google.com/o/oauth2/v2/auth?client_id=x',
    );

    const absent = serveur({
      '/api/auth/sign-in/social': () => json({ code: 'PROVIDER_NOT_FOUND' }, 404),
    });
    const naviguerJamais = vi.fn();
    expect(
      await clientReseau(absent.recuperer, naviguerJamais).continuerAvec('apple', '/projets'),
    ).toEqual({ ok: false, code: 'indisponible' });
    expect(naviguerJamais).not.toHaveBeenCalled();
  });

  it('par défaut, utilise fetch et la navigation du navigateur', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(json({ url: 'http://localhost:3000/#vers-google' }))),
    );
    expect(await clientReseau().continuerAvec('google', '/projets')).toEqual({
      ok: true,
      valeur: undefined,
    });
    expect(window.location.hash).toBe('#vers-google');
  });

  it('déconnecte, renomme, liste les fournisseurs liés et supprime le compte', async () => {
    const s = serveur({
      '/api/auth/sign-out': () => json({ success: true }),
      '/api/auth/update-user': () => json({ status: true }),
      '/api/auth/list-accounts': () =>
        json([
          { providerId: 'credential' },
          { providerId: 'google' },
          { providerId: 'apple' },
          { providerId: 'github' },
        ]),
      '/api/auth/delete-user': () => json({ code: 'SESSION_EXPIRED' }, 400),
    });
    const client = clientReseau(s.recuperer);
    await client.deconnecter();
    expect(s.appels[0]?.url).toBe('/api/auth/sign-out');
    expect(await client.renommer('Camille')).toEqual({ ok: true, valeur: undefined });
    expect(corpsDe(s.appels[1])).toEqual({ name: 'Camille' });
    expect(await client.methodes()).toEqual(['google', 'apple']);
    expect(await client.supprimer()).toEqual({ ok: false, code: 'session_ancienne' });
    expect(await clientReseau(enPanne).methodes()).toEqual([]);
  });
});

describe('client mémoire', () => {
  it('suit la connexion par code, le renommage, la déconnexion et la suppression', async () => {
    const client = clientMemoire({ methodes: ['google'] });
    expect(await client.session()).toBeNull();
    expect(await client.fournisseurs()).toEqual(TOUS_FOURNISSEURS);
    expect(await client.methodes()).toEqual(['google']);
    expect(await client.renommer('Camille')).toEqual({ ok: false, code: 'inconnue' });

    expect(await client.demanderCode(EMAIL)).toEqual({ ok: true, valeur: undefined });
    expect(client.codesDemandes).toEqual([EMAIL]);
    expect(await client.verifierCode(EMAIL, '000000')).toEqual({
      ok: false,
      code: 'code_invalide',
    });
    expect(await client.verifierCode(EMAIL, CODE_MEMOIRE)).toEqual({
      ok: true,
      valeur: { id: 'utilisateur-memoire', nom: '', email: EMAIL, image: null },
    });
    expect(await client.renommer('Camille')).toEqual({ ok: true, valeur: undefined });
    expect((await client.session())?.nom).toBe('Camille');
    await client.deconnecter();
    expect(await client.session()).toBeNull();

    expect(await client.continuerAvec('apple', '/compte')).toEqual({ ok: true, valeur: undefined });
    expect(client.redirections).toEqual(['apple /compte']);
    expect(await client.supprimer()).toEqual({ ok: false, code: 'inconnue' });
  });

  it('peut forcer une erreur sur chaque action', async () => {
    const client = clientMemoire({
      utilisateur: { id: 'u', nom: 'C', email: EMAIL, image: null },
      fournisseurs: { email: true, google: false, apple: false },
      erreurs: {
        demanderCode: 'trop_de_demandes',
        verifierCode: 'code_expire',
        continuerAvec: 'indisponible',
        renommer: 'reseau',
        supprimer: 'session_ancienne',
      },
    });
    expect(await client.demanderCode(EMAIL)).toEqual({ ok: false, code: 'trop_de_demandes' });
    expect(await client.verifierCode(EMAIL, CODE_MEMOIRE)).toEqual({
      ok: false,
      code: 'code_expire',
    });
    expect(await client.continuerAvec('google', '/')).toEqual({ ok: false, code: 'indisponible' });
    expect(await client.renommer('X')).toEqual({ ok: false, code: 'reseau' });
    expect(await client.supprimer()).toEqual({ ok: false, code: 'session_ancienne' });
    expect(await client.methodes()).toEqual([]);
  });
});

describe('textes du compte', () => {
  it('une phrase courte pour chaque code, sans tiret cadratin', () => {
    for (const phrase of Object.values(ERREURS_COMPTE)) {
      expect(phrase.length).toBeGreaterThan(10);
      expect(phrase).not.toContain('—');
    }
    expect(NOMS_FOURNISSEURS).toEqual({ google: 'Google', apple: 'Apple' });
  });

  it('initiales et nom affiché', () => {
    expect(initiales({ nom: 'Camille Durand', email: EMAIL })).toBe('CD');
    expect(initiales({ nom: 'jean pierre marie', email: EMAIL })).toBe('JP');
    expect(initiales({ nom: '  ', email: EMAIL })).toBe('C');
    expect(initiales({ nom: '', email: '' })).toBe('?');
    expect(nomAffiche({ nom: ' Camille ', email: EMAIL })).toBe('Camille');
    expect(nomAffiche({ nom: '', email: EMAIL })).toBe(EMAIL);
  });
});

describe('CompteProvider', () => {
  function avec(client: ClientCompte): ({ children }: { children: ReactNode }) => ReactNode {
    return function Enveloppe({ children }) {
      return <CompteProvider client={client}>{children}</CompteProvider>;
    };
  }

  it('passe de « chargement » à « anonyme », puis « connecté » après le bon code', async () => {
    const client = clientMemoire();
    const { result } = renderHook(() => useCompte(), { wrapper: avec(client) });
    expect(result.current.etat).toBe('chargement');
    expect(result.current.fournisseurs).toBeNull();
    await waitFor(() => {
      expect(result.current.etat).toBe('anonyme');
    });
    expect(result.current.fournisseurs).toEqual(TOUS_FOURNISSEURS);
    expect(result.current.client).toBe(client);

    await act(async () => {
      expect((await result.current.demanderCode(EMAIL)).ok).toBe(true);
      expect((await result.current.verifierCode(EMAIL, '000000')).ok).toBe(false);
    });
    expect(result.current.etat).toBe('anonyme');
    await act(async () => {
      await result.current.verifierCode(EMAIL, CODE_MEMOIRE);
    });
    expect(result.current.etat).toBe('connecte');
    expect(result.current.utilisateur?.email).toBe(EMAIL);

    await act(async () => {
      await result.current.renommer('Camille');
    });
    expect(result.current.utilisateur?.nom).toBe('Camille');
    await act(async () => {
      expect((await result.current.continuerAvec('google', '/projets')).ok).toBe(true);
      await result.current.deconnecter();
    });
    expect(result.current.etat).toBe('anonyme');
  });

  it('supprime le compte, et ignore un renommage réussi sans utilisateur', async () => {
    const client = clientMemoire({ utilisateur: { id: 'u', nom: '', email: EMAIL, image: null } });
    const { result } = renderHook(() => useCompte(), { wrapper: avec(client) });
    await waitFor(() => {
      expect(result.current.etat).toBe('connecte');
    });
    await act(async () => {
      await result.current.supprimer();
    });
    expect(result.current.utilisateur).toBeNull();

    const renommeSansSession: ClientCompte = {
      ...clientMemoire(),
      renommer: () => Promise.resolve({ ok: true, valeur: undefined }),
    };
    const second = renderHook(() => useCompte(), { wrapper: avec(renommeSansSession) });
    await waitFor(() => {
      expect(second.result.current.etat).toBe('anonyme');
    });
    await act(async () => {
      await second.result.current.renommer('Personne');
    });
    expect(second.result.current.utilisateur).toBeNull();

    const refus: ClientCompte = {
      ...clientMemoire(),
      supprimer: () => Promise.resolve({ ok: false, code: 'reseau' }),
    };
    const troisieme = renderHook(() => useCompte(), { wrapper: avec(refus) });
    await act(async () => {
      expect((await troisieme.result.current.supprimer()).ok).toBe(false);
    });
  });

  it('useCompte hors du provider est une erreur de programmation', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useCompte())).toThrow(
      'useCompte doit être utilisé sous CompteProvider',
    );
    vi.restoreAllMocks();
  });
});
