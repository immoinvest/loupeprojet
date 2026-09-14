import { expect, test } from '@playwright/test';

import { ouvrirExemple } from './aides';

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

test('presse-papiers refusé : le lien de partage à copier tient dans l’écran', async ({ page }) => {
  // Refus déterministe, quel que soit le navigateur : le champ à copier à la main s'affiche.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    navigator.clipboard.writeText = () => Promise.reject(new Error('refusé'));
  });
  await ouvrirExemple(page);
  await page.getByRole('button', { name: 'Partager' }).click();

  const champ = page.getByLabel('Lien de partage');
  await expect(champ).toBeVisible();
  const boite = await champ.boundingBox();
  const largeur = page.viewportSize()?.width ?? 0;
  expect(boite).not.toBeNull();
  expect((boite?.x ?? 0) + (boite?.width ?? 0)).toBeLessThanOrEqual(largeur);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBe(0);
});
