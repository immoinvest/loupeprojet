import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Adresse figée dans le bouton-favori par vite.bookmarklet.config.ts ; une valeur locale pour les tests.
  define: { __LOUPE_BASE_URL__: JSON.stringify('http://localhost:5173') },
  test: {
    name: 'web',
    environment: 'jsdom',
    // Les tests de rendu tapent au clavier dans jsdom : lents quand toute la suite tourne en parallèle.
    testTimeout: 30_000,
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/stockage/**',
        'src/formatage/**',
        'src/textes/**',
        'src/annonces/**',
        'src/hypotheses/**',
        'src/analyses/**',
        'src/bookmarklet/**',
        'src/compte/**',
        'src/enrichissement/**',
        'src/application/**',
        'src/hors-ligne/**',
      ],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
