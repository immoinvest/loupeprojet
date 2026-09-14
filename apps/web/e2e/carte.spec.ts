import { expect, test } from '@playwright/test';

import { preparerDonnees } from './formats';
import { HOTE_TUILES_IGN, simulerWorker } from './reponses-worker';

/*
 * La carte des ventes de l'onglet Estimation, avec la vraie bibliothèque Leaflet : fond Plan IGN (tuiles
 * interceptées, jamais demandées au vrai service), une pastille par vente, infobulle, absente à l'impression.
 */

test('la carte des ventes : tuiles IGN, une pastille par vente, infobulle, pas d’impression', async ({
  page,
}) => {
  const tuiles: string[] = [];
  page.on('request', (requete) => {
    const url = new URL(requete.url());
    if (url.hostname === HOTE_TUILES_IGN) tuiles.push(url.search);
  });
  const { idAvecAdresse } = await preparerDonnees(page);
  await simulerWorker(page);
  await page.goto(`/projets/${idAvecAdresse}/adresse`);

  const carte = page.locator('section', {
    has: page.getByRole('heading', { level: 2, name: 'Les ventes autour du bien' }),
  });
  await expect(carte.locator('.leaflet-container')).toBeVisible();
  await expect(carte.getByRole('img', { name: /24 points/ })).toBeVisible();
  // 24 ventes simulées, trois cercles et le bien.
  await expect(carte.locator('path.carte-vente')).toHaveCount(24);
  await expect(carte.locator('path.carte-cercle')).toHaveCount(3);
  await expect(carte.locator('path.carte-bien')).toHaveCount(1);
  await expect(carte.locator('path.carte-vente-bas').first()).toBeAttached();
  await expect(carte.locator('path.carte-vente-haut').first()).toBeAttached();

  await expect.poll(() => tuiles.length).toBeGreaterThan(0);
  expect(
    tuiles.every((recherche) => recherche.includes('LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2')),
  ).toBe(true);
  await expect(carte.getByText(/Plan IGN \(Géoplateforme\)/).first()).toBeVisible();

  // Survol d'une pastille : prix au m², surface, prix, date, distance.
  await carte.locator('path.carte-vente').first().dispatchEvent('mouseover');
  await expect(page.locator('.leaflet-tooltip')).toContainText('€/m²');
  await expect(page.locator('.leaflet-tooltip')).toContainText(' m');

  // La carte ne défile pas la page à la molette et reste sous l'en-tête collé.
  const isolation = await carte
    .locator('.leaflet-container')
    .evaluate((el) => getComputedStyle(el).isolation);
  expect(isolation).toBe('isolate');

  await page.emulateMedia({ media: 'print' });
  await expect(carte).toBeHidden();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Les ventes comparables les plus proches' }),
  ).toBeVisible();
});
