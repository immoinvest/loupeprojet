import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('configuration Wrangler du worker des comptes', () => {
  it('désactive keep_names : sinon le runtime Cloudflare refuse le worker au démarrage', () => {
    // esbuild ajoute avec keepNames des blocs `static { __name(this, "…") }` que workerd rejette
    // (« Object.defineProperty called on non-object », cloudflare/workerd#3736) : le déploiement de
    // production de tout le site échoue dès que le worker des comptes est inclus (DEKLIC_COMPTES=1).
    const configuration = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
    expect(configuration).toMatch(/^keep_names = false$/m);
  });
});
