import { ORIGINE_DEKLIC, ORIGINE_PRODUCTION_DEFAUT } from '@loupe/capture/origines';
import { describe, expect, it } from 'vitest';

import manifesteBrut from '../manifest.json';
import script from '../scripts/build.ts?raw';
import { BASE_URL_PRODUCTION } from '../src/config';

interface Manifeste {
  readonly version: string;
  readonly content_scripts: readonly {
    readonly matches: readonly string[];
    readonly js: string[];
  }[];
}

const manifeste = manifesteBrut as Manifeste;

describe('manifeste et adresses de Deklic', () => {
  it('le pont se charge sur app.deklic.pro, l’adresse historique et ses aperçus, et en local', () => {
    const pont = manifeste.content_scripts.find((c) => c.js.includes('pont.js'));
    expect(pont?.matches).toEqual([
      `${ORIGINE_DEKLIC}/*`,
      'https://*.loupeprojet.pages.dev/*',
      'http://localhost/*',
      'http://127.0.0.1/*',
    ]);
    expect(manifeste.version).toBe('0.4.0');
  });

  it('le popup ouvre la production par défaut ; l’identifiant Firefox ne change pas', () => {
    expect(BASE_URL_PRODUCTION).toBe(ORIGINE_PRODUCTION_DEFAUT);
    // Changer l'identifiant ferait perdre l'extension à ceux qui l'ont déjà installée.
    expect(script).toContain("id: 'loupe@loupeprojet.pages.dev'");
    expect(script).toContain('process.env.DEKLIC_ORIGINE');
  });
});
