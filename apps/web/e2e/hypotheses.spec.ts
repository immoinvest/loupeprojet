import { expect, test } from '@playwright/test';

import { ouvrirExemple, ouvrirVolet } from './aides';

test('changer le loyer recalcule le cash-flow ; une valeur invalide est refusée', async ({
  page,
}) => {
  await ouvrirExemple(page);
  await ouvrirVolet(page, 'Hypothèses', 'Vos hypothèses');

  const synthese = page.getByText('Cash-flow', { exact: true }).locator('..');
  await expect(synthese).toContainText('−210 €/mois');

  const loyer = page.getByLabel('Loyer visé, hors charges');
  await expect(loyer).toHaveValue('980');
  await loyer.fill('1300');
  await expect(synthese).toContainText('+91 €/mois');

  // « abc » n'est pas un nombre : message affiché, la dernière valeur valide reste en vigueur.
  await loyer.fill('abc');
  await expect(page.getByText('Nombre attendu.')).toBeVisible();
  await expect(synthese).toContainText('+91 €/mois');

  // Après rechargement, seul le loyer valide (1 300 €) a été enregistré.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Vos hypothèses' })).toBeVisible();
  await expect(page.getByLabel('Loyer visé, hors charges')).toHaveValue('1300');
  await expect(page.getByText('Nombre attendu.')).toHaveCount(0);
  await expect(synthese).toContainText('+91 €/mois');

  // Le rapport suit : le loyer couvre désormais tout.
  await ouvrirVolet(page, 'Rapport', 'Le prix est bon. Le loyer couvre tout.');
  await expect(page.getByLabel('Cinq feux').getByText('Cash-flow +91 €/mois')).toBeVisible();
});
