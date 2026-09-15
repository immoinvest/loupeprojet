import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { PARAMETRE_TEXTE } from '../src/lib/liens';

interface Manifeste {
  readonly share_target: {
    readonly action: string;
    readonly method: string;
    readonly params: Readonly<Record<string, string>>;
  };
}

describe('contrat avec l’application', () => {
  it('le formulaire du site envoie le paramètre que Nouveau projet lit (share_target du web)', () => {
    const texte = readFileSync(
      new URL('../../web/public/manifest.webmanifest', import.meta.url),
      'utf8',
    );
    const manifeste = JSON.parse(texte) as Manifeste;
    expect(manifeste.share_target.action).toBe('/projets/nouveau');
    expect(manifeste.share_target.method).toBe('GET');
    expect(manifeste.share_target.params.text).toBe(PARAMETRE_TEXTE);
  });
});
