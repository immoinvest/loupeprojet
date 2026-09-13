import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'extension',
    // Les règles s'appliquent à des pages enregistrées (tests/fixtures) : jsdom fournit DOMParser.
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
