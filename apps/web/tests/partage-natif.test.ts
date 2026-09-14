import { describe, expect, it } from 'vitest';

import { capacitesDuNavigateur, donneesPartage, estAnnulation, modePartage } from '@/application';

describe('partage natif d’un projet', () => {
  it('lit le pointeur et navigator.share, sans rien supposer quand ils manquent', () => {
    const telephone = {
      matchMedia: (requete: string) => ({ matches: requete === '(pointer: coarse)' }),
      navigator: { share: () => Promise.resolve() },
    };
    expect(capacitesDuNavigateur(telephone)).toEqual({ tactile: true, partageNatif: true });
    expect(capacitesDuNavigateur({ navigator: { share: 'non' } })).toEqual({
      tactile: false,
      partageNatif: false,
    });
    expect(capacitesDuNavigateur({ navigator: {} })).toEqual({
      tactile: false,
      partageNatif: false,
    });
    expect(capacitesDuNavigateur({})).toEqual({ tactile: false, partageNatif: false });
    expect(capacitesDuNavigateur(undefined)).toEqual({ tactile: false, partageNatif: false });
  });

  it('feuille de partage seulement au doigt et si le navigateur la propose', () => {
    expect(modePartage({ tactile: true, partageNatif: true })).toBe('natif');
    expect(modePartage({ tactile: true, partageNatif: false })).toBe('copie');
    expect(modePartage({ tactile: false, partageNatif: true })).toBe('copie');
  });

  it('partage le nom du projet, une phrase courte et le lien', () => {
    expect(donneesPartage('T3 · Marseille', 'https://deklic.test/partage#p=abc')).toEqual({
      title: 'T3 · Marseille',
      text: 'Mon projet « T3 · Marseille » sur Deklic.',
      url: 'https://deklic.test/partage#p=abc',
    });
  });

  it('reconnaît l’annulation, sous forme d’exception du DOM ou d’objet nommé', () => {
    expect(estAnnulation(new DOMException('fermée', 'AbortError'))).toBe(true);
    expect(estAnnulation({ name: 'AbortError' })).toBe(true);
    expect(estAnnulation(new DOMException('refusé', 'NotAllowedError'))).toBe(false);
    expect(estAnnulation(new Error('autre'))).toBe(false);
    expect(estAnnulation('AbortError')).toBe(false);
    expect(estAnnulation(null)).toBe(false);
  });
});
