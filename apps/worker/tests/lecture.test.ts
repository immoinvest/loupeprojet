import { describe, expect, it } from 'vitest';

import type { Fetcher } from '../src/dependances';
import {
  AGENT_DEKLIC,
  DUREE_MAX_AVANT_NOUVELLE_TENTATIVE_MS,
  TAILLE_MAX_CORPS,
  type ReponsePage,
} from '../src/lecture';
import { banc, corpsJson, lecteurFixe, reponseJson } from './aide';

const LBC = 'https://www.leboncoin.fr/ad/ventes_immobilieres/3194683132';
const SELOGER =
  'https://www.seloger.com/annonce/achat/provence-alpes-cote-d-azur/alpes-maritimes-06/nice-06000/26H8ZWTFJ25E';
const PAP = 'https://www.pap.fr/annonces/appartement-nice-06000-r463902045';
const BIENICI = 'https://www.bienici.com/annonce/vente/troyes/appartement/3pieces/ag13-654321';

const PAGE_LBC = '<html><script id="__NEXT_DATA__">{"props":{}}</script></html>';
const PAGE_SELOGER = '<script>window["__UFRN_LIFECYCLE_SERVERREQUEST__"]=JSON.parse("{}")</script>';
const VERIFICATION = '<html><title>Verifying the device…</title></html>';

const page = (html: string, statutPortail = 200): ReponsePage => ({
  ok: true,
  statutPortail,
  html,
});

const ORIGINE = 'https://loupeprojet.pages.dev';

/** POST depuis une page de Deklic : type JSON, adresse IP et origine. */
function depuisDeklic(corps: unknown, origine = ORIGINE): RequestInit {
  const base = corpsJson(corps);
  return { ...base, headers: { ...(base.headers as Record<string, string>), Origin: origine } };
}

async function lire(b: ReturnType<typeof banc>, corps: unknown): Promise<Response> {
  return b.requete('/lecture', depuisDeklic(corps));
}

describe('POST /lecture · Bright Data', () => {
  it('lit une annonce LeBonCoin : URL canonique au fournisseur, page brute, jamais gardée ni journalisée', async () => {
    const lecteur = lecteurFixe(page(PAGE_LBC));
    const b = banc({ lecteurPages: lecteur });
    const r = await lire(b, { url: `${LBC}?utm_source=partage#photos` });
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(await r.json()).toEqual({
      portail: 'leboncoin',
      url: LBC,
      page: { type: 'html', html: PAGE_LBC },
      tentatives: 1,
      obtenuLe: '2026-09-13T10:00:00.000Z',
    });
    expect(lecteur.urls).toEqual([LBC]);
    expect(b.journal.evenements).toContainEqual(
      expect.objectContaining({
        evenement: 'lecture.terminee',
        donnees: expect.objectContaining({
          portail: 'leboncoin',
          resultat: 'ok',
          tentatives: 1,
          octets: PAGE_LBC.length,
        }) as unknown,
      }),
    );
    expect(JSON.stringify(b.journal.evenements)).not.toContain('__NEXT_DATA__');
    expect(JSON.stringify(b.journal.evenements)).not.toContain('3194683132');
  });

  it('page vide puis pleine (constaté sur SeLoger) : seconde tentative', async () => {
    const lecteur = lecteurFixe(page(''), page(PAGE_SELOGER));
    const r = await lire(banc({ lecteurPages: lecteur }), { url: SELOGER });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ portail: 'seloger', tentatives: 2 });
    expect(lecteur.urls).toHaveLength(2);
  });

  it('deux pages sans données (vide, vérification anti-robot, erreur du portail) : 502 AMONT_VIDE', async () => {
    for (const reponses of [
      [page(''), page(VERIFICATION)],
      [page(PAGE_LBC, 403), page(PAGE_LBC, 503)],
    ]) {
      const lecteur = lecteurFixe(...reponses);
      const r = await lire(banc({ lecteurPages: lecteur }), { url: LBC });
      expect(r.status).toBe(502);
      expect(await r.json()).toEqual({ code: 'AMONT_VIDE' });
      expect(lecteur.urls).toHaveLength(2);
    }
  });

  it('pas de seconde tentative après une première lecture trop longue', async () => {
    let appels = 0;
    const b = banc({
      lecteurPages: {
        fournisseur: 'lent',
        lire: () => {
          appels += 1;
          b.horloge.valeur += DUREE_MAX_AVANT_NOUVELLE_TENTATIVE_MS;
          return Promise.resolve(page(VERIFICATION));
        },
      },
    });
    const r = await lire(b, { url: PAP });
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ code: 'AMONT_VIDE' });
    expect(appels).toBe(1);
  });

  it.each([404, 410])(
    'annonce retirée (statut %i du portail) : 404, sans nouvelle tentative',
    async (statut) => {
      const lecteur = lecteurFixe(page('<html>Annonce introuvable</html>', statut));
      const r = await lire(banc({ lecteurPages: lecteur }), { url: PAP });
      expect(r.status).toBe(404);
      expect(await r.json()).toEqual({ code: 'ANNONCE_INTROUVABLE' });
      expect(lecteur.urls).toHaveLength(1);
    },
  );

  it.each(['AMONT_INDISPONIBLE', 'AMONT_INVALIDE'] as const)(
    'fournisseur en échec (%s) : 502 avec son code',
    async (code) => {
      const b = banc({ lecteurPages: lecteurFixe({ ok: false, code }) });
      const r = await lire(b, { url: LBC });
      expect(r.status).toBe(502);
      expect(await r.json()).toEqual({ code });
      expect(b.journal.evenements).toContainEqual(
        expect.objectContaining({
          evenement: 'lecture.terminee',
          donnees: expect.objectContaining({ resultat: code, octets: null }) as unknown,
        }),
      );
    },
  );

  it('GET /health dit quel fournisseur lit les pages (null sans clé)', async () => {
    const r = await banc({ lecteurPages: lecteurFixe(page(PAGE_LBC)) }).requete('/health');
    expect(await r.json()).toMatchObject({ lecture: 'lecteur-test' });
  });

  it('sans clé Bright Data : 503 LECTURE_INDISPONIBLE pour les portails protégés', async () => {
    const r = await lire(banc(), { url: PAP });
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ code: 'LECTURE_INDISPONIBLE' });
  });
});

describe('POST /lecture · Bien’ici', () => {
  function bancBienici(reponse: () => Promise<Response>): {
    b: ReturnType<typeof banc>;
    appels: { url: URL; init: Parameters<Fetcher>[1] }[];
  } {
    const appels: { url: URL; init: Parameters<Fetcher>[1] }[] = [];
    const b = banc({
      fetcher: (url, init) => {
        appels.push({ url, init });
        return reponse();
      },
    });
    return { b, appels };
  }

  it('lit les données JSON directement, sans clé Bright Data, avec un agent qui dit qui nous sommes', async () => {
    const donnees = { id: 'ag13-654321', price: 155_000, photos: [{ url: 'https://a/1.jpg' }] };
    const { b, appels } = bancBienici(() => Promise.resolve(reponseJson(donnees)));
    const r = await lire(b, { url: BIENICI });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({
      portail: 'bienici',
      page: { type: 'donnees', donnees },
      tentatives: 1,
    });
    expect(appels[0]?.url.href).toBe('https://www.bienici.com/realEstateAd.json?id=ag13-654321');
    expect(appels[0]?.init.headers).toMatchObject({ 'User-Agent': AGENT_DEKLIC });
  });

  it.each<[string, () => Promise<Response>, number, string]>([
    ['annonce retirée', () => Promise.resolve(reponseJson({}, 404)), 404, 'ANNONCE_INTROUVABLE'],
    ['annonce expirée', () => Promise.resolve(reponseJson({}, 410)), 404, 'ANNONCE_INTROUVABLE'],
    ['portail en panne', () => Promise.resolve(reponseJson({}, 500)), 502, 'AMONT_INDISPONIBLE'],
    ['réseau coupé', () => Promise.reject(new Error('réseau')), 502, 'AMONT_INDISPONIBLE'],
    ['un tableau', () => Promise.resolve(reponseJson([1, 2])), 502, 'AMONT_INVALIDE'],
    ['du HTML', () => Promise.resolve(new Response('<html></html>')), 502, 'AMONT_INVALIDE'],
  ])('%s : %i %s', async (_, reponse, statut, code) => {
    const { b } = bancBienici(reponse);
    const r = await lire(b, { url: BIENICI });
    expect(r.status).toBe(statut);
    expect(await r.json()).toEqual({ code });
  });
});

describe('POST /lecture · entrées refusées', () => {
  it.each<[string, string, string]>([
    ['un corps qui n’est pas du JSON', 'pas du json', 'corps'],
    [
      'un corps trop long',
      JSON.stringify({ url: `${LBC}?x=${'a'.repeat(TAILLE_MAX_CORPS)}` }),
      'corps',
    ],
    ['une URL qui n’est pas une chaîne', JSON.stringify({ url: 3194683132 }), 'url'],
    [
      'un autre site',
      JSON.stringify({ url: 'https://evil.example/ad/ventes_immobilieres/3194683132' }),
      'url',
    ],
    [
      'un hôte qui imite le portail',
      JSON.stringify({
        url: 'https://www.leboncoin.fr.evil.com/ad/ventes_immobilieres/3194683132',
      }),
      'url',
    ],
    [
      'une page de recherche',
      JSON.stringify({ url: 'https://www.leboncoin.fr/recherche?category=9' }),
      'url',
    ],
    ['un lien vide', JSON.stringify({ url: '' }), 'url'],
  ])('refuse %s : 400, aucun appel sortant', async (_, corps, champ) => {
    const lecteur = lecteurFixe(page(PAGE_LBC));
    const b = banc({ lecteurPages: lecteur });
    const r = await b.requete('/lecture', depuisDeklic(corps));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ code: 'PARAMETRES_INVALIDES', details: { champs: [champ] } });
    expect(lecteur.urls).toEqual([]);
    expect(b.appels).toEqual([]);
  });

  it('limite les lectures par adresse IP', async () => {
    const b = banc({ lecteurPages: lecteurFixe(page(PAGE_LBC)) }, 2);
    expect((await lire(b, { url: LBC })).status).toBe(200);
    expect((await lire(b, { url: LBC })).status).toBe(200);
    const refus = await lire(b, { url: LBC });
    expect(refus.status).toBe(429);
    expect(await refus.json()).toEqual({ code: 'TROP_DE_REQUETES' });
  });

  it('refuse une demande qui ne vient pas d’une page de Deklic : 403, aucun appel au fournisseur', async () => {
    const lecteur = lecteurFixe(page(PAGE_LBC));
    const b = banc({ lecteurPages: lecteur });
    const sansOrigine = await b.requete('/lecture', corpsJson({ url: LBC }));
    expect(sansOrigine.status).toBe(403);
    expect(await sansOrigine.json()).toEqual({ code: 'ORIGINE_REFUSEE' });
    const autre = await b.requete('/lecture', depuisDeklic({ url: LBC }, 'https://pirate.example'));
    expect(autre.status).toBe(403);
    expect(lecteur.urls).toEqual([]);
    const apercu = await b.requete(
      '/lecture',
      depuisDeklic({ url: LBC }, 'https://feat-lecture.loupeprojet.pages.dev'),
    );
    expect(apercu.status).toBe(200);
  });

  it('refuse un corps annoncé trop long avant de le lire, et une annonce qui n’est pas en https', async () => {
    const lecteur = lecteurFixe(page(PAGE_LBC));
    const b = banc({ lecteurPages: lecteur });
    const annonce = depuisDeklic({ url: LBC });
    const long = await b.requete('/lecture', {
      ...annonce,
      headers: {
        ...(annonce.headers as Record<string, string>),
        'Content-Length': String(TAILLE_MAX_CORPS + 1),
      },
    });
    expect(long.status).toBe(400);
    expect(await long.json()).toEqual({
      code: 'PARAMETRES_INVALIDES',
      details: { champs: ['corps'] },
    });
    const http = await lire(b, { url: LBC.replace('https:', 'http:') });
    expect(http.status).toBe(400);
    expect(await http.json()).toEqual({
      code: 'PARAMETRES_INVALIDES',
      details: { champs: ['url'] },
    });
    expect(lecteur.urls).toEqual([]);
  });
});
