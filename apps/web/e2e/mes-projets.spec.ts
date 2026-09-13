import { expect, test } from '@playwright/test';

import { NOM_EXEMPLE, ouvrirMesProjets } from './aides';

test('au premier lancement, la racine mène à « Mes projets » avec le projet d’exemple', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/projets$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Mes projets' })).toBeVisible();

  const liste = page.getByRole('main');
  await expect(liste.getByRole('link', { name: NOM_EXEMPLE })).toBeVisible();
  await expect(liste.getByText('1 projet · sauvegardés sur cet appareil')).toBeVisible();
  await expect(liste.getByText('Visite prévue')).toBeVisible();
  await expect(liste.getByText('−210 €/mois')).toBeVisible();
  await expect(liste.getByText('−22 %')).toBeVisible();

  // La barre latérale liste aussi le projet et compte « 1 projet ».
  const barre = page.getByRole('navigation', { name: 'Mes projets' });
  await expect(barre.getByRole('link', { name: NOM_EXEMPLE })).toBeVisible();
  await expect(page.getByText('Gratuit · 1 projet')).toBeVisible();

  // Revenir sur la liste ne recrée pas l'exemple : toujours un seul projet.
  await ouvrirMesProjets(page);
  await expect(liste.getByRole('link', { name: NOM_EXEMPLE })).toHaveCount(1);
});
