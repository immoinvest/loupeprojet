import { expect, test } from '@playwright/test';

import { ouvrirExemple, ouvrirMesProjets, ouvrirVolet } from './aides';

test('hypothèses : passer en colocation montre les champs du type et limite les régimes', async ({
  page,
}) => {
  await ouvrirExemple(page);
  await ouvrirVolet(page, 'Hypothèses', 'Vos hypothèses');

  const types = page.getByRole('radiogroup', { name: 'Type de location' });
  await expect(types.getByRole('radio', { name: 'Meublée' })).toBeChecked();
  await expect(page.getByLabel('Loyer visé, hors charges')).toHaveValue('980');

  // Le bouton radio est masqué (sr-only) : on clique son libellé visible, comme l'utilisateur ;
  // cliquer l'input de 1 px échoue en CI (« <html> intercepts pointer events »).
  await types.getByText('Colocation', { exact: true }).click();
  await expect(
    page.getByRole('heading', { level: 2, name: 'La location — Colocation' }),
  ).toBeVisible();
  await expect(types.getByRole('radio', { name: 'Colocation' })).toBeChecked();
  // 980 € × 1,35 ÷ 2 chambres = 662 € par chambre (règles 2026-09).
  await expect(page.getByLabel('Chambres louées')).toHaveValue('2');
  await expect(page.getByLabel('Loyer par chambre, hors charges')).toHaveValue('662');
  await expect(page.getByLabel('Loyer visé, hors charges')).toHaveCount(0);

  // Une colocation relève du meublé : seuls les deux régimes BIC sont proposés.
  await ouvrirVolet(page, 'Fiscalité', /Combien d'impôts, selon le régime/);
  await expect(
    page.getByRole('heading', { level: 2, name: 'Meublé au réel', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Meublé micro-BIC', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Nu au réel', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', { level: 2, name: 'Nu micro-foncier', exact: true }),
  ).toHaveCount(0);
});

test('vérifier : créer une courte durée à la main, nuitée et nuits par mois', async ({ page }) => {
  await ouvrirMesProjets(page);
  await page.getByRole('main').getByRole('button', { name: 'Nouveau projet' }).click();
  await page.getByRole('button', { name: /je saisis à la main/ }).click();

  await page.getByLabel('Prix affiché').fill('120000');
  await page.getByLabel('Surface').fill('32');
  await page.getByLabel('Code postal').fill('13002');
  await page.getByLabel('Ville').fill('Marseille');

  const types = page.getByRole('radiogroup', { name: 'Type de location' });
  // Le bouton radio est masqué (sr-only) : on clique son libellé visible, comme l'utilisateur ;
  // cliquer l'input de 1 px échoue en CI (« <html> intercepts pointer events »).
  await types.getByText('Courte durée', { exact: true }).click();
  await expect(page.getByLabel('Loyer visé, hors charges')).toHaveCount(0);
  await page.getByLabel('Prix de la nuitée, hors ménage').fill('70');
  await page.getByLabel('Nuits louées par mois').fill('16');
  await page.getByLabel('Apport').fill('10000');
  await page.getByRole('button', { name: 'Créer le projet et voir le rapport' }).click();

  await expect(
    page.getByRole('heading', { level: 1, name: /Prix sans repère de marché\./ }),
  ).toBeVisible();
  await ouvrirVolet(page, 'Hypothèses', 'Vos hypothèses');
  await expect(
    page.getByRole('heading', { level: 2, name: 'La location — Courte durée' }),
  ).toBeVisible();
  await expect(page.getByLabel('Prix de la nuitée, hors ménage')).toHaveValue('70');
  await expect(page.getByLabel('Nuits louées par mois')).toHaveValue('16');

  // La vigilance propre au meublé de tourisme apparaît dans l'onglet Visite.
  await ouvrirVolet(page, 'Visite', 'Préparer la visite');
  // Le texte de la question est aussi dans une légende masquée (lecteurs d'écran) : on vise le paragraphe.
  await expect(page.getByRole('paragraph').filter({ hasText: /changement d'usage/ })).toBeVisible();
});
