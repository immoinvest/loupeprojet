import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

import { origineProduction } from '@loupe/capture/origines';

/**
 * Adresse de Deklic que le bouton-favori ouvrira : LOUPE_BASE_URL si fournie ; sur un aperçu
 * Cloudflare Pages (branche autre que master), l'URL de l'aperçu ; sinon la production
 * (`DEKLIC_ORIGINE` si c'est une origine https, l'adresse historique sinon).
 */
function baseUrl(env: NodeJS.ProcessEnv): string {
  if (env.LOUPE_BASE_URL !== undefined && env.LOUPE_BASE_URL !== '') return env.LOUPE_BASE_URL;
  const apercu = env.CF_PAGES_BRANCH !== undefined && env.CF_PAGES_BRANCH !== 'master';
  if (apercu && env.CF_PAGES_URL !== undefined && env.CF_PAGES_URL !== '') return env.CF_PAGES_URL;
  return origineProduction(env.DEKLIC_ORIGINE);
}

/** Construit `public/capture.js` : le bouton-favori, en un seul fichier IIFE, règles incluses. */
export default defineConfig({
  publicDir: false,
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  define: { __LOUPE_BASE_URL__: JSON.stringify(baseUrl(process.env)) },
  build: {
    outDir: 'public',
    emptyOutDir: false,
    copyPublicDir: false,
    minify: 'esbuild',
    sourcemap: false,
    lib: {
      entry: fileURLToPath(new URL('./src/bookmarklet/capture.ts', import.meta.url)),
      formats: ['iife'],
      name: 'LoupeCapture',
      fileName: () => 'capture.js',
    },
  },
});
