import { expect, test } from '@playwright/test';

import { simulerSessionEtGestion } from './formats';

/*
 * Gérer, pages reliées (G1d) : chaque nom mène à sa page, chaque action arrive préremplie et
 * ramène là d'où l'on vient. Navigation seule, sur l'API de gestion simulée (`reponses-gestion.ts`).
 */

test.beforeEach(async ({ page }) => {
  await simulerSessionEtGestion(page);
});

test('Mes biens : « Louer » ouvre « Nouveau locataire » sur le bien vacant ; « Annuler » ramène', async ({
  page,
}) => {
  await page.goto('/gerer/biens');
  await page.getByRole('link', { name: 'Louer Parking Prado' }).click();
  const formulaire = page.getByRole('form', { name: 'Nouveau locataire' });
  await expect(formulaire.getByRole('button', { name: 'Bien Parking Prado' })).toBeVisible();
  await formulaire.getByRole('link', { name: 'Annuler' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '3 biens' })).toBeVisible();
});

test('loyers du mois : « À faire » propose de louer le parking ; le nom de Julie ouvre sa fiche', async ({
  page,
}) => {
  await page.goto('/gerer');
  const aFaire = page.getByRole('list', { name: 'À faire' });
  await aFaire.getByRole('link', { name: /^Louer Parking Prado/ }).click();
  await expect(
    page.getByRole('form', { name: 'Nouveau locataire' }).getByRole('link', { name: 'Annuler' }),
  ).toHaveAttribute('href', '/gerer');

  await page.goto('/gerer');
  await page.getByRole('main').getByRole('link', { name: 'Julie Martin' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Julie Martin' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Fil d’Ariane' })
    .getByRole('link', { name: 'Mes locataires' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: '2 locataires' })).toBeVisible();
});

test('une quittance ouverte depuis la fiche d’un bien y ramène', async ({ page }) => {
  await page.goto('/gerer/documents/document-julie?retour=%2Fgerer%2Fbiens%2Fbien-lices');
  await page.getByRole('link', { name: /T2 Lices/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'T2 Lices' })).toBeVisible();
});
