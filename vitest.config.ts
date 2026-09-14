import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*', 'data'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['packages/*/src/**', 'apps/*/src/**', 'data/src/**'],
      exclude: ['**/index.ts', '**/exemples/**', 'apps/web/src/main.tsx', 'data/src/cli.ts'],
      // En mode projets, seuls les seuils déclarés ici sont appliqués (ceux des sous-projets sont ignorés).
      thresholds: {
        'packages/moteur/src/**': { lines: 100, functions: 100, branches: 100, statements: 100 },
        'packages/capture/src/**': { lines: 100, functions: 100, branches: 100, statements: 100 },
        'apps/extension/src/**': { lines: 100, functions: 100, branches: 100, statements: 100 },
        'apps/worker/src/**': { lines: 100, functions: 100, branches: 100, statements: 100 },
        'apps/comptes/src/**': { lines: 100, functions: 100, branches: 100, statements: 100 },
        'data/src/**': { lines: 100, functions: 100, branches: 100, statements: 100 },
        'apps/web/src/{stockage,formatage,textes,annonces,hypotheses,analyses,bookmarklet,enrichissement,compte,application,hors-ligne,visite}/**':
          {
            lines: 100,
            functions: 100,
            branches: 100,
            statements: 100,
          },
      },
    },
  },
});
