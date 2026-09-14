import { afterEach, describe, expect, it, vi } from 'vitest';

import { dependancesDepuisEnv, type Fetcher } from '../src/dependances';
import { ErreurConfiguration } from '../src/erreurs';
import { journalMemoire } from '../src/journal';
import { lecteurBrightData, TAILLE_MAX_PAGE, URL_BRIGHTDATA, ZONE_DEFAUT } from '../src/lecture';

const URL_ANNONCE = 'https://www.leboncoin.fr/ad/ventes_immobilieres/3194683132';
const CONFIG = { cle: 'cle-secrete-test', zone: 'zone-test', delaiMs: 1_000 };

function fournisseur(reponse: Response | Error): {
  appels: { url: URL; init: Parameters<Fetcher>[1] }[];
  fetcher: Fetcher;
} {
  const appels: { url: URL; init: Parameters<Fetcher>[1] }[] = [];
  return {
    appels,
    fetcher: (url, init) => {
      appels.push({ url, init });
      return reponse instanceof Error ? Promise.reject(reponse) : Promise.resolve(reponse);
    },
  };
}

describe('lecteurBrightData', () => {
  it('demande la page à l’API Web Unlocker (zone, pays France, page brute) avec la clé en en-tête', async () => {
    const { appels, fetcher } = fournisseur(new Response('<html>annonce</html>'));
    const lecteur = lecteurBrightData(CONFIG, fetcher, journalMemoire());
    expect(lecteur.fournisseur).toBe('brightdata');
    expect(await lecteur.lire(URL_ANNONCE)).toEqual({
      ok: true,
      statutPortail: 200,
      html: '<html>annonce</html>',
    });
    expect(appels).toHaveLength(1);
    expect(appels[0]?.url.href).toBe(URL_BRIGHTDATA);
    expect(appels[0]?.init).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer cle-secrete-test', 'Content-Type': 'application/json' },
    });
    expect(JSON.parse(String(appels[0]?.init.body))).toEqual({
      zone: 'zone-test',
      url: URL_ANNONCE,
      format: 'raw',
      country: 'fr',
    });
  });

  it('rend le statut du portail relayé par Bright Data, que la réponse soit 200 ou non', async () => {
    const relaye = (statut: number, entete: string): Response =>
      new Response('<html>introuvable</html>', {
        status: statut,
        headers: { 'x-brd-status-code': entete },
      });
    for (const [reponse, attendu] of [
      [relaye(200, '404'), 404],
      [relaye(404, '404'), 404],
      [relaye(200, 'abc'), 200],
      [relaye(200, '999'), 200],
    ] as const) {
      const lu = await lecteurBrightData(
        CONFIG,
        fournisseur(reponse).fetcher,
        journalMemoire(),
      ).lire(URL_ANNONCE);
      expect(lu).toMatchObject({ ok: true, statutPortail: attendu });
    }
  });

  it('refus de Bright Data lui-même (clé, zone, quota) : AMONT_INDISPONIBLE, journalisé sans la clé', async () => {
    const journal = journalMemoire();
    const reponse = new Response('Unauthorized', {
      status: 401,
      headers: { 'x-brd-error': 'Invalid token' },
    });
    const lu = await lecteurBrightData(CONFIG, fournisseur(reponse).fetcher, journal).lire(
      URL_ANNONCE,
    );
    expect(lu).toEqual({ ok: false, code: 'AMONT_INDISPONIBLE' });
    expect(journal.evenements).toContainEqual(
      expect.objectContaining({
        evenement: 'lecture.fournisseur_refuse',
        donnees: { statut: 401, erreur: 'Invalid token' },
      }),
    );
    expect(JSON.stringify(journal.evenements)).not.toContain(CONFIG.cle);
  });

  it('fournisseur injoignable ou réponse coupée : AMONT_INDISPONIBLE ; page démesurée : AMONT_INVALIDE', async () => {
    const journal = journalMemoire();
    const injoignable = await lecteurBrightData(
      CONFIG,
      fournisseur(new Error('délai dépassé')).fetcher,
      journal,
    ).lire(URL_ANNONCE);
    expect(injoignable).toEqual({ ok: false, code: 'AMONT_INDISPONIBLE' });
    expect(journal.evenements).toContainEqual(
      expect.objectContaining({
        evenement: 'lecture.fournisseur_injoignable',
        donnees: { raison: 'délai dépassé' },
      }),
    );

    const coupee = new Response(
      new ReadableStream({
        start(controleur) {
          controleur.error(new Error('connexion coupée'));
        },
      }),
    );
    expect(
      await lecteurBrightData(CONFIG, fournisseur(coupee).fetcher, journalMemoire()).lire(
        URL_ANNONCE,
      ),
    ).toEqual({ ok: false, code: 'AMONT_INDISPONIBLE' });

    const enorme = new Response('a'.repeat(TAILLE_MAX_PAGE + 1));
    expect(
      await lecteurBrightData(CONFIG, fournisseur(enorme).fetcher, journalMemoire()).lire(
        URL_ANNONCE,
      ),
    ).toEqual({ ok: false, code: 'AMONT_INVALIDE' });
  });
});

describe('dépendances : lecteur de pages depuis l’environnement', () => {
  const kv = { get: () => Promise.resolve(null), put: () => Promise.resolve() };
  const limiteur = { limit: () => Promise.resolve({ success: true }) };
  const base = {
    KV_CACHE: kv,
    LIMITEUR: limiteur,
    LIMITEUR_EXTRACTION: limiteur,
    LIMITEUR_LECTURE: limiteur,
    DONNEES: { get: () => Promise.resolve(null) },
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sans clé (absente ou vide) : pas de lecteur ; le limiteur de lecture est le binding', () => {
    expect(dependancesDepuisEnv(base).lecteurPages).toBeNull();
    expect(dependancesDepuisEnv({ ...base, BRIGHTDATA_API_KEY: '  ' }).lecteurPages).toBeNull();
    expect(dependancesDepuisEnv(base).limiteurLecture).toBe(limiteur);
  });

  it('avec clé : lecteur Bright Data sur la zone par défaut, ou sur la zone réglée', async () => {
    const appels: { corps: string }[] = [];
    vi.stubGlobal('fetch', (_: URL, init: { body: string }) => {
      appels.push({ corps: init.body });
      return Promise.resolve(new Response('<html></html>'));
    });
    await dependancesDepuisEnv({ ...base, BRIGHTDATA_API_KEY: 'k' }).lecteurPages?.lire(
      URL_ANNONCE,
    );
    await dependancesDepuisEnv({
      ...base,
      BRIGHTDATA_API_KEY: 'k',
      BRIGHTDATA_ZONE: 'zone_perso',
    }).lecteurPages?.lire(URL_ANNONCE);
    expect(appels.map((a) => (JSON.parse(a.corps) as { zone: string }).zone)).toEqual([
      ZONE_DEFAUT,
      'zone_perso',
    ]);
  });

  it('refuse un nom de zone invalide', () => {
    expect(() =>
      dependancesDepuisEnv({
        ...base,
        BRIGHTDATA_API_KEY: 'k',
        BRIGHTDATA_ZONE: 'zone avec espace',
      }),
    ).toThrow(ErreurConfiguration);
  });
});
