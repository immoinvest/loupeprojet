import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'capture',
    // Les règles de capture lisent un Document : jsdom fournit DOMParser aux tests.
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/index.ts', 'src/**/index.ts'],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
