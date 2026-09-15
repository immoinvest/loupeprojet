import { ORIGINE_PRODUCTION_DEFAUT } from '@loupe/capture/origines';
import { describe, expect, it } from 'vitest';

import { drapeauLeve, JETON_ORIGINE, remplacerOrigine } from '@/application/build';
import { ORIGINE_PRODUCTION, TRANSFERT_ACTIF } from '@/application/origine';

import INDEX from '../index.html?raw';

describe('adresse de production au build', () => {
  it('sans réglage : l’adresse historique, et pas de transfert', () => {
    expect(ORIGINE_PRODUCTION).toBe(ORIGINE_PRODUCTION_DEFAUT);
    expect(TRANSFERT_ACTIF).toBe(false);
  });

  it('index.html n’écrit plus d’adresse en dur : og:image passe par le jeton', () => {
    expect(INDEX).toContain(`content="${JETON_ORIGINE}/og-image.png"`);
    expect(INDEX).not.toContain('loupeprojet.pages.dev');
    expect(remplacerOrigine(INDEX, 'https://app.deklic.pro')).toContain(
      'content="https://app.deklic.pro/og-image.png"',
    );
    expect(remplacerOrigine(INDEX, 'https://app.deklic.pro')).not.toContain(JETON_ORIGINE);
  });

  it('un drapeau n’est levé que par « 1 »', () => {
    expect(drapeauLeve('1')).toBe(true);
    expect(drapeauLeve(' 1 ')).toBe(true);
    for (const valeur of [undefined, '', '0', 'true', 'oui'])
      expect(drapeauLeve(valeur)).toBe(false);
  });
});
