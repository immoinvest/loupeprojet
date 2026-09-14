import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const PAGE_CONSTRUITE = fileURLToPath(new URL('./dist/index.html', import.meta.url));

/**
 * Version du cache hors ligne : empreinte de la page construite. Elle change seulement quand les
 * fichiers de l'application changent ; un déploiement identique garde le cache des visiteurs.
 */
function versionDuBuild(): string {
  if (!existsSync(PAGE_CONSTRUITE)) {
    throw new Error(
      "dist/index.html introuvable : le service worker se construit après l'application (npm run build).",
    );
  }
  return createHash('sha256').update(readFileSync(PAGE_CONSTRUITE)).digest('hex').slice(0, 16);
}

/** Construit `dist/sw.js` : le service worker, en un seul fichier IIFE, sans import. */
export default defineConfig({
  publicDir: false,
  define: { __VERSION_HORS_LIGNE__: JSON.stringify(versionDuBuild()) },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    copyPublicDir: false,
    minify: 'esbuild',
    sourcemap: false,
    lib: {
      entry: fileURLToPath(new URL('./src/sw/service-worker.ts', import.meta.url)),
      formats: ['iife'],
      name: 'DeklicHorsLigne',
      fileName: () => 'sw.js',
    },
  },
});
