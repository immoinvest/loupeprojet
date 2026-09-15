import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

interface CouleursMarque {
  readonly couleurs: Readonly<Record<string, { readonly hex: string }>>;
}

/** Couleur de marque → token du site (apps/site/src/styles/global.css). */
const TOKENS: Readonly<Record<string, string>> = {
  accent: 'accent',
  accentFonce: 'accent-fonce',
  accentDoux: 'accent-doux',
  accentFond: 'accent-fond',
  accentBordure: 'accent-bordure',
  flash: 'flash',
  flashFond: 'flash-fond',
  fond: 'fond',
  encre: 'encre',
  bon: 'bon',
  surveiller: 'surveiller',
  probleme: 'probleme',
};

function lire(chemin: string): string {
  return readFileSync(new URL(chemin, import.meta.url), 'utf8');
}

describe('couleurs du site', () => {
  const css = lire('../src/styles/global.css');
  const marque = JSON.parse(lire('../../../marque/couleurs.json')) as CouleursMarque;

  it.each(Object.entries(TOKENS))('--color-%s reprend la couleur de la marque', (nom, token) => {
    const couleur = marque.couleurs[nom];
    expect(couleur, `couleur « ${nom} » absente de marque/couleurs.json`).toBeDefined();
    const trouve = new RegExp(`--color-${token}:\\s*(#[0-9a-f]{6});`, 'i').exec(css);
    expect(trouve?.[1]?.toLowerCase(), `token --color-${token}`).toBe(couleur?.hex.toLowerCase());
  });
});
