import { describe, expect, it } from 'vitest';

import {
  MOTIF_APERCUS,
  ORIGINE_DEKLIC,
  ORIGINE_HISTORIQUE,
  ORIGINE_PRODUCTION_DEFAUT,
  ORIGINE_VITRINE,
  ORIGINES_SITE,
  origineProduction,
} from '../src/origines';

describe('origines du site', () => {
  it('garde l’adresse historique par défaut et connaît la nouvelle', () => {
    expect(ORIGINE_PRODUCTION_DEFAUT).toBe('https://loupeprojet.pages.dev');
    expect(ORIGINE_DEKLIC).toBe('https://app.deklic.pro');
    // Le site vitrine n'appelle aucune API : il n'est pas parmi les origines acceptées.
    expect(ORIGINE_VITRINE).toBe('https://deklic.pro');
    expect(ORIGINES_SITE).not.toContain(ORIGINE_VITRINE);
    expect(ORIGINES_SITE).toEqual([ORIGINE_HISTORIQUE, ORIGINE_DEKLIC, MOTIF_APERCUS]);
  });

  it('prend une origine https donnée au build, avec ou sans barre finale', () => {
    expect(origineProduction('https://app.deklic.pro')).toBe(ORIGINE_DEKLIC);
    expect(origineProduction(' https://app.deklic.pro/ ')).toBe(ORIGINE_DEKLIC);
    expect(origineProduction('https://feat-x.loupeprojet.pages.dev')).toBe(
      'https://feat-x.loupeprojet.pages.dev',
    );
  });

  it('retombe sur la valeur par défaut pour tout le reste', () => {
    for (const valeur of [
      undefined,
      '',
      '   ',
      'app.deklic.pro',
      'http://app.deklic.pro',
      'ftp://app.deklic.pro',
      'https://app.deklic.pro/chemin',
      'https://app.deklic.pro?x=1',
      'https://app.deklic.pro#x',
      'https://moi:secret@app.deklic.pro',
      'https://APP.deklic.pro',
    ]) {
      expect(origineProduction(valeur)).toBe(ORIGINE_PRODUCTION_DEFAUT);
    }
  });
});
