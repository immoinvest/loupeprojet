import { expect, test, type Page, type Route } from '@playwright/test';

import { preparerDonnees } from './formats';
import { simulerWorker } from './reponses-worker';

/*
 * L'adresse du bien avec suggestions, sur le build de production : le Worker est simulé (suggestions de la
 * Géoplateforme, adresses du cadastre, analyse). Taper, choisir au clavier ou au clic : l'analyse démarre.
 */

const SUGGESTIONS = [
  {
    libelle: "144 Rue de l'Olivier 13005 Marseille",
    precision: 'adresse',
    numero: '144',
    rue: "Rue de l'Olivier",
    codePostal: '13005',
    commune: 'Marseille',
    codeInsee: '13205',
    lat: 43.294813,
    lon: 5.393807,
    cleBan: '13205_6659_00144',
  },
  {
    libelle: "Rue de l'Olivier 13005 Marseille",
    precision: 'rue',
    numero: null,
    rue: "Rue de l'Olivier",
    codePostal: '13005',
    commune: 'Marseille',
    codeInsee: '13205',
    lat: 43.2951,
    lon: 5.3941,
    cleBan: '13205_6659',
  },
];

const RUE_VALCROS = {
  libelle: 'Route de Valcros 13090 Aix-en-Provence',
  precision: 'rue',
  numero: null,
  rue: 'Route de Valcros',
  codePostal: '13090',
  commune: 'Aix-en-Provence',
  codeInsee: '13001',
  lat: 43.5262,
  lon: 5.4318,
  cleBan: '13001_2640',
};

const VALCROS = {
  libelle: '9001 CITE VALCROS',
  numero: 9001,
  suffixe: null,
  codeVoie: 'A285',
  voie: 'CITE VALCROS',
  parcelles: ['13001000CP0007'],
  lat: 43.526878,
  lon: 5.430097,
  ventes: 3,
};

const CORS = { 'access-control-allow-origin': '*' };

/** Suggestions et adresses du cadastre simulées ; renvoie les recherches de `/marche/adresse` reçues. */
async function simulerSuggestions(page: Page): Promise<URLSearchParams[]> {
  await simulerWorker(page);
  await page.route(
    (url) => url.pathname === '/proxy/adresses',
    (route: Route) => {
      const q = new URL(route.request().url()).searchParams.get('q') ?? '';
      const suggestions = q.toLowerCase().includes('valcros') ? [RUE_VALCROS] : SUGGESTIONS;
      return route.fulfill({ json: { donnees: { suggestions } }, headers: CORS });
    },
  );
  await page.route(
    (url) => url.pathname === '/marche/adresses-dvf',
    (route: Route) =>
      route.fulfill({
        json: { codeInsee: '13001', millesime: '2025', adresses: [VALCROS] },
        headers: CORS,
      }),
  );
  const analyses: URLSearchParams[] = [];
  page.on('request', (requete) => {
    const url = new URL(requete.url());
    if (url.pathname === '/marche/adresse') analyses.push(url.searchParams);
  });
  return analyses;
}

test('taper une adresse, la choisir au clavier : l’analyse démarre', async ({ page }) => {
  const { id } = await preparerDonnees(page);
  const analyses = await simulerSuggestions(page);
  await page.goto(`/projets/${id}/adresse`);

  const champ = page.getByRole('combobox', { name: 'Adresse du bien' });
  await champ.pressSequentially("144 rue de l'oli");
  await expect(page.getByRole('option', { name: /144 Rue de l'Olivier/ })).toBeVisible();
  await expect(page.getByRole('option', { name: /rue, sans numéro/ })).toBeVisible();
  await champ.press('ArrowDown');
  await champ.press('Enter');

  await expect.poll(() => analyses.length).toBeGreaterThan(0);
  expect(analyses[0]?.get('numero')).toBe('144');
  expect(analyses[0]?.get('codeVoie')).toBe('6659');
  await expect(page.getByRole('heading', { level: 2, name: 'Le repère de prix' })).toBeVisible();
  await expect(champ).toHaveValue("144 Rue de l'Olivier 13005 Marseille");
});

test('Aix : l’adresse du cadastre « 9001 Cité Valcros » s’analyse', async ({ page }) => {
  const { id } = await preparerDonnees(page);
  const analyses = await simulerSuggestions(page);
  await page.goto(`/projets/${id}/adresse`);

  await page
    .getByRole('combobox', { name: 'Adresse du bien' })
    .pressSequentially('9001 Cité Valcros Aix');
  await page.getByRole('option', { name: /9001 Cite Valcros.*adresse du cadastre/ }).click();

  await expect.poll(() => analyses.length).toBeGreaterThan(0);
  expect(analyses[0]?.get('numero')).toBe('9001');
  expect(analyses[0]?.get('codeVoie')).toBe('A285');
  expect(analyses[0]?.get('codeInsee')).toBe('13001');
  await expect(page.getByText(/Adresse du cadastre : les ventes de l'immeuble/)).toBeVisible();
});
