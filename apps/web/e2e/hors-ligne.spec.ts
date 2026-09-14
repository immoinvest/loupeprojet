import { expect, test } from '@playwright/test';

import { NOM_EXEMPLE, ouvrirMesProjets } from './aides';

test('déjà visitée, Deklic s’ouvre sans réseau, jusqu’aux volets d’un projet', async ({
  page,
  context,
}) => {
  await ouvrirMesProjets(page);
  // Le service worker s'installe après le chargement, puis prend la main sur la page.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
  const href = await page
    .getByRole('main')
    .getByRole('link', { name: NOM_EXEMPLE })
    .getAttribute('href');
  if (href === null) throw new Error("Le lien du projet d'exemple n'a pas d'adresse.");

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Mes projets' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: NOM_EXEMPLE })).toBeVisible();

  // Route profonde, jamais ouverte : la coque en cache sert la page, le volet se calcule ici.
  await page.goto(`${href}/fiscalite`);
  await expect(
    page.getByRole('heading', { level: 1, name: /Combien d'impôts, selon le régime/ }),
  ).toBeVisible();
  await context.setOffline(false);
});
