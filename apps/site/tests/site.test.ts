import { describe, expect, it } from 'vitest';

import { SITE, urlAbsolue } from '../src/lib/site';

describe('SITE', () => {
  it('vise deklic.pro et garde une description courte pour Google', () => {
    expect(SITE.origine).toBe('https://deklic.pro');
    expect(SITE.description.length).toBeGreaterThanOrEqual(120);
    expect(SITE.description.length).toBeLessThanOrEqual(160);
    expect(SITE.auteur.nom).toBe('Pierre Georgel');
  });
});

describe('urlAbsolue', () => {
  it('rend l’adresse complète d’un chemin du site', () => {
    expect(urlAbsolue('/')).toBe('https://deklic.pro/');
    expect(urlAbsolue('/guides/lmnp-ou-location-nue/')).toBe(
      'https://deklic.pro/guides/lmnp-ou-location-nue/',
    );
  });

  it.each(['guides/', 'https://ailleurs.example/', '//ailleurs.example/x', ''])(
    'refuse « %s », qui n’est pas un chemin du site',
    (chemin) => {
      expect(() => urlAbsolue(chemin)).toThrow(/Chemin du site attendu/);
    },
  );
});
