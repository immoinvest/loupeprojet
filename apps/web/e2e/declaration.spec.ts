import { expect, test } from '@playwright/test';

import { simulerSessionEtGestion } from './formats';

/*
 * Déclaration (G5-3), export de l'année (G5-5) et réel contre prévu (G5-2), sur l'API de gestion
 * simulée (`reponses-gestion.ts`) : les loyers et dépenses simulés datent de l'année en cours.
 */

test.beforeEach(async ({ page }) => {
  await simulerSessionEtGestion(page);
});

test('Déclaration : l’année en cours choisie, le micro-BIC du meublé, le fichier CSV de l’année', async ({
  page,
}) => {
  const annee = new Date().getFullYear();
  await page.goto('/gerer/declaration');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    `Déclaration ${String(annee)} (revenus ${String(annee - 1)})`,
  );
  await page.getByRole('button', { name: `Revenus de l’année ${String(annee - 1)}` }).click();
  await page.getByRole('option', { name: String(annee) }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    `Déclaration ${String(annee + 1)} (revenus ${String(annee)})`,
  );
  await expect(page.getByRole('region', { name: 'Micro-BIC' })).toContainText('case 5NI');

  const telechargement = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter l’année (CSV)' }).click();
  expect((await telechargement).suggestedFilename()).toBe(`deklic-gestion-${String(annee)}.csv`);

  await page.getByRole('link', { name: 'Récapitulatif imprimable' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: `Récapitulatif de l’année ${String(annee)}` }),
  ).toBeVisible();
});

test('fiche d’un bien sans analyse : « Analyser ce bien » ouvre le formulaire Vérifier', async ({
  page,
}) => {
  await page.goto('/gerer/biens/bien-lices');
  await page.getByRole('link', { name: 'Analyser ce bien' }).click();
  await expect(page.getByRole('button', { name: /Préciser/ })).toBeVisible();
});
