import { describe, expect, it } from 'vitest';

import { SERVICES } from '../src/services';
import { banc, reponseJson } from './aide';

const communes = SERVICES.communes!;

/** Réponse de l'API Géo pour le code postal 01480 (plusieurs communes), relevée le 15/09/2026, abrégée. */
const AMONT_01480 = [
  { nom: 'Ars-sur-Formans', code: '01021', codesPostaux: ['01480'] },
  { nom: 'Fareins', code: '01157', codesPostaux: ['01480'] },
  { nom: 'Savigneux', code: '01398', codesPostaux: ['01480'] },
];

describe('service communes : paramètres', () => {
  it('par code postal : URL amont avec les champs demandés, réponse gardée en cache', () => {
    const lecture = communes.lireParametres({ codePostal: '13005' });
    expect(lecture.ok).toBe(true);
    if (!lecture.ok) return;
    expect(lecture.url.toString()).toBe(
      'https://geo.api.gouv.fr/communes?codePostal=13005&fields=nom%2Ccode%2CcodesPostaux&format=json',
    );
    expect(communes.enCache(lecture.parametres)).toBe(true);
  });

  it('par nom : population en tête, dix suggestions, jamais en cache', () => {
    const lecture = communes.lireParametres({ nom: '  saint-Ét ' });
    expect(lecture.ok).toBe(true);
    if (!lecture.ok) return;
    expect(lecture.parametres).toEqual({ nom: 'saint-Ét' });
    expect(lecture.url.searchParams.get('nom')).toBe('saint-Ét');
    expect(lecture.url.searchParams.get('boost')).toBe('population');
    expect(lecture.url.searchParams.get('limit')).toBe('10');
    expect(communes.enCache(lecture.parametres)).toBe(false);
  });

  it.each([
    [{}],
    [{ codePostal: '13005', nom: 'Marseille' }],
    [{ codePostal: '1300' }],
    [{ codePostal: '13005a' }],
    [{ nom: 'a' }],
    [{ nom: 'x'.repeat(61) }],
  ])('refuse %j', (brut) => {
    expect(communes.lireParametres(brut).ok).toBe(false);
  });
});

describe('service communes : réponse', () => {
  it('normalise nom, code INSEE et codes postaux ; codes postaux absents = liste vide', () => {
    expect(
      communes.normaliser([
        ...AMONT_01480.slice(0, 1),
        { nom: 'Commune sans code', code: '99999', population: 12 },
      ]),
    ).toEqual({
      communes: [
        { nom: 'Ars-sur-Formans', codeInsee: '01021', codesPostaux: ['01480'] },
        { nom: 'Commune sans code', codeInsee: '99999', codesPostaux: [] },
      ],
    });
    expect(communes.normaliser([])).toEqual({ communes: [] });
  });

  it('une réponse hors contrat lève ErreurAmontInvalide', () => {
    expect(() => communes.normaliser({ nom: 'Lyon' })).toThrow(/communes :/);
    expect(() => communes.normaliser([{ nom: 'Lyon' }])).toThrow(/communes : 0\.code/);
  });
});

describe('GET /proxy/communes', () => {
  it('code postal : 200, puis servi par le cache sans rappeler l’API Géo', async () => {
    const { requete, appels } = banc({
      fetcher: (url) => {
        appels.push(url);
        return Promise.resolve(reponseJson(AMONT_01480));
      },
    });
    const r = await requete('/proxy/communes?codePostal=01480');
    expect(r.status).toBe(200);
    expect(r.headers.get('x-loupe-cache')).toBe('MISS');
    expect(await r.json()).toMatchObject({
      service: 'communes',
      donnees: { communes: [{ nom: 'Ars-sur-Formans' }, { nom: 'Fareins' }, { nom: 'Savigneux' }] },
    });

    const encore = await requete('/proxy/communes?codePostal=01480');
    expect(encore.headers.get('x-loupe-cache')).toBe('HIT');
    expect(appels).toHaveLength(1);
  });

  it('nom : chaque recherche interroge l’API Géo, rien n’est gardé', async () => {
    const { requete, appels } = banc({
      fetcher: (url) => {
        appels.push(url);
        return Promise.resolve(reponseJson([{ nom: 'Lyon', code: '69123', codesPostaux: [] }]));
      },
    });
    expect((await requete('/proxy/communes?nom=lyon')).headers.get('x-loupe-cache')).toBe('MISS');
    expect((await requete('/proxy/communes?nom=lyon')).headers.get('x-loupe-cache')).toBe('MISS');
    expect(appels).toHaveLength(2);
  });

  it('paramètres invalides : 400 avec le champ en cause', async () => {
    const { requete } = banc();
    const r = await requete('/proxy/communes');
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({
      code: 'PARAMETRES_INVALIDES',
      details: { champs: ['codePostal'] },
    });
  });

  it('réponse amont invalide : 502 AMONT_INVALIDE', async () => {
    const { requete } = banc({ fetcher: () => Promise.resolve(reponseJson({ erreur: 1 })) });
    const r = await requete('/proxy/communes?codePostal=13005');
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ code: 'AMONT_INVALIDE' });
  });
});
