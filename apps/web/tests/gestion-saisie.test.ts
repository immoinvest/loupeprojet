import { describe, expect, it } from 'vitest';

import {
  centimesDepuisTexte,
  creationDepuisSaisie,
  decouperNom,
  saisieInitiale,
  type SaisieMain,
} from '@/gestion/saisie';

const LEA: SaisieMain = {
  ...saisieInitiale('2026-09-14'),
  adresse: '3 rue du Rouet, Marseille 6e',
  loyer: '490',
  charges: '40',
  locataire: 'Léa Bernard',
  email: 'lea.bernard@exemple.fr',
};

describe('centimesDepuisTexte', () => {
  it.each([
    ['650', 65_000],
    ['650,5', 65_050],
    ['650,50 €', 65_050],
    ['650.05', 65_005],
    ['1 300', 130_000],
    // Espace insécable (format français copié-collé).
    [`1${String.fromCharCode(0xa0)}300,00`, 130_000],
    ['0', 0],
    ['100000', 10_000_000],
  ])('« %s » → %i centimes', (texte, attendu) => {
    expect(centimesDepuisTexte(texte)).toBe(attendu);
  });

  it.each(['', 'abc', '-3', '12,345', '1.300,00', '100000,01', '6 5 0 e'])(
    'refuse « %s »',
    (texte) => {
      expect(centimesDepuisTexte(texte)).toBeNull();
    },
  );
});

describe('decouperNom', () => {
  it('prénom puis nom ; un seul mot ou rien ne suffit pas', () => {
    expect(decouperNom(' Julie  Martin ')).toEqual({ prenom: 'Julie', nom: 'Martin' });
    expect(decouperNom('Jean-Pierre de La Tour')).toEqual({
      prenom: 'Jean-Pierre',
      nom: 'de La Tour',
    });
    expect(decouperNom('Julie')).toBeNull();
    expect(decouperNom('   ')).toBeNull();
  });
});

describe('creationDepuisSaisie', () => {
  it('saisie initiale : meublée, appartement, entrée le 1er du mois en cours', () => {
    expect(saisieInitiale('2026-09-14')).toMatchObject({
      type: 'meublee',
      typeBien: 'appartement',
      entree: '2026-09-01',
    });
  });

  it('meublée complète : dépôt de deux mois, loyer le 5, nom du bien tiré de l’adresse', () => {
    expect(creationDepuisSaisie(LEA)).toEqual({
      ok: true,
      creation: {
        bien: {
          nom: '3 rue du Rouet',
          adresse: '3 rue du Rouet, Marseille 6e',
          type: 'appartement',
          meuble: true,
        },
        locataire: { prenom: 'Léa', nom: 'Bernard', email: 'lea.bernard@exemple.fr' },
        location: {
          type: 'meublee',
          debut: '2026-09-01',
          jourLoyer: 5,
          loyerHorsCharges: 49_000,
          charges: 4_000,
          depot: 98_000,
        },
      },
    });
  });

  it('location vide avec « Plus de détails » : jour, dépôt, type de bien, surface ; sans e-mail ni charges', () => {
    const r = creationDepuisSaisie({
      ...LEA,
      type: 'nue',
      charges: '',
      email: '',
      jourLoyer: '10',
      depot: '400',
      typeBien: 'studio',
      surface: '24,5',
    });
    expect(r).toMatchObject({
      ok: true,
      creation: {
        bien: { type: 'studio', surface: 24.5, meuble: false },
        locataire: { prenom: 'Léa', nom: 'Bernard' },
        location: { type: 'nue', jourLoyer: 10, charges: 0, depot: 40_000 },
      },
    });
    expect(r.ok && r.creation.locataire !== null && 'email' in r.creation.locataire).toBe(false);
  });

  it('sans locataire ni e-mail : un bien vacant, le loyer n’est pas demandé', () => {
    const r = creationDepuisSaisie({ ...LEA, locataire: '', email: '', loyer: '' });
    expect(r).toEqual({
      ok: true,
      creation: {
        bien: {
          nom: '3 rue du Rouet',
          adresse: '3 rue du Rouet, Marseille 6e',
          type: 'appartement',
          meuble: true,
        },
        locataire: null,
        location: null,
      },
    });
  });

  it('liste les champs à corriger, dans l’ordre de l’écran', () => {
    const r = creationDepuisSaisie({
      ...LEA,
      adresse: '  ',
      surface: '0',
      loyer: 'six cents',
      entree: '2026-02-30',
      jourLoyer: '29',
      charges: '-4',
      depot: 'x',
      locataire: 'Léa',
      email: 'lea@',
    });
    expect(r).toEqual({
      ok: false,
      erreurs: [
        'adresse',
        'surface',
        'loyer',
        'entree',
        'jourLoyer',
        'charges',
        'depot',
        'locataire',
        'email',
      ],
    });
  });

  it('un e-mail seul suffit à demander le locataire', () => {
    expect(creationDepuisSaisie({ ...LEA, locataire: '' })).toEqual({
      ok: false,
      erreurs: ['locataire'],
    });
  });

  it('jour du loyer non entier refusé ; loyer au plafond accepté', () => {
    expect(creationDepuisSaisie({ ...LEA, jourLoyer: '4,5' })).toEqual({
      ok: false,
      erreurs: ['jourLoyer'],
    });
    expect(creationDepuisSaisie({ ...LEA, loyer: '100000', depot: '100000' }).ok).toBe(true);
  });
});
