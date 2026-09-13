/** Adresse de Loupe en production. Le build de développement la remplace par `http://localhost:5173`. */
export const BASE_URL_PRODUCTION = 'https://loupeprojet.pages.dev';

interface GlobalAvecBase {
  LOUPE_BASE_URL?: string;
}

/** Adresse de Loupe à ouvrir : celle injectée par le build (`scripts/build.mjs --dev`), sinon la production. */
export function baseUrl(): string {
  return (globalThis as GlobalAvecBase).LOUPE_BASE_URL ?? BASE_URL_PRODUCTION;
}
