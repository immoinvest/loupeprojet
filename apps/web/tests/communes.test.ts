import { describe, expect, it } from 'vitest';

import { clientHorsLigne, clientWorker, type Fetch } from '@/enrichissement/client';
import {
  MAX_OPTIONS_COMMUNES,
  lireSaisieCommune,
  normaliserNom,
  optionUnique,
  optionsCommunes,
  rechercheDepuisTexte,
  texteCommune,
} from '@/enrichissement/communes';
import type { Commune } from '@/enrichissement/contrat';

const LYON: Commune = {
  nom: 'Lyon',
  codeInsee: '69123',
  codesPostaux: ['69003', '69001', '69002'],
};
const SAINT_ETIENNE: Commune = {
  nom: 'Saint-Étienne',
  codeInsee: '42218',
  codesPostaux: ['42000'],
};

describe('lireSaisieCommune', () => {
  it.each([
    ['69003 Lyon', { codePostal: '69003', ville: 'Lyon' }],
    ['  13005   Marseille 5e ', { codePostal: '13005', ville: 'Marseille 5e' }],
    ['13005Marseille', { codePostal: '13005', ville: 'Marseille' }],
    ['69003', { codePostal: '69003', ville: '' }],
    ['Lyon 69003', { codePostal: '69003', ville: 'Lyon' }],
    ['Lyon (69003)', { codePostal: '69003', ville: 'Lyon' }],
    ['6900', { codePostal: '6900', ville: '' }],
    ['130055', { codePostal: '130055', ville: '' }],
    ['Lyon', { codePostal: '', ville: 'Lyon' }],
    ['', { codePostal: '', ville: '' }],
  ])('%j', (texte, attendu) => {
    expect(lireSaisieCommune(texte)).toEqual(attendu);
  });
});

describe('texteCommune et normaliserNom', () => {
  it('assemble ce qui est connu', () => {
    expect(texteCommune(' 69003', 'Lyon ')).toBe('69003 Lyon');
    expect(texteCommune('', 'Lyon')).toBe('Lyon');
    expect(texteCommune('', '')).toBe('');
  });

  it('ignore accents, casse, tirets et apostrophes', () => {
    expect(normaliserNom(' Saint-Étienne ')).toBe('saint etienne');
    expect(normaliserNom("L'Île-d’Yeu")).toBe('l ile d yeu');
  });
});

describe('rechercheDepuisTexte', () => {
  it('code postal, suivi ou non d’un début de nom', () => {
    expect(rechercheDepuisTexte('69003')).toEqual({
      recherche: { codePostal: '69003' },
      filtre: '',
    });
    expect(rechercheDepuisTexte('69003 ly')).toEqual({
      recherche: { codePostal: '69003' },
      filtre: 'ly',
    });
  });

  it('nom de deux lettres au moins ; sinon rien', () => {
    expect(rechercheDepuisTexte('Ly')).toEqual({ recherche: { nom: 'Ly' }, filtre: '' });
    expect(rechercheDepuisTexte('L')).toBeNull();
    expect(rechercheDepuisTexte('690')).toBeNull();
    expect(rechercheDepuisTexte('')).toBeNull();
  });
});

describe('optionsCommunes et optionUnique', () => {
  it('par code postal : une ligne par commune, filtrée par le début du nom', () => {
    const recherche = { recherche: { codePostal: '42000' }, filtre: 'saint e' };
    expect(optionsCommunes([LYON, SAINT_ETIENNE], recherche)).toEqual([
      { nom: 'Saint-Étienne', codePostal: '42000', codeInsee: '42218' },
    ]);
  });

  it('par nom : une ligne par code postal, triés, au plus douze', () => {
    const recherche = { recherche: { nom: 'lyon' }, filtre: '' };
    expect(optionsCommunes([LYON], recherche).map((o) => o.codePostal)).toEqual([
      '69001',
      '69002',
      '69003',
    ]);
    const nombreuses: Commune = {
      ...LYON,
      codesPostaux: Array.from({ length: 20 }, (_, i) => String(69001 + i)),
    };
    expect(optionsCommunes([nombreuses], recherche)).toHaveLength(MAX_OPTIONS_COMMUNES);
    expect(
      optionsCommunes(
        Array.from({ length: 20 }, () => SAINT_ETIENNE),
        { recherche: { codePostal: '42000' }, filtre: '' },
      ),
    ).toHaveLength(MAX_OPTIONS_COMMUNES);
  });

  it('choisit seule la commune unique d’un code postal tapé seul', () => {
    const cp = { recherche: { codePostal: '42000' }, filtre: '' };
    const [option] = optionsCommunes([SAINT_ETIENNE], cp);
    expect(optionUnique([option!], cp)).toEqual(option);
    expect(optionUnique([option!, option!], cp)).toBeNull();
    expect(optionUnique([], cp)).toBeNull();
    expect(optionUnique([option!], { ...cp, filtre: 's' })).toBeNull();
    expect(optionUnique([option!], { recherche: { nom: 'saint' }, filtre: '' })).toBeNull();
  });
});

describe('ClientWorker.communes', () => {
  const repondre =
    (corps: unknown, statut = 200, urls: string[] = []): Fetch =>
    (url) => {
      urls.push(url);
      return Promise.resolve(new Response(JSON.stringify(corps), { status: statut }));
    };

  it('par code postal ou par nom, réponse revalidée', async () => {
    const urls: string[] = [];
    const client = clientWorker(
      'https://w.test',
      repondre({ service: 'communes', donnees: { communes: [LYON] } }, 200, urls),
    );
    expect(await client.communes({ codePostal: '69003' })).toEqual({ ok: true, valeur: [LYON] });
    await client.communes({ nom: 'saint é' });
    expect(urls).toEqual([
      'https://w.test/proxy/communes?codePostal=69003',
      'https://w.test/proxy/communes?nom=saint+%C3%A9',
    ]);
  });

  it('ancien Worker, réponse hors contrat, hors ligne : un code', async () => {
    const ancien = clientWorker('https://w.test', repondre({ code: 'SERVICE_INCONNU' }, 404));
    expect(await ancien.communes({ nom: 'lyon' })).toEqual({ ok: false, code: 'SERVICE_INCONNU' });
    const invalide = clientWorker('https://w.test', repondre({ donnees: { communes: [{}] } }));
    expect(await invalide.communes({ nom: 'lyon' })).toEqual({
      ok: false,
      code: 'REPONSE_INVALIDE',
    });
    expect(await clientHorsLigne.communes({ nom: 'lyon' })).toEqual({
      ok: false,
      code: 'HORS_LIGNE',
    });
  });
});
