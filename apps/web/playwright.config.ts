import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

/**
 * Port dédié aux tests de bout en bout : 5173 (vite dev, aperçu Claude Code) et 4173
 * (vite preview lancé à la main) peuvent être occupés.
 */
const PORT = 5199;
const URL_BASE = `http://127.0.0.1:${String(PORT)}`;
const enCi = process.env.CI !== undefined;
/**
 * Spec des 22 écrans sur 9 formats (US-10 de responsive, plus l’estimation sans adresse, le compte
 * rendu de visite et les quatre écrans de Gérer).
 */
const SPEC_FORMATS = /responsive\.spec\.ts$/;

// On teste l'artefact déployé : `npm run test:e2e` construit `dist/` puis le sert avec vite preview.
if (!existsSync(new URL('./dist/index.html', import.meta.url))) {
  throw new Error(
    "dist/index.html introuvable : lancez `npm run test:e2e` (qui construit l'application) ou `npm run build -w apps/web` avant `playwright test`.",
  );
}

export default defineConfig({
  testDir: './e2e',
  // Machines lentes (antivirus, portable) : 30 s par défaut est trop juste pour les parcours longs.
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: enCi,
  retries: enCi ? 2 : 0,
  // Le rapport HTML n'est jamais ouvert automatiquement : `npx playwright show-report` pour le lire.
  reporter: enCi
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: URL_BASE,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Les parcours tournent sur trois appareils ; la spec des formats ouvre ses propres contextes
  // (neuf formats, impression) et ne tourne qu'une fois.
  projects: [
    { name: 'ordinateur', testIgnore: SPEC_FORMATS, use: { ...devices['Desktop Chrome'] } },
    { name: 'telephone', testIgnore: SPEC_FORMATS, use: { ...devices['Pixel 7'] } },
    {
      name: 'tablette',
      testIgnore: SPEC_FORMATS,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 },
        isMobile: true,
        hasTouch: true,
      },
    },
    { name: 'formats', testMatch: SPEC_FORMATS, use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npx vite preview --host 127.0.0.1 --port ${String(PORT)} --strictPort`,
    url: URL_BASE,
    reuseExistingServer: !enCi,
    timeout: 60_000,
  },
});
