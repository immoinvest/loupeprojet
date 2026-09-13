import { describe, expect, it } from 'vitest';
import { AnalyseurCsv, ErreurCsv, lireCsv, versEnregistrement } from '../../src/commun/csv.ts';
import { collecter, depuisMorceaux } from '../../src/commun/flux.ts';

function analyser(texte: string, separateur: ',' | ';' = ','): string[][] {
  const analyseur = new AnalyseurCsv(separateur);
  return [...analyseur.alimenter(texte), ...analyseur.terminer()];
}

describe('AnalyseurCsv', () => {
  it('découpe des lignes simples (virgule, LF)', () => {
    expect(analyser('a,b,c\n1,2,3\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it("accepte le point-virgule, CRLF et l'absence de saut de ligne final", () => {
    expect(analyser('a;b\r\n1;2', ';')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('accepte des lignes à un seul champ', () => {
    expect(analyser('x\ny\n')).toEqual([['x'], ['y']]);
  });

  it('gère les guillemets : séparateur, saut de ligne et guillemet doublé dans un champ', () => {
    expect(analyser('"x, y","l1\nl2","dit ""oui"""\n')).toEqual([['x, y', 'l1\nl2', 'dit "oui"']]);
  });

  it('ignore le BOM et les lignes vides', () => {
    expect(analyser('﻿a,b\n\n1,2\n\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it("garde un guillemet au milieu d'un champ non protégé, même après une coupure", () => {
    expect(analyser('a"b,c\n')).toEqual([['a"b', 'c']]);
    const analyseur = new AnalyseurCsv(',');
    analyseur.alimenter('a');
    expect([...analyseur.alimenter('"b,c'), ...analyseur.terminer()]).toEqual([['a"b', 'c']]);
  });

  it('conserve un champ vide protégé en fin de ligne', () => {
    expect(analyser('a,""\n')).toEqual([['a', '']]);
  });

  it('ferme proprement un champ protégé terminé par le dernier caractère', () => {
    expect(analyser('a,"b"')).toEqual([['a', 'b']]);
  });

  it('produit le même résultat quel que soit le découpage en morceaux', () => {
    const texte = '﻿"id";"nom"\r\n"1";"La ""Bâtie"", oui"\r\n"2";"x\ny"\r\n3;4';
    const attendu = analyser(texte, ';');
    expect(attendu).toEqual([
      ['id', 'nom'],
      ['1', 'La "Bâtie", oui'],
      ['2', 'x\ny'],
      ['3', '4'],
    ]);
    for (let coupe = 0; coupe <= texte.length; coupe += 1) {
      const analyseur = new AnalyseurCsv(';');
      const lignes = [
        ...analyseur.alimenter(texte.slice(0, coupe)),
        ...analyseur.alimenter(texte.slice(coupe)),
        ...analyseur.terminer(),
      ];
      expect(lignes).toEqual(attendu);
    }
    const parCaractere = new AnalyseurCsv(';');
    const lignes: string[][] = [];
    for (let position = 0; position < texte.length; position += 1) {
      lignes.push(...parCaractere.alimenter(texte.slice(position, position + 1)));
    }
    expect([...lignes, ...parCaractere.terminer()]).toEqual(attendu);
  });

  it('refuse un guillemet non fermé', () => {
    const analyseur = new AnalyseurCsv(',');
    analyseur.alimenter('a,"ouvert');
    expect(() => analyseur.terminer()).toThrow(ErreurCsv);
  });
});

describe('versEnregistrement', () => {
  it('associe les valeurs aux en-têtes', () => {
    expect(versEnregistrement(['a', 'b'], ['1', '2'])).toEqual({ a: '1', b: '2' });
  });

  it('refuse une ligne de longueur différente', () => {
    expect(() => versEnregistrement(['a'], ['1', '2'])).toThrow(
      'ligne de 2 champs pour un en-tête de 1',
    );
  });
});

describe('lireCsv', () => {
  it('rend un enregistrement par ligne de données, quel que soit le découpage', async () => {
    const flux = depuisMorceaux(['a,b\n1', ',2\n3,', '4']);
    expect(await collecter(lireCsv(flux, { separateur: ',' }))).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ]);
  });

  it('ne rend rien avec un en-tête seul', async () => {
    expect(await collecter(lireCsv(depuisMorceaux(['a,b\n']), { separateur: ',' }))).toEqual([]);
  });
});
