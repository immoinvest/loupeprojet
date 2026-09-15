import { describe, expect, it } from 'vitest';
import type { Vente } from '../../../src/schemas/dvf.ts';
import { csvDesVentes, ligneCsvVente } from '../../../src/sources/dvf/csv-sortie.ts';

const AVEC_COORDONNEES: Vente = {
  date: '2025-01-09',
  prix: 136000,
  surface: 66,
  type: 'appartement',
  pieces: 4,
  lat: 41.934774,
  lon: 8.740565,
  idParcelle: '2A004000BO0412',
  numero: 9001,
  suffixe: 'B',
  codeVoie: 'A090',
  voie: 'RES DES CANNES, BAT "A"',
  carrez: 67.09,
  dependances: 1,
  terrain: null,
  lots: 2,
};

const SANS_COORDONNEES: Vente = {
  date: '2024-06-15',
  prix: 120000,
  surface: 31.5,
  type: 'maison',
  pieces: 0,
  lat: null,
  lon: null,
  idParcelle: null,
  numero: null,
  suffixe: null,
  codeVoie: null,
  voie: null,
  carrez: null,
  dependances: 0,
  terrain: 540.5,
  lots: null,
};

describe('ligneCsvVente', () => {
  it('écrit coordonnées, parcelle, adresse, dépendances, terrain et lots quand ils existent, des colonnes vides sinon', () => {
    expect(ligneCsvVente(AVEC_COORDONNEES)).toBe(
      '2025-01-09,136000,66,appartement,4,41.934774,8.740565,2A004000BO0412,9001,B,A090,RES DES CANNES BAT A,67.09,1,,2',
    );
    expect(ligneCsvVente(SANS_COORDONNEES)).toBe(
      '2024-06-15,120000,31.5,maison,0,,,,,,,,,0,540.5,',
    );
  });
});

describe('csvDesVentes', () => {
  it("ajoute l'en-tête et trie par date croissante", () => {
    expect(csvDesVentes([AVEC_COORDONNEES, SANS_COORDONNEES])).toBe(
      'date,prix,surface,type,pieces,lat,lon,idParcelle,numero,suffixe,codeVoie,voie,carrez,dependances,terrain,lots\n' +
        '2024-06-15,120000,31.5,maison,0,,,,,,,,,0,540.5,\n' +
        '2025-01-09,136000,66,appartement,4,41.934774,8.740565,2A004000BO0412,9001,B,A090,RES DES CANNES BAT A,67.09,1,,2\n',
    );
  });
});
