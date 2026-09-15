import { describe, expect, it } from 'vitest';
import {
  CodeDepartementSchema,
  CodeInseeSchema,
  CommunesDepartementSchema,
  IndexDvfDepartementSchema,
  IndexDvfNationalSchema,
  LoyersDepartementSchema,
  MetaSchema,
  MillesimeCourantSchema,
  SaisieUsureSchema,
  TaxeFonciereDepartementSchema,
  UsurePublieeSchema,
  VenteSchema,
  ZonageDepartementSchema,
} from '../../src/schemas/index.ts';

const META = {
  genereLe: '2026-09-13T10:00:00.000Z',
  millesime: '2025',
  source: {
    nom: 'Demandes de valeurs foncières géolocalisées',
    url: 'https://www.data.gouv.fr/datasets/demandes-de-valeurs-foncieres-geolocalisees',
    licence: 'Licence Ouverte 2.0',
  },
};

describe('codes', () => {
  it("reconnaît les codes INSEE et département, y compris la Corse et l'outre-mer", () => {
    for (const code of ['13055', '2A004', '2B033', '97101', '75101']) {
      expect(CodeInseeSchema.safeParse(code).success).toBe(true);
    }
    for (const code of ['1305', '2C004', 'ABCDE', '130555']) {
      expect(CodeInseeSchema.safeParse(code).success).toBe(false);
    }
    for (const code of ['01', '2A', '95', '971', '976']) {
      expect(CodeDepartementSchema.safeParse(code).success).toBe(true);
    }
    for (const code of ['1', '977', '2C', '100']) {
      expect(CodeDepartementSchema.safeParse(code).success).toBe(false);
    }
  });
});

describe('MillesimeCourantSchema', () => {
  it('décrit le pointeur courant.json de chaque source datée', () => {
    expect(
      MillesimeCourantSchema.safeParse({ genereLe: META.genereLe, millesime: '2025' }).success,
    ).toBe(true);
    expect(
      MillesimeCourantSchema.safeParse({ genereLe: META.genereLe, millesime: '' }).success,
    ).toBe(false);
  });
});

describe('MetaSchema', () => {
  it('exige une date-heure ISO, un millésime et une source avec URL et licence', () => {
    expect(MetaSchema.safeParse(META).success).toBe(true);
    expect(MetaSchema.safeParse({ ...META, genereLe: '13/09/2026' }).success).toBe(false);
    expect(
      MetaSchema.safeParse({ ...META, source: { ...META.source, url: 'data.gouv' } }).success,
    ).toBe(false);
  });
});

describe('DVF', () => {
  it('valide une vente avec ou sans coordonnées ni adresse', () => {
    const complete = {
      date: '2025-01-09',
      prix: 136000,
      surface: 66,
      type: 'appartement',
      pieces: 4,
      lat: 41.934774,
      lon: 8.740565,
      idParcelle: '2A004000BO0412',
      numero: 9001,
      suffixe: null,
      codeVoie: 'A090',
      voie: 'RES DES CANNES',
      carrez: 67.09,
      dependances: 1,
      terrain: null,
      lots: 2,
    };
    expect(VenteSchema.parse(complete).type).toBe('appartement');
    expect(VenteSchema.safeParse({ ...complete, lots: 0 }).success).toBe(false);
    expect(VenteSchema.safeParse({ ...complete, dependances: -1 }).success).toBe(false);
    expect(
      VenteSchema.safeParse({
        date: '2025-06-15',
        prix: 120000,
        surface: 31,
        type: 'appartement',
        pieces: 1,
        lat: null,
        lon: null,
        idParcelle: null,
        numero: null,
        suffixe: null,
        codeVoie: null,
        voie: null,
        carrez: null,
        dependances: 0,
        terrain: 850,
        lots: null,
      }).success,
    ).toBe(true);
    expect(VenteSchema.safeParse({ ...complete, idParcelle: '2A004-BO-412' }).success).toBe(false);
    expect(
      VenteSchema.safeParse({ date: '2025-06-15', prix: 0, surface: 31, type: 'maison' }).success,
    ).toBe(false);
  });

  it('valide les index départemental et national', () => {
    const communes = {
      '2A004': { appartement: { ventes: 5, medianeM2: 3444, q1M2: 3000, q3M2: 3871 } },
      '2A062': { maison: { ventes: 2, medianeM2: 2570, q1M2: 2535, q3M2: 2606 } },
    };
    expect(
      IndexDvfDepartementSchema.safeParse({
        ...META,
        departement: '2A',
        fenetre: { debut: '2024-01-01', fin: '2025-12-31' },
        communes,
      }).success,
    ).toBe(true);
    expect(
      IndexDvfNationalSchema.safeParse({ ...META, departements: ['2A', '2B'], communes }).success,
    ).toBe(true);
    expect(
      IndexDvfDepartementSchema.safeParse({
        ...META,
        departement: '2A',
        fenetre: { debut: '2024-01-01', fin: '2025-12-31' },
        communes: {
          '2A004': { appartement: { ventes: 0, medianeM2: 3444, q1M2: 3000, q3M2: 3871 } },
        },
      }).success,
    ).toBe(false);
  });
});

describe('loyers, taxe foncière, zonage, communes', () => {
  it('valident un exemple de chaque fichier publié', () => {
    expect(
      LoyersDepartementSchema.safeParse({
        ...META,
        departement: '2A',
        communes: {
          '2A004': {
            appartement: {
              loyerM2: 15.22,
              basM2: 11.98,
              hautM2: 19.33,
              maille: false,
              observations: 7460,
            },
            maison: {
              loyerM2: 16.01,
              basM2: 10.51,
              hautM2: 24.39,
              maille: false,
              observations: 278,
            },
          },
        },
      }).success,
    ).toBe(true);
    expect(
      TaxeFonciereDepartementSchema.safeParse({
        ...META,
        departement: '2A',
        communes: {
          '2A004': {
            commune: 0.3065,
            syndicats: 0,
            intercommunalite: 0.06,
            gemapi: 0.0092,
            tse: 0.00336,
            total: 0.37906,
            teom: 0.125,
          },
        },
      }).success,
    ).toBe(true);
    expect(
      ZonageDepartementSchema.safeParse({
        ...META,
        departement: '2A',
        communes: { '2A004': 'A', '2A247': 'A' },
      }).success,
    ).toBe(true);
    expect(
      ZonageDepartementSchema.safeParse({ ...META, departement: '2A', communes: { '2A004': 'D' } })
        .success,
    ).toBe(false);
    expect(
      CommunesDepartementSchema.safeParse({
        ...META,
        departement: '13',
        communes: {
          '13055': {
            nom: 'Marseille',
            codesPostaux: ['13001'],
            population: 877215,
            epci: '200054807',
          },
          '13201': {
            nom: 'Marseille 1er Arrondissement',
            codesPostaux: ['13001'],
            communeParente: '13055',
          },
        },
      }).success,
    ).toBe(true);
  });
});

describe('usure', () => {
  const seuils = {
    fixeMoins10Ans: 0.0407,
    fixe10a20Ans: 0.0457,
    fixe20AnsEtPlus: 0.0529,
    variable: 0.0528,
    relais: 0.0639,
  };
  const saisie = {
    trimestre: '2026-T3',
    applicableDu: '2026-07-01',
    publieLe: '2026-06-29',
    source: {
      nom: "Banque de France, taux d'usure 2026-T3",
      url: 'https://www.banque-france.fr/fr/statistiques/taux-et-cours/taux-dusure-2026-q3',
      licence: 'Banque de France',
    },
    tauxEffectifsMoyens: { ...seuils, fixe20AnsEtPlus: 0.0397 },
    seuils,
  };

  it('valide une saisie trimestrielle et le fichier publié', () => {
    expect(SaisieUsureSchema.safeParse(saisie).success).toBe(true);
    expect(SaisieUsureSchema.safeParse({ ...saisie, trimestre: '2026-Q3' }).success).toBe(false);
    expect(
      UsurePublieeSchema.safeParse({
        ...META,
        millesime: '2026-T3',
        trimestre: saisie.trimestre,
        applicableDu: saisie.applicableDu,
        publieLe: saisie.publieLe,
        tauxEffectifsMoyens: saisie.tauxEffectifsMoyens,
        seuils,
        perime: false,
      }).success,
    ).toBe(true);
  });
});
