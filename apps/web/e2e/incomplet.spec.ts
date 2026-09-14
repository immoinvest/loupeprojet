import { expect, test } from '@playwright/test';

import { creerProjetMinimal } from './aides';

const BANDEAU = 'Il manque le loyer visé pour cette analyse';

test('quatre chiffres suffisent : le rapport dit qu’il manque le loyer et se complète sur place', async ({
  page,
}) => {
  await creerProjetMinimal(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Prix sans repère de marché. Le loyer reste à indiquer.',
  );
  const feux = page.getByLabel('Cinq feux');
  await expect(feux.getByText('Cash-flow : loyer à indiquer')).toBeVisible();
  await expect(feux.getByText('Rendement net : loyer à indiquer')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: BANDEAU })).toBeVisible();
  await expect(page.getByText('À compléter')).toHaveCount(4);

  // Fiscalité attend aussi le loyer, avec le même bandeau.
  await page
    .getByRole('navigation', { name: 'Volets du rapport' })
    .getByRole('link', { name: 'Fiscalité', exact: true })
    .click();
  await expect(page.getByRole('heading', { level: 2, name: BANDEAU })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retenir ce régime' })).toHaveCount(0);

  await page
    .getByRole('navigation', { name: 'Volets du rapport' })
    .getByRole('link', { name: 'Rapport', exact: true })
    .click();
  await page.getByLabel(/Loyer visé, hors charges/).fill('700');
  await page.getByRole('button', { name: 'Appliquer' }).click();

  await expect(page.getByRole('heading', { level: 2, name: BANDEAU })).toHaveCount(0);
  await expect(feux.getByText('Cash-flow −192 €/mois')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Prix sans repère de marché. Le loyer ne couvre pas tout.',
  );

  // Apport par défaut : 10 % du coût total (13 500 €). Taxe foncière estimée au m² (560 €) faute de
  // loyer à la création. Le loyer saisi dans le bandeau est enregistré.
  await page.reload();
  await expect(feux.getByText('Cash-flow −192 €/mois')).toBeVisible();
});
