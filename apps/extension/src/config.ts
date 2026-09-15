import { ORIGINE_PRODUCTION_DEFAUT } from '@loupe/capture/origines';

/** Adresse de Deklic en production, sauf autre adresse injectée au build (`DEKLIC_ORIGINE`). */
export const BASE_URL_PRODUCTION = ORIGINE_PRODUCTION_DEFAUT;

interface GlobalAvecBase {
  LOUPE_BASE_URL?: string;
}

/** Adresse de Deklic à ouvrir : celle injectée par le build (`scripts/build.ts --dev`), sinon la production. */
export function baseUrl(): string {
  return (globalThis as GlobalAvecBase).LOUPE_BASE_URL ?? BASE_URL_PRODUCTION;
}
