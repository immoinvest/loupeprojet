import { describe, expect, it } from 'vitest';

import { bornesAtteintes, lireEntier, pasAdaptatif, valeurApresPas } from '@/composants/saisie/pas';
import { LETTRES_ENERGIE, classesLettre, estLettreEnergie } from '@/composants/saisie/energie';
import {
  ESPACE_MILLIERS,
  formaterMontant,
  nettoyerMontant,
  positionApres,
  significatifsAvant,
} from '@/composants/saisie/montant';

const e = ESPACE_MILLIERS;

describe('montant : nettoyage', () => {
  it.each([
    ['155000', 0, '155000'],
    [`155${e}000`, 0, '155000'],
    ['155 000,50 €', 0, '155000'],
    ['155.000', 0, '155000'],
    ['abc', 0, ''],
    ['-5', 0, '5'],
    ['007', 0, '7'],
    ['0', 0, '0'],
    ['32,5', 2, '32,5'],
    ['32.567', 2, '32,56'],
    ['32,', 1, '32,'],
    [',5', 1, '0,5'],
    ['1,2,3', 2, '1,23'],
  ])('%j (%i décimales) → %j', (texte, decimales, attendu) => {
    expect(nettoyerMontant(texte, decimales)).toBe(attendu);
  });
});

describe('montant : mise en forme', () => {
  it.each([
    ['', ''],
    ['980', '980'],
    ['155000', `155${e}000`],
    ['1250000', `1${e}250${e}000`],
    ['32.5', '32,5'],
    ['1234,', `1${e}234,`],
  ])('%j → %j', (brut, attendu) => {
    expect(formaterMontant(brut)).toBe(attendu);
  });
});

describe('montant : curseur de texte', () => {
  it('compte chiffres et séparateurs avant la position', () => {
    expect(significatifsAvant(`155${e}0a00`, 5)).toBe(4);
    expect(significatifsAvant('32,5', 3)).toBe(3);
  });

  it('replace le curseur après le même chiffre', () => {
    const formate = `155${e}000`;
    expect(positionApres(formate, 0)).toBe(0);
    expect(positionApres(formate, 3)).toBe(3);
    expect(positionApres(formate, 4)).toBe(5);
    expect(positionApres(formate, 9)).toBe(formate.length);
  });
});

describe('compteur', () => {
  const bornes = { min: 1, max: 10 };

  it('lit un entier écrit tel quel', () => {
    expect(lireEntier(' 3 ')).toBe(3);
    expect(lireEntier('')).toBeNull();
    expect(lireEntier('2,5')).toBeNull();
  });

  it('vide : la valeur de départ ; sinon un pas, borné', () => {
    expect(valeurApresPas('', 1, bornes)).toBe('1');
    expect(valeurApresPas('', -1, { ...bornes, depart: 3 })).toBe('3');
    expect(valeurApresPas('3', 1, bornes)).toBe('4');
    expect(valeurApresPas('10', 1, bornes)).toBe('10');
    expect(valeurApresPas('1', -1, bornes)).toBe('1');
    expect(valeurApresPas('40', -1, bornes)).toBe('10');
    expect(valeurApresPas('5', 1, { ...bornes, pas: 2 })).toBe('7');
  });

  it('pas adaptatif : 1 jusqu’au seuil, puis le grand pas', () => {
    const pas = pasAdaptatif(20, 10);
    const lots = { min: 1, max: 9999, pas };
    expect(valeurApresPas('19', 1, lots)).toBe('20');
    expect(valeurApresPas('20', 1, lots)).toBe('30');
    expect(valeurApresPas('30', -1, lots)).toBe('20');
    expect(valeurApresPas('20', -1, lots)).toBe('19');
  });

  it('désactive − et + aux bornes, jamais à vide', () => {
    expect(bornesAtteintes('', 1, 10)).toEqual({ moins: false, plus: false });
    expect(bornesAtteintes('1', 1, 10)).toEqual({ moins: true, plus: false });
    expect(bornesAtteintes('10', 1, 10)).toEqual({ moins: false, plus: true });
  });
});

describe('énergie', () => {
  it('sept lettres, une classe par variante', () => {
    expect(LETTRES_ENERGIE).toHaveLength(7);
    expect(classesLettre('dpe', 'G')).toContain('bg-dpe-g');
    expect(classesLettre('ges', 'A')).toContain('bg-ges-a');
  });

  it('reconnaît une lettre', () => {
    expect(estLettreEnergie('D')).toBe(true);
    expect(estLettreEnergie('')).toBe(false);
    expect(estLettreEnergie('H')).toBe(false);
  });
});
