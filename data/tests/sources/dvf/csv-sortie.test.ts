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
};

const SANS_COORDONNEES: Vente = {
  date: '2024-06-15',
  prix: 120000,
  surface: 31.5,
  type: 'maison',
  pieces: 0,
  lat: null,
  lon: null,
};

describe('ligneCsvVente', () => {
  it('écrit les coordonnées quand elles existent, des colonnes vides sinon', () => {
    expect(ligneCsvVente(AVEC_COORDONNEES)).toBe(
      '2025-01-09,136000,66,appartement,4,41.934774,8.740565',
    );
    expect(ligneCsvVente(SANS_COORDONNEES)).toBe('2024-06-15,120000,31.5,maison,0,,');
  });
});

describe('csvDesVentes', () => {
  it("ajoute l'en-tête et trie par date croissante", () => {
    expect(csvDesVentes([AVEC_COORDONNEES, SANS_COORDONNEES])).toBe(
      'date,prix,surface,type,pieces,lat,lon\n' +
        '2024-06-15,120000,31.5,maison,0,,\n' +
        '2025-01-09,136000,66,appartement,4,41.934774,8.740565\n',
    );
  });
});
