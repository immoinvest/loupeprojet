import { expect, test } from '@playwright/test';

import { carte, ouvrirExemple, ouvrirVolet } from './aides';

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

test('négocier le prix : le curseur règle le prix retenu, l’en-tête et le rapport suivent', async ({
  page,
}) => {
  await ouvrirExemple(page);
  await ouvrirVolet(page, 'Hypothèses', 'Vos hypothèses');

  // Les montants sont formatés avec des espaces insécables : `\s` les reconnaît, une espace ordinaire non.
  const curseur = page.getByRole('slider', { name: 'Négociation' });
  await expect(curseur).toHaveValue('0');
  await expect(page.getByText(/^Prix retenu/)).toHaveText(/155\s000\s€/);
  await curseur.fill('5');
  await expect(page.getByRole('textbox', { name: /^Négociation/ })).toHaveValue('5');
  await expect(page.getByText(/^Prix retenu/)).toHaveText(/147\s250\s€.*−7\s750\s€.*−5\s%/);
  await expect(page.getByText(/147\s250\s€.*négocié\s−5\s%/).first()).toBeVisible();

  // Le prix retenu est enregistré : il survit au rechargement et le rapport le dit.
  await page.reload();
  await expect(page.getByRole('slider', { name: 'Négociation' })).toHaveValue('5');
  await ouvrirVolet(page, 'Rapport', /Le prix est bon\./);
  await expect(carte(page, "Est-ce que c'est cher ?")).toContainText(
    /Prix affiché\s155\s000\s€.*retenu\s147\s250\s€.*−5\s%/,
  );
});
