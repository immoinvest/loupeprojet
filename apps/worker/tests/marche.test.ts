import { describe, expect, it } from 'vitest';

import { dependancesDepuisEnv } from '../src/dependances';
import { lecteurMemoire, lecteurR2 } from '../src/donnees/lecteur';
import {
  assemblerMarche,
  departementDe,
  indicateurPour,
  millesimesDvfCandidats,
  resoudreCommune,
} from '../src/marche';
import { banc } from './aide';

const source = (nom: string): { nom: string; url: string; licence: string } => ({
  nom,
  url: `https://www.data.gouv.fr/datasets/${nom}`,
  licence: 'Licence Ouverte 2.0',
});

/** Extraits des fichiers réellement publiés sur R2 pour les Bouches-du-Rhône (13/09/2026). */
const COMMUNES_13 = {
  genereLe: '2026-09-13T20:27:50.080Z',
  millesime: '2026-09-13',
  source: source('communes'),
  departement: '13',
  communes: {
    '13001': { nom: 'Aix-en-Provence', codesPostaux: ['13080', '13090', '13100'] },
    '13055': { nom: 'Marseille', codesPostaux: ['13001', '13005', '13006'], population: 886040 },
    '13205': {
      nom: 'Marseille 5e Arrondissement',
      codesPostaux: ['13005'],
      communeParente: '13055',
    },
    '13206': {
      nom: 'Marseille 6e Arrondissement',
      codesPostaux: ['13006'],
      communeParente: '13055',
    },
  },
};

const DVF_2025_13 = {
  genereLe: '2026-09-13T20:31:59.565Z',
  millesime: '2025',
  source: source('dvf'),
  departement: '13',
  fenetre: { debut: '2024-01-01', fin: '2025-12-31' },
  communes: {
    '13001': { appartement: { ventes: 3286, medianeM2: 4808, q1M2: 3900, q3M2: 5700 } },
    '13205': {
      appartement: { ventes: 1823, medianeM2: 3423, q1M2: 2833, q3M2: 4135 },
      maison: { ventes: 25, medianeM2: 5405, q1M2: 3600, q3M2: 6424 },
    },
  },
};

const LOYERS_2025_13 = {
  genereLe: '2026-09-13T20:32:03.562Z',
  millesime: '2025',
  source: {
    ...source('loyers'),
    mention: 'Estimations ANIL, à partir des données du Groupe SeLoger et de leboncoin',
  },
  departement: '13',
  communes: {
    '13001': {
      appartement: { loyerM2: 17.9, basM2: 14, hautM2: 22, maille: false, observations: 9000 },
    },
    '13205': {
      appartement: {
        loyerM2: 16.25,
        basM2: 12.96,
        hautM2: 20.36,
        maille: false,
        observations: 17245,
      },
      appartementT3Plus: {
        loyerM2: 15.03,
        basM2: 11.83,
        hautM2: 19.09,
        maille: false,
        observations: 4655,
      },
    },
  },
};

const ZONAGE_13 = {
  genereLe: '2026-09-13T20:27:48.967Z',
  millesime: '2026-06-26',
  source: source('zonage'),
  departement: '13',
  communes: { '13001': 'A' as const, '13055': 'A' as const },
};

const PUBLIES: Readonly<Record<string, unknown>> = {
  'communes/13.json': COMMUNES_13,
  'dvf/2025/index/13.json': DVF_2025_13,
  'loyers/courant.json': { genereLe: '2026-09-13T20:27:47.322Z', millesime: '2025' },
  'loyers/2025/13.json': LOYERS_2025_13,
  'zonage/13.json': ZONAGE_13,
};

interface Reponse {
  codeInsee: string;
  commune: string | null;
  departement: string;
  dvf: Record<string, unknown> | null;
  loyer: Record<string, unknown> | null;
  zone: string | null;
  sources: { nom: string }[];
  obtenuLe: string;
}

describe('GET /marche', () => {
  it('Marseille + code postal : l’arrondissement pour les ventes et le loyer, la commune pour la zone', async () => {
    const donnees = lecteurMemoire(PUBLIES);
    const { requete } = banc({ donnees });
    const r = await requete('/marche?codeInsee=13055&codePostal=13005&type=appartement&pieces=3');
    expect(r.status).toBe(200);
    expect(r.headers.get('x-loupe-cache')).toBe('MISS');
    const corps = await r.json<Reponse>();
    expect(corps).toEqual({
      codeInsee: '13205',
      commune: 'Marseille 5e Arrondissement',
      departement: '13',
      dvf: {
        ventes: 1823,
        medianeM2: 3423,
        q1M2: 2833,
        q3M2: 4135,
        type: 'appartement',
        fenetre: { debut: '2024-01-01', fin: '2025-12-31' },
        millesime: '2025',
        codeInsee: '13205',
      },
      loyer: {
        loyerM2: 15.03,
        basM2: 11.83,
        hautM2: 19.09,
        maille: false,
        observations: 4655,
        indicateur: 'appartementT3Plus',
        millesime: '2025',
        chargesComprises: true,
      },
      zone: 'A',
      sources: [DVF_2025_13.source, LOYERS_2025_13.source, ZONAGE_13.source],
      obtenuLe: '2026-09-13T10:00:00.000Z',
    });
    // Sans dvf/courant.json : 2026 d'abord (absent), puis 2025.
    expect(donnees.lectures).toContain('dvf/courant.json');
    expect(donnees.lectures).toContain('dvf/2026/index/13.json');
    expect(donnees.lectures).toContain('dvf/2025/index/13.json');
    expect(donnees.lectures).not.toContain('dvf/2024/index/13.json');

    const lectures = donnees.lectures.length;
    const bis = await requete('/marche?pieces=3&type=appartement&codePostal=13005&codeInsee=13055');
    expect(bis.headers.get('x-loupe-cache')).toBe('HIT');
    expect(donnees.lectures).toHaveLength(lectures);
  });

  it('suit dvf/courant.json quand il existe', async () => {
    const donnees = lecteurMemoire({
      ...PUBLIES,
      'dvf/courant.json': { genereLe: '2026-09-13T21:00:00.000Z', millesime: '2025' },
    });
    const { requete } = banc({ donnees });
    const corps = await (await requete('/marche?codeInsee=13001')).json<Reponse>();
    expect(corps.dvf).toMatchObject({ medianeM2: 4808, codeInsee: '13001' });
    expect(corps.loyer).toMatchObject({ loyerM2: 17.9, indicateur: 'appartement' });
    expect(corps.commune).toBe('Aix-en-Provence');
    expect(donnees.lectures).not.toContain('dvf/2026/index/13.json');
  });

  it('une maison sans loyer publié : ventes et zone seulement, sources en conséquence', async () => {
    const { requete } = banc({ donnees: lecteurMemoire(PUBLIES) });
    const corps = await (await requete('/marche?codeInsee=13205&type=maison')).json<Reponse>();
    expect(corps.dvf).toMatchObject({ medianeM2: 5405, type: 'maison' });
    expect(corps.loyer).toBeNull();
    expect(corps.zone).toBe('A');
    expect(corps.sources.map((s) => s.nom)).toEqual(['dvf', 'zonage']);
  });

  it('rien de publié pour le département : tout est null, sans erreur', async () => {
    const { requete, journal } = banc({ donnees: lecteurMemoire({}) });
    const r = await requete('/marche?codeInsee=2A004&codePostal=20000');
    expect(r.status).toBe(200);
    expect(await r.json<Reponse>()).toMatchObject({
      codeInsee: '2A004',
      commune: null,
      departement: '2A',
      dvf: null,
      loyer: null,
      zone: null,
      sources: [],
    });
    expect(journal.evenements).toEqual([]);
  });

  it('valide les paramètres', async () => {
    const { requete } = banc({ donnees: lecteurMemoire(PUBLIES) });
    const r = await requete('/marche?codeInsee=1305&type=chateau&pieces=0');
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({
      code: 'PARAMETRES_INVALIDES',
      details: { champs: ['codeInsee', 'type', 'pieces'] },
    });
  });

  it('un fichier hors contrat est ignoré et journalisé, la réponse reste en cache', async () => {
    const donnees = lecteurMemoire({
      ...PUBLIES,
      'zonage/13.json': { communes: { '13055': 'Z' } },
    });
    const { requete, journal } = banc({ donnees });
    const corps = await (await requete('/marche?codeInsee=13205')).json<Reponse>();
    expect(corps.zone).toBeNull();
    expect(corps.dvf).not.toBeNull();
    expect(journal.evenements).toEqual([
      { niveau: 'erreur', evenement: 'donnees.invalides', donnees: { cle: 'zonage/13.json' } },
    ]);
    expect((await requete('/marche?codeInsee=13205')).headers.get('x-loupe-cache')).toBe('HIT');
  });

  it('un bucket en panne : réponse partielle, journalisée, jamais mise en cache', async () => {
    const donnees = {
      lireJson: (cle: string) =>
        cle.startsWith('loyers/')
          ? Promise.reject(new Error('R2 indisponible'))
          : Promise.resolve(PUBLIES[cle] ?? null),
    };
    const { requete, journal } = banc({ donnees });
    const corps = await (await requete('/marche?codeInsee=13205')).json<Reponse>();
    expect(corps.loyer).toBeNull();
    expect(corps.dvf).not.toBeNull();
    expect(journal.evenements[0]).toMatchObject({
      evenement: 'donnees.lecture_impossible',
      donnees: { cle: 'loyers/courant.json', raison: 'R2 indisponible' },
    });
    expect((await requete('/marche?codeInsee=13205')).headers.get('x-loupe-cache')).toBe('MISS');
  });

  it('est soumise à la limite de débit générale', async () => {
    const { requete } = banc({ donnees: lecteurMemoire(PUBLIES) }, 1);
    expect((await requete('/marche?codeInsee=13205')).status).toBe(200);
    expect((await requete('/marche?codeInsee=13206')).status).toBe(429);
  });
});

describe('assemblage et petites fonctions', () => {
  it('résout l’arrondissement par le code postal, sinon garde la commune', () => {
    expect(resoudreCommune(COMMUNES_13, '13055', '13006')).toEqual({
      code: '13206',
      parente: '13055',
      nom: 'Marseille 6e Arrondissement',
    });
    expect(resoudreCommune(COMMUNES_13, '13055', '13999')).toEqual({
      code: '13055',
      parente: null,
      nom: 'Marseille',
    });
    expect(resoudreCommune(COMMUNES_13, '13001', '13100')).toMatchObject({ code: '13001' });
    expect(resoudreCommune(null, '13055', undefined)).toEqual({
      code: '13055',
      parente: null,
      nom: null,
    });
  });

  it('choisit l’indicateur de loyer et retombe sur l’indicateur général', () => {
    expect(indicateurPour('maison', 4)).toBe('maison');
    expect(indicateurPour('appartement', undefined)).toBe('appartement');
    expect(indicateurPour('appartement', 2)).toBe('appartementT1T2');
    expect(indicateurPour('appartement', 5)).toBe('appartementT3Plus');
    const r = assemblerMarche({ codeInsee: '13205', type: 'appartement', pieces: 2 }, '13', {
      communes: null,
      dvf: null,
      loyers: LOYERS_2025_13,
      zonage: null,
    });
    expect(r.loyer).toMatchObject({ indicateur: 'appartement', loyerM2: 16.25 });
    expect(r.sources).toEqual([LOYERS_2025_13.source]);
  });

  it('une commune absente de l’index DVF : pas de ventes, la zone vient de la commune parente', () => {
    const r = assemblerMarche({ codeInsee: '13206', type: 'appartement' }, '13', {
      communes: COMMUNES_13,
      dvf: DVF_2025_13,
      loyers: null,
      zonage: ZONAGE_13,
    });
    expect(r).toMatchObject({
      codeInsee: '13206',
      commune: 'Marseille 6e Arrondissement',
      dvf: null,
      zone: 'A',
    });
    expect(r.sources).toEqual([ZONAGE_13.source]);
  });

  it('département d’un code INSEE et millésimes DVF candidats', () => {
    expect(departementDe('13205')).toBe('13');
    expect(departementDe('2B033')).toBe('2B');
    expect(departementDe('97411')).toBe('974');
    expect(millesimesDvfCandidats(Date.parse('2026-09-13T10:00:00Z'))).toEqual([
      '2026',
      '2025',
      '2024',
    ]);
  });
});

describe('lecteurs de données', () => {
  it('le lecteur R2 rend null pour une clé absente et le JSON sinon', async () => {
    const lecteur = lecteurR2({
      get: (cle) =>
        Promise.resolve(
          cle === 'present.json' ? { json: <T>() => Promise.resolve({ ok: true } as T) } : null,
        ),
    });
    expect(await lecteur.lireJson('absent.json')).toBeNull();
    expect(await lecteur.lireJson('present.json')).toEqual({ ok: true });
  });

  it('les dépendances de production lisent le binding DONNEES', async () => {
    const deps = dependancesDepuisEnv({
      KV_CACHE: { get: () => Promise.resolve(null), put: () => Promise.resolve() },
      LIMITEUR: { limit: () => Promise.resolve({ success: true }) },
      LIMITEUR_EXTRACTION: { limit: () => Promise.resolve({ success: true }) },
      DONNEES: { get: () => Promise.resolve({ json: <T>() => Promise.resolve(COMMUNES_13 as T) }) },
    });
    expect(await deps.donnees.lireJson('communes/13.json')).toEqual(COMMUNES_13);
  });
});
