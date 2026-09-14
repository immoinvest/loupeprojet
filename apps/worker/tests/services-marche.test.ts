import { describe, expect, it } from 'vitest';

import { niveauDepuisStatut, SERVICES } from '../src/services';
import { banc, reponseJson } from './aide';

const dpe = SERVICES.dpe!;
const risques = SERVICES.risques!;

/** Réponse ADEME abrégée pour le 144 rue de l'Olivier, Marseille 5e (14/09/2026), plus deux lignes limites. */
const AMONT_DPE = {
  total: 34,
  results: [
    {
      numero_dpe: '2413E3913542M',
      date_etablissement_dpe: '2024-11-06',
      date_fin_validite_dpe: '2034-11-05',
      etiquette_dpe: 'C',
      etiquette_ges: 'C',
      type_batiment: 'appartement',
      surface_habitable_logement: 64.1,
      numero_etage_appartement: 0,
      complement_adresse_logement: 'Rdc',
      identifiant_ban: '13205_6659_00144',
      _geo_distance: 0.0038,
    },
    {
      numero_dpe: '2613E0895605B',
      date_etablissement_dpe: '2026-03-30',
      etiquette_dpe: 'C',
      etiquette_ges: 'C',
      type_batiment: 'immeuble',
      identifiant_ban: '13205_6659_00146',
      annee_construction: 1930,
      _geo_distance: 9.18,
    },
    {
      numero_dpe: '2413E2458660M',
      date_etablissement_dpe: '2024-07-08',
      etiquette_dpe: 'D',
      etiquette_ges: 'D',
      type_batiment: 'appartement',
      surface_habitable_logement: 72.5,
      numero_etage_appartement: 1,
      complement_adresse_logement: '  ',
      identifiant_ban: '13205_6659_00144',
      _geo_distance: 0.0038,
    },
    { numero_dpe: 'SANS-ETIQUETTE', etiquette_dpe: 'N', _geo_distance: 1 },
    { numero_dpe: 'SANS-DATE', etiquette_dpe: 'F', etiquette_ges: null },
  ],
};

/** Rapport Géorisques abrégé pour la même adresse. */
const AMONT_RISQUES = {
  url: 'https://www.georisques.gouv.fr/mes-risques/connaitre-les-risques-pres-de-chez-moi/rapport2?lon=5.393807&lat=43.294813',
  risquesNaturels: {
    inondation: {
      present: true,
      libelle: 'Inondation',
      libelleStatutCommune: 'Risque Existant',
      libelleStatutAdresse: 'Risque non Connu',
    },
    seisme: {
      present: true,
      libelle: 'Séisme',
      libelleStatutCommune: 'Risque Existant - faible',
      libelleStatutAdresse: 'Risque Existant - faible',
    },
    retraitGonflementArgile: {
      present: true,
      libelle: 'Retrait gonflement des argiles',
      libelleStatutCommune: 'Risque Existant - important',
      libelleStatutAdresse: 'Risque Existant - important',
    },
    radon: {
      present: true,
      libelle: 'Radon',
      libelleStatutCommune: 'Risque Existant - modéré',
      libelleStatutAdresse: 'Risque Existant - faible',
    },
    avalanche: {
      present: false,
      libelle: 'Avalanche',
      libelleStatutCommune: null,
      libelleStatutAdresse: null,
    },
  },
  risquesTechnologiques: {
    pollutionSols: {
      present: true,
      libelle: 'Pollution des sols',
      libelleStatutCommune: 'Risque Concerne',
      libelleStatutAdresse: 'Risque Concerne',
    },
    icpe: {
      present: true,
      libelle: 'Installations industrielles classées (ICPE)',
      libelleStatutCommune: 'Risque Concerne',
      libelleStatutAdresse: 'Risque non Concerne',
    },
  },
};

describe('service dpe', () => {
  it('cherche les DPE à 30 m par défaut, rayon borné', () => {
    const lecture = dpe.lireParametres({ lat: '43.294813', lon: '5.393807' });
    expect(lecture.ok).toBe(true);
    if (lecture.ok) {
      expect(lecture.parametres).toEqual({ lat: 43.294813, lon: 5.393807, rayon: 30 });
      expect(lecture.url.origin + lecture.url.pathname).toBe(
        'https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines',
      );
      expect(lecture.url.searchParams.get('geo_distance')).toBe('5.393807,43.294813,30');
      expect(lecture.url.searchParams.get('size')).toBe('50');
      expect(lecture.url.searchParams.get('select')).toContain('numero_etage_appartement');
    }
    expect(dpe.lireParametres({ lat: '43.29', lon: '5.39', rayon: '500' })).toEqual({
      ok: false,
      champs: ['rayon'],
    });
  });

  it('garde les DPE étiquetés, du plus proche au plus récent', () => {
    expect(dpe.normaliser(AMONT_DPE)).toEqual({
      dpe: [
        {
          numero: '2413E3913542M',
          date: '2024-11-06',
          finValidite: '2034-11-05',
          etiquetteDpe: 'C',
          etiquetteGes: 'C',
          typeBatiment: 'appartement',
          surface: 64.1,
          etage: 0,
          complement: 'Rdc',
          cleBan: '13205_6659_00144',
          anneeConstruction: null,
          distanceMetres: 0,
        },
        {
          numero: '2413E2458660M',
          date: '2024-07-08',
          finValidite: null,
          etiquetteDpe: 'D',
          etiquetteGes: 'D',
          typeBatiment: 'appartement',
          surface: 72.5,
          etage: 1,
          complement: null,
          cleBan: '13205_6659_00144',
          anneeConstruction: null,
          distanceMetres: 0,
        },
        {
          numero: 'SANS-DATE',
          date: null,
          finValidite: null,
          etiquetteDpe: 'F',
          etiquetteGes: null,
          typeBatiment: null,
          surface: null,
          etage: null,
          complement: null,
          cleBan: null,
          anneeConstruction: null,
          distanceMetres: 0,
        },
        {
          numero: '2613E0895605B',
          date: '2026-03-30',
          finValidite: null,
          etiquetteDpe: 'C',
          etiquetteGes: 'C',
          typeBatiment: 'immeuble',
          surface: null,
          etage: null,
          complement: null,
          cleBan: '13205_6659_00146',
          anneeConstruction: 1930,
          distanceMetres: 9,
        },
      ],
    });
    expect(() => dpe.normaliser({ results: 'non' })).toThrow(/dpe : results/);
  });

  it('passe par le proxy : réponse enveloppée et mise en cache', async () => {
    const appels: URL[] = [];
    const { requete } = banc({
      fetcher: (url) => {
        appels.push(url);
        return Promise.resolve(reponseJson(AMONT_DPE));
      },
    });
    const r = await requete('/proxy/dpe?lat=43.294813&lon=5.393807');
    expect(r.status).toBe(200);
    const corps = await r.json<{ service: string; donnees: { dpe: unknown[] } }>();
    expect(corps.service).toBe('dpe');
    expect(corps.donnees.dpe).toHaveLength(4);
    expect(
      (await requete('/proxy/dpe?lat=43.294813&lon=5.393807')).headers.get('x-loupe-cache'),
    ).toBe('HIT');
    expect(appels).toHaveLength(1);
  });
});

describe('service risques', () => {
  it('traduit chaque statut Géorisques en niveau', () => {
    expect(niveauDepuisStatut(null)).toBe('absent');
    expect(niveauDepuisStatut(undefined)).toBe('absent');
    expect(niveauDepuisStatut('Risque non Concerne')).toBe('absent');
    expect(niveauDepuisStatut('Risque Inconnu')).toBe('inconnu');
    expect(niveauDepuisStatut('Risque non Connu')).toBe('inconnu');
    expect(niveauDepuisStatut('Risque Existant - important')).toBe('fort');
    expect(niveauDepuisStatut('Risque Existant - modéré')).toBe('moyen');
    expect(niveauDepuisStatut('Risque Existant - faible')).toBe('faible');
    expect(niveauDepuisStatut('Risque Existant')).toBe('moyen');
    expect(niveauDepuisStatut('Risque Concerne')).toBe('moyen');
    expect(niveauDepuisStatut('Statut nouveau')).toBe('inconnu');
  });

  it('interroge le point et garde les risques présents, naturels puis technologiques', () => {
    const lecture = risques.lireParametres({ lat: '43.294813', lon: '5.393807' });
    expect(lecture.ok && lecture.url.searchParams.get('latlon')).toBe('5.393807,43.294813');
    expect(risques.normaliser(AMONT_RISQUES)).toEqual({
      url: AMONT_RISQUES.url,
      risques: [
        {
          code: 'inondation',
          famille: 'naturel',
          libelle: 'Inondation',
          adresse: 'inconnu',
          commune: 'moyen',
        },
        {
          code: 'seisme',
          famille: 'naturel',
          libelle: 'Séisme',
          adresse: 'faible',
          commune: 'faible',
        },
        {
          code: 'retraitGonflementArgile',
          famille: 'naturel',
          libelle: 'Retrait gonflement des argiles',
          adresse: 'fort',
          commune: 'fort',
        },
        {
          code: 'radon',
          famille: 'naturel',
          libelle: 'Radon',
          adresse: 'faible',
          commune: 'moyen',
        },
        {
          code: 'pollutionSols',
          famille: 'technologique',
          libelle: 'Pollution des sols',
          adresse: 'moyen',
          commune: 'moyen',
        },
        {
          code: 'icpe',
          famille: 'technologique',
          libelle: 'Installations industrielles classées (ICPE)',
          adresse: 'absent',
          commune: 'moyen',
        },
      ],
    });
    expect(risques.normaliser({ risquesNaturels: {}, risquesTechnologiques: {} })).toEqual({
      url: null,
      risques: [],
    });
    expect(() => risques.normaliser({ risquesNaturels: [] })).toThrow(/risques :/);
  });

  it('passe par le proxy', async () => {
    const { requete } = banc({ fetcher: () => Promise.resolve(reponseJson(AMONT_RISQUES)) });
    const r = await requete('/proxy/risques?lat=43.294813&lon=5.393807');
    expect(r.status).toBe(200);
    expect((await r.json<{ donnees: { risques: unknown[] } }>()).donnees.risques).toHaveLength(6);
  });
});
