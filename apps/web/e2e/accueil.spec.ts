import { expect, test } from '@playwright/test';

import { NOM_EXEMPLE, ouvrirNavigation } from './aides';

/*
 * L'accueil : la racine du site, rejointe par le logo ; sans compte, un bloc Analyser et un bloc Gérer.
 * Depuis l'accueil, « Tous mes projets » mène à la liste, qui garde Comparer.
 */

test('le logo mène à l’accueil ; ses deux blocs lancent l’analyse et la liste des projets', async ({
  page,
}) => {
  await page.goto('/extension');
  await page.getByRole('link', { name: 'Deklic : accueil' }).filter({ visible: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Bienvenue sur Deklic' })).toBeVisible();

  const contenu = page.getByRole('main');
  await expect(contenu.getByRole('heading', { level: 2, name: 'Analyser' })).toBeVisible();
  await expect(contenu.getByRole('heading', { level: 2, name: 'Gérer' })).toBeVisible();
  await expect(contenu.getByRole('link', { name: 'Voir l’exemple' })).toBeVisible();

  const navigation = await ouvrirNavigation(page);
  await expect(navigation.getByRole('link', { name: NOM_EXEMPLE })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Comparer' })).toHaveCount(0);
  await navigation.getByRole('link', { name: 'Tous mes projets · 1' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Mes projets' })).toBeVisible();
  await contenu.getByRole('button', { name: 'Comparer' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Comparer' })).toBeVisible();

  await page.goto('/');
  await contenu.getByRole('link', { name: 'Analyser une annonce' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Colle le lien/ })).toBeVisible();
});
