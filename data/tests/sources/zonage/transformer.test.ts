import { describe, expect, it } from 'vitest';
import {
  colonneZone,
  dateEnVigueur,
  normaliserZone,
  regrouperParDepartement,
  zoneDepuisLigne,
} from '../../../src/sources/zonage/transformer.ts';

const COLONNE = 'Zonage ABC en vigueur depuis le 26 juin 2026';

describe('colonneZone et dateEnVigueur', () => {
  it('repère la colonne de zone et lit la date française de l’en-tête', () => {
    expect(colonneZone(['CODGEO', 'DEP', 'LIBGEO', COLONNE])).toBe(COLONNE);
    expect(colonneZone(['CODGEO', 'DEP'])).toBeUndefined();
    expect(dateEnVigueur(COLONNE)).toBe('2026-06-26');
    expect(dateEnVigueur('Zonage ABC en vigueur depuis le 1er août 2024')).toBe('2024-08-01');
    expect(dateEnVigueur('Zonage ABC au 5 septembre 2025')).toBe('2025-09-05');
  });

  it('rend null sans date ou avec un mois inconnu', () => {
    expect(dateEnVigueur('Zonage ABC')).toBeNull();
    expect(dateEnVigueur('Zonage ABC du 12 brumaire 2026')).toBeNull();
  });
});

describe('normaliserZone et zoneDepuisLigne', () => {
  it('unifie « A bis » et « Abis » et ignore les espaces', () => {
    expect(normaliserZone('A bis')).toBe('Abis');
    expect(normaliserZone('ABIS')).toBe('Abis');
    expect(normaliserZone(' B1 ')).toBe('B1');
    expect(normaliserZone('C')).toBe('C');
  });

  it('lit une ligne du CSV et écarte une zone inconnue', () => {
    expect(
      zoneDepuisLigne({ CODGEO: '75056', DEP: '75', LIBGEO: 'Paris', [COLONNE]: 'Abis' }, COLONNE),
    ).toEqual({
      codeInsee: '75056',
      departement: '75',
      zone: 'Abis',
    });
    expect(zoneDepuisLigne({ CODGEO: '00000', DEP: '00', [COLONNE]: 'D' }, COLONNE)).toBeNull();
    expect(zoneDepuisLigne({ CODGEO: '00000', DEP: '00', [COLONNE]: '' }, COLONNE)).toBeNull();
  });
});

describe('regrouperParDepartement', () => {
  it('regroupe les communes par département', () => {
    const groupes = regrouperParDepartement([
      { codeInsee: '2A004', departement: '2A', zone: 'A' },
      { codeInsee: '2A247', departement: '2A', zone: 'A' },
      { codeInsee: '97101', departement: '971', zone: 'B1' },
    ]);
    expect([...groupes.keys()]).toEqual(['2A', '971']);
    expect(groupes.get('2A')).toEqual({ '2A004': 'A', '2A247': 'A' });
  });
});
