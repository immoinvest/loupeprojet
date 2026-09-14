import { expect, test } from '@playwright/test';

const LEBONCOIN = 'https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851';

test('une annonce partagée vers Deklic ouvre Nouveau projet avec son lien, adresse nettoyée', async ({
  page,
}) => {
  const texte = encodeURIComponent(`Regarde cette annonce ${LEBONCOIN}`);
  await page.goto(`/projets/nouveau?texte=${texte}`);
  await expect(page.getByRole('heading', { level: 1, name: /Colle le lien/ })).toBeVisible();
  await expect(page.getByLabel("Lien de l'annonce")).toHaveValue(LEBONCOIN);
  await expect(page.getByText('leboncoin.fr reconnu')).toBeVisible();
  await expect(page.getByText('reçue par partage')).toBeVisible();
  await expect(page).toHaveURL(/\/projets\/nouveau$/);
});
