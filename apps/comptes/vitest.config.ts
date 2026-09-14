import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'comptes',
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Le test de migration démarre une base D1 locale (Miniflare) : quelques secondes sur une machine chargée.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
