/** Adresse de Deklic en production (projet Cloudflare Pages `loupeprojet`, nom technique inchangé, ADR-005). */
export const BASE_URL_PRODUCTION = 'https://loupeprojet.pages.dev';

interface GlobalAvecBase {
  LOUPE_BASE_URL?: string;
}

/** Adresse de Deklic à ouvrir : celle injectée par le build (`scripts/build.ts --dev`), sinon la production. */
export function baseUrl(): string {
  return (globalThis as GlobalAvecBase).LOUPE_BASE_URL ?? BASE_URL_PRODUCTION;
}
