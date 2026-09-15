import { expect, test } from '@playwright/test';

import { carte, ouvrirExemple, ouvrirVolet } from './aides';

test('financement : la durée change la mensualité ; « Simuler un prêt » ouvre le simulateur avec le prêt', async ({
  page,
}) => {
  await ouvrirExemple(page);
  await ouvrirVolet(page, 'Financement', "Comment se finance l'achat ?");

  // T3 Marseille : 161 000 € sur 25 ans à 3,35 % → 827 € par mois assurance comprise.
  const cout = carte(page, 'Ce que ça coûte');
  await expect(cout).toContainText(/827\s€/);
  await expect(carte(page, 'Le loyer porte-t-il le crédit ?')).toContainText('84 %');
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(26);

  // La durée se choisit en tuiles, comme dans le formulaire Vérifier.
  await expect(page.getByRole('radio', { name: '25 ans' })).toBeChecked();
  await page.getByText('20 ans', { exact: true }).click();
  await expect(cout).toContainText(/95[45]\s€/);
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(21);

  // Après rechargement, la durée est enregistrée et le rapport la reprend.
  await page.reload();
  await expect(
    page.getByRole('heading', { level: 1, name: "Comment se finance l'achat ?" }),
  ).toBeVisible();
  await expect(page.getByRole('radio', { name: '20 ans' })).toBeChecked();
  await expect(cout).toContainText(/95[45]\s€/);

  // Le lien porte le prêt dans son fragment et ouvre le simulateur avec ce prêt, en offre A seule.
  const lien = page.getByRole('link', { name: 'Simuler un prêt' });
  await expect(lien).toHaveAttribute('href', /^\/simulateur-pret#s=[A-Za-z0-9_-]+$/);
  await lien.click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Comparer deux offres de prêt' }),
  ).toBeVisible();
  expect(page.url()).toContain('/simulateur-pret#s=');
  const offreA = page
    .locator('section', {
      has: page.getByRole('heading', { level: 2, name: 'Offre A', exact: true }),
    })
    .first();
  await expect(offreA.getByLabel('Durée')).toHaveValue('20');
  await expect(offreA.getByLabel('Taux nominal')).toHaveValue('3.35');
  await expect(page.getByRole('button', { name: 'Ajouter une offre B' })).toBeVisible();
});
