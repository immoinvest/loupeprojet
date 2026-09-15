import { expect, test } from '@playwright/test';

import { carte, ouvrirExemple, ouvrirVolet } from './aides';

test('changer le loyer recalcule le cash-flow ; le montant ne prend que des chiffres', async ({
  page,
}) => {
  await ouvrirExemple(page);
  await ouvrirVolet(page, 'Hypothèses', 'Vos hypothèses');

  const synthese = page.getByText('Cash-flow', { exact: true }).locator('..');
  await expect(synthese).toContainText('−210 €/mois');

  // Le même champ de montant que le formulaire Vérifier : milliers espacés pendant la frappe.
  const loyer = page.getByLabel('Loyer visé, hors charges');
  await expect(loyer).toHaveValue('980');
  await loyer.fill('13a00');
  await expect(loyer).toHaveValue(/^1\s300$/);
  await expect(synthese).toContainText('+91 €/mois');

  // Après rechargement, le loyer (1 300 €) a été enregistré.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Vos hypothèses' })).toBeVisible();
  await expect(page.getByLabel('Loyer visé, hors charges')).toHaveValue(/^1\s300$/);
  await expect(synthese).toContainText('+91 €/mois');

  // Le rapport suit : le loyer couvre désormais tout.
  await ouvrirVolet(page, 'Rapport', 'Le prix est bon. Le loyer couvre tout.');
  await expect(page.getByLabel('Cinq feux').getByText('Cash-flow +91 €/mois')).toBeVisible();
});

test('les commandes de Vérifier : le DPE et les pièces se changent d’un clic, le rapport suit', async ({
  page,
}) => {
  await ouvrirExemple(page);
  await ouvrirVolet(page, 'Hypothèses', 'Vos hypothèses');

  const dpe = page.getByRole('radiogroup', { name: 'DPE' });
  await expect(dpe.getByRole('radio', { name: 'D' })).toBeChecked();
  await dpe.getByText('G', { exact: true }).click();
  await expect(dpe.getByRole('radio', { name: 'G' })).toBeChecked();

  const pieces = page.getByLabel('Pièces', { exact: true });
  await expect(pieces).toHaveValue('3');
  await page
    .locator('[data-champ="bien.pieces"]')
    .getByRole('button', { name: 'Un de plus' })
    .click();
  await expect(pieces).toHaveValue('4');

  // Enregistré : le rechargement garde les deux, et la visite tient compte du DPE G.
  await page.reload();
  await expect(
    page.getByRole('radiogroup', { name: 'DPE' }).getByRole('radio', { name: 'G' }),
  ).toBeChecked();
  await expect(page.getByLabel('Pièces', { exact: true })).toHaveValue('4');
  await ouvrirVolet(page, 'Visite', 'Préparer la visite');
  await expect(
    page.getByRole('paragraph').filter({ hasText: /DPE G : location interdite/ }),
  ).toBeVisible();
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
