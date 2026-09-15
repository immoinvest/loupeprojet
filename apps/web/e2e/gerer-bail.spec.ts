import { expect, test } from '@playwright/test';

import { simulerSessionEtGestion } from './formats';

/*
 * Vie du bail (B1) : la fiche d'un bien montre sa conformité (DPE enregistré) et la révision du
 * loyer ; la dernière lettre de révision s'ouvre et revient à la fiche. API simulée (`reponses-gestion.ts`).
 */

test.beforeEach(async ({ page }) => {
  await simulerSessionEtGestion(page);
});

test('fiche du T2 Lices : conformité, révision, lettre de révision puis retour', async ({
  page,
}) => {
  await page.goto('/gerer/biens/bien-lices');
  const conformite = page.locator('section', {
    has: page.getByRole('heading', { level: 2, name: 'Conformité' }),
  });
  await expect(conformite.getByText('Classe D, réalisé le 1er mars 2024')).toBeVisible();
  await expect(conformite.getByText('à toi')).toBeVisible();

  const revision = page.locator('section', {
    has: page.getByRole('heading', { level: 2, name: 'Révision du loyer' }),
  });
  await expect(revision.getByRole('button', { name: 'Réglages', exact: true })).toBeVisible();
  await revision.getByRole('link', { name: 'Dernière lettre de révision' }).click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'Révision annuelle du loyer' }),
  ).toBeVisible();
  await expect(page.getByText(/^Calcul : 650/)).toBeVisible();
  await page.getByRole('link', { name: /T2 Lices/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'T2 Lices' })).toBeVisible();
});
