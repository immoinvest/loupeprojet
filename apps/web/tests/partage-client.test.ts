import { projetExemple, ProjetSchema } from '@loupe/moteur';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clientPartageIndisponible,
  clientPartageMemoire,
  clientPartageReseau,
  URL_PARTAGE,
  type Recuperateur,
} from '@/stockage/partage-client';
import type { ProjetEnregistre } from '@/stockage/projets';

const DIX = '2026-09-15T10:00:00.000Z';
const JOUR = 86_400_000;

const PROJET: ProjetEnregistre = {
  id: 'p1',
  nom: 'T2 · Lyon',
  statut: 'analyse',
  creeLe: DIX,
  modifieLe: DIX,
  visite: { faite: false, reponses: { DOC_TITRE_PLAN: { etat: 'ok', note: 'privé' } } },
  projet: ProjetSchema.parse({ ...projetExemple, id: 'p1' }),
};

const json = (statut: number, corps: unknown): Response =>
  new Response(JSON.stringify(corps), { status: statut });

function repondre(
  ...reponses: (Response | Error)[]
): Recuperateur & { appels: [string, RequestInit | undefined][] } {
  const appels: [string, RequestInit | undefined][] = [];
  const f = (url: string, init?: RequestInit): Promise<Response> => {
    appels.push([url, init]);
    const suivante = reponses.shift();
    return suivante instanceof Error || suivante === undefined
      ? Promise.reject(suivante ?? new Error('aucune'))
      : Promise.resolve(suivante);
  };
  return Object.assign(f, { appels });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('clientPartageReseau', () => {
  it('crée : POST du projet allégé, réponse revalidée', async () => {
    const f = repondre(json(201, { id: '7fK2qA9x', jeton: 'j', expireLe: DIX }));
    const r = await clientPartageReseau(f).creer(PROJET);
    expect(r).toEqual({ ok: true, valeur: { id: '7fK2qA9x', jeton: 'j', expireLe: DIX } });
    const [url, init] = f.appels[0] ?? [];
    expect(url).toBe(URL_PARTAGE);
    expect(init?.method).toBe('POST');
    const corps = JSON.parse(init?.body as string) as { projet: ProjetEnregistre };
    expect(corps.projet.nom).toBe('T2 · Lyon');
    expect(corps.projet).not.toHaveProperty('visite');
  });

  it('traduit les erreurs : codes connus, 5xx, réponse inattendue, réseau', async () => {
    const client = clientPartageReseau(
      repondre(
        json(429, { code: 'LIMITE_ATTEINTE' }),
        json(503, { code: 'PARTAGE_INDISPONIBLE' }),
        json(413, { code: 'CORPS_TROP_GROS' }),
        new Response('<html>', { status: 502 }),
        json(418, { code: 'AUTRE' }),
        new Response('<!doctype html>', { status: 200 }),
        new Error('hors ligne'),
      ),
    );
    const codes = [];
    for (let i = 0; i < 7; i += 1) {
      const r = await client.creer(PROJET);
      codes.push(r.ok ? 'ok' : r.code);
    }
    expect(codes).toEqual([
      'limite',
      'indisponible',
      'invalide',
      'indisponible',
      'inconnue',
      'inconnue',
      'reseau',
    ]);
  });

  it('lit un lien (identifiant échappé dans l’adresse) et le projet est revalidé', async () => {
    const f = repondre(
      json(200, { projet: PROJET, expireLe: DIX }),
      json(404, { code: 'INTROUVABLE' }),
      json(200, { projet: { id: 'x' }, expireLe: DIX }),
    );
    const client = clientPartageReseau(f);
    const lu = await client.lire('7fK2qA9x');
    expect(lu.ok && lu.valeur.projet.nom).toBe('T2 · Lyon');
    expect(await client.lire('a/b')).toEqual({ ok: false, code: 'introuvable' });
    expect(f.appels[1]?.[0]).toBe(`${URL_PARTAGE}/a%2Fb`);
    expect(await client.lire('7fK2qA9x')).toEqual({ ok: false, code: 'inconnue' });
  });

  it('supprime avec le jeton ; 404 et réseau traduits', async () => {
    const f = repondre(
      new Response(null, { status: 204 }),
      json(404, { code: 'INTROUVABLE' }),
      new Error('x'),
    );
    const client = clientPartageReseau(f);
    expect(await client.supprimer('7fK2qA9x', 'jeton')).toEqual({ ok: true, valeur: null });
    expect(f.appels[0]?.[1]?.method).toBe('DELETE');
    expect(JSON.parse(f.appels[0]?.[1]?.body as string)).toEqual({ jeton: 'jeton' });
    expect(await client.supprimer('7fK2qA9x', 'jeton')).toEqual({ ok: false, code: 'introuvable' });
    expect(await client.supprimer('7fK2qA9x', 'jeton')).toEqual({ ok: false, code: 'reseau' });
  });

  it('passe par fetch par défaut', async () => {
    const f = vi.fn(() => Promise.resolve(json(404, { code: 'INTROUVABLE' })));
    vi.stubGlobal('fetch', f);
    expect(await clientPartageReseau().lire('7fK2qA9x')).toEqual({
      ok: false,
      code: 'introuvable',
    });
    expect(f).toHaveBeenCalledOnce();
  });
});

describe('clientPartageMemoire et clientPartageIndisponible', () => {
  it('mêmes règles que l’API : allégé, prolongé à l’ouverture, expiré, jeton exigé', async () => {
    let maintenant = Date.parse(DIX);
    const client = clientPartageMemoire({
      maintenant: () => maintenant,
      genererId: () => 'AAAAAAAA',
    });
    const cree = await client.creer(PROJET);
    expect(cree).toEqual({
      ok: true,
      valeur: { id: 'AAAAAAAA', jeton: 'jeton-AAAAAAAA', expireLe: '2026-12-14T10:00:00.000Z' },
    });
    maintenant += 80 * JOUR;
    const lu = await client.lire('AAAAAAAA');
    expect(lu.ok && lu.valeur.projet).not.toHaveProperty('visite');
    maintenant += 89 * JOUR;
    expect((await client.lire('AAAAAAAA')).ok).toBe(true);
    expect(await client.supprimer('AAAAAAAA', 'faux')).toEqual({ ok: false, code: 'introuvable' });
    expect(await client.supprimer('AAAAAAAA', 'jeton-AAAAAAAA')).toEqual({
      ok: true,
      valeur: null,
    });
    expect(await client.lire('AAAAAAAA')).toEqual({ ok: false, code: 'introuvable' });

    await client.creer(PROJET);
    maintenant += 90 * JOUR;
    expect(await client.lire('AAAAAAAA')).toEqual({ ok: false, code: 'introuvable' });
  });

  it('identifiants et horloge par défaut ; un contenu abîmé se lit « inconnue »', async () => {
    const client = clientPartageMemoire();
    const a = await client.creer(PROJET);
    const b = await client.creer(PROJET);
    expect(a.ok && a.valeur.id).toBe('memoire1');
    expect(b.ok && b.valeur.id).toBe('memoire2');
    client.liens.set('abimeXXX', {
      contenu: '{"id":1}',
      jeton: 'j',
      expireLe: '9999-01-01T00:00:00.000Z',
    });
    expect(await client.lire('abimeXXX')).toEqual({ ok: false, code: 'inconnue' });
  });

  it('indisponible répond toujours indisponible', async () => {
    expect(await clientPartageIndisponible.creer(PROJET)).toEqual({
      ok: false,
      code: 'indisponible',
    });
    expect(await clientPartageIndisponible.lire('x')).toEqual({ ok: false, code: 'indisponible' });
    expect(await clientPartageIndisponible.supprimer('x', 'j')).toEqual({
      ok: false,
      code: 'indisponible',
    });
  });
});
