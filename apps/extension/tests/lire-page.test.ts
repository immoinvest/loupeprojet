import { creerRegistre } from '@loupe/capture';
import { describe, expect, it } from 'vitest';

import { ResultatLectureSchema, lirePage } from '../src/logique/lire-page';
import { REGISTRE } from '../src/regles';

import leboncoin from './fixtures/leboncoin.html?raw';

const URL_LBC = 'https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851';

function fixture(): Document {
  return new DOMParser().parseFromString(leboncoin, 'text/html');
}

describe('lirePage', () => {
  it('rend la capture de la page avec les règles de son portail', () => {
    const resultat = lirePage(fixture(), URL_LBC, REGISTRE);
    expect(resultat.ok).toBe(true);
    if (!resultat.ok) return;
    expect(resultat.capture).toMatchObject({ portail: 'leboncoin', prix: 155_000, surface: 65 });
    expect(ResultatLectureSchema.safeParse(resultat).success).toBe(true);
  });

  it('explique pourquoi il n’y a pas de capture : hors annonce, portail sans règles', () => {
    expect(lirePage(fixture(), 'https://www.leboncoin.fr/recherche', REGISTRE)).toEqual({
      ok: false,
      raison: 'hors-annonce',
    });
    expect(lirePage(fixture(), URL_LBC, creerRegistre([]))).toEqual({
      ok: false,
      raison: 'portail-sans-regles',
    });
  });

  it('traite comme hors annonce des règles qui ne correspondent pas au portail de l’URL', () => {
    const reglesPap = REGISTRE.reglesDuPortail('pap');
    const registreTordu = {
      reglesDuPortail: () => reglesPap,
      versions: () => ({}),
    };
    expect(lirePage(fixture(), URL_LBC, registreTordu)).toEqual({
      ok: false,
      raison: 'hors-annonce',
    });
  });

  it('ResultatLectureSchema refuse une raison inconnue et une capture hors schéma', () => {
    expect(ResultatLectureSchema.safeParse({ ok: false, raison: 'panne' }).success).toBe(false);
    expect(ResultatLectureSchema.safeParse({ ok: true, capture: { version: 2 } }).success).toBe(
      false,
    );
  });
});
