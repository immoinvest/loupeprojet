import { describe, expect, it } from 'vitest';

import {
  cheminDeRetour,
  codeComplet,
  emailPlausible,
  LONGUEUR_CODE,
  normaliserCode,
} from '@/compte/saisie';

describe('saisie du compte', () => {
  it('reconnaît une adresse e-mail plausible', () => {
    expect(emailPlausible('camille@example.org')).toBe(true);
    expect(emailPlausible('  camille.durand+deklic@example.co.uk ')).toBe(true);
    for (const adresse of [
      '',
      'camille',
      'camille@',
      '@example.org',
      'camille@example',
      'cam ille@example.org',
      'a@b@c.fr',
    ]) {
      expect(emailPlausible(adresse)).toBe(false);
    }
  });

  it('normalise le code saisi ou collé, et vérifie qu’il est complet', () => {
    expect(normaliserCode('482 913')).toBe('482913');
    expect(normaliserCode('48-29-13-77')).toBe('482913');
    expect(normaliserCode('abc')).toBe('');
    expect(codeComplet('482913')).toBe(true);
    expect(codeComplet('48291')).toBe(false);
    expect(codeComplet('48291a')).toBe(false);
    expect(LONGUEUR_CODE).toBe(6);
  });

  it('ne revient après connexion qu’à un chemin interne', () => {
    expect(cheminDeRetour(null)).toBe('/');
    expect(cheminDeRetour('/compte')).toBe('/compte');
    expect(cheminDeRetour('/projets/abc?onglet=fiscalite')).toBe('/projets/abc?onglet=fiscalite');
    expect(cheminDeRetour('https://pirate.example')).toBe('/');
    expect(cheminDeRetour('//pirate.example')).toBe('/');
    expect(cheminDeRetour('/\\pirate.example')).toBe('/');
    expect(cheminDeRetour('/connexion')).toBe('/');
    expect(cheminDeRetour('/connexion?retour=/compte')).toBe('/');
    expect(cheminDeRetour('compte', '/compte')).toBe('/compte');
  });
});
