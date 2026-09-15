import { expect, test } from '@playwright/test';

import {
  NOM_EXEMPLE,
  NOM_LYON,
  creerProjetManuel,
  ouvrirMesProjets,
  ouvrirNavigation,
} from './aides';

test('au premier lancement, la racine est l’accueil ; « Mes projets » montre le projet d’exemple', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Bienvenue sur Deklic' })).toBeVisible();
  await ouvrirMesProjets(page);

  const liste = page.getByRole('main');
  await expect(liste.getByRole('link', { name: NOM_EXEMPLE })).toBeVisible();
  await expect(liste.getByText('Visite prévue')).toBeVisible();
  await expect(liste.getByText('−210 €/mois')).toBeVisible();
  await expect(liste.getByText('−25 %')).toBeVisible();

  // La navigation (barre latérale, ou tiroir sur téléphone et tablette) liste aussi le projet
  // et compte « 1 projet ».
  const barre = await ouvrirNavigation(page);
  await expect(barre.getByRole('link', { name: NOM_EXEMPLE })).toBeVisible();
  await expect(page.getByText('Gratuit · 1 projet')).toBeVisible();

  // Revenir sur la liste ne recrée pas l'exemple : toujours un seul projet.
  await ouvrirMesProjets(page);
  await expect(liste.getByRole('link', { name: NOM_EXEMPLE })).toHaveCount(1);
});

test('un projet saisi à la main a son rapport, apparaît dans la liste et se supprime', async ({
  page,
}) => {
  await creerProjetManuel(page);
  await expect(page).toHaveURL(/\/projets\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Prix sans repère de marché. Le loyer ne couvre pas tout.',
  );
  await expect(page.getByText('120 000 € · meublé longue durée')).toBeVisible();
  // Durée 25 ans et tranche 30 % par défaut (badge « estimé »).
  await expect(page.getByLabel('Cinq feux').getByText('Cash-flow −222 €/mois')).toBeVisible();
  await expect(
    page.getByLabel('Cinq feux').getByText('Prix vs ventes réelles : pas de données'),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Mes projets', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Mes projets' })).toBeVisible();
  const liste = page.getByRole('main');
  await expect(liste.getByRole('link', { name: NOM_LYON })).toBeVisible();
  await expect(liste.getByRole('link', { name: NOM_EXEMPLE })).toBeVisible();

  // Le filtre « Écartés » ne montre rien, « Tous » ramène les deux projets.
  await page.getByRole('button', { name: 'Écartés' }).click();
  await expect(liste.getByText('Aucun projet dans cette liste.')).toBeVisible();
  await page.getByRole('button', { name: 'Tous' }).click();
  await expect(liste.getByRole('link', { name: NOM_LYON })).toBeVisible();

  await page.getByRole('button', { name: `Supprimer ${NOM_LYON}` }).click();
  await expect(liste.getByRole('link', { name: NOM_LYON })).toHaveCount(0);
  await expect(liste.getByRole('link', { name: NOM_EXEMPLE })).toBeVisible();
});

test('recharger la page conserve les projets, le statut et la route ouverte', async ({ page }) => {
  await creerProjetManuel(page);
  await page.getByRole('button', { name: /Statut du projet/ }).click();
  await page.getByRole('option', { name: 'Offre faite' }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);

  // Route profonde rechargée : le repli SPA sert la page, le stockage rend le projet.
  await page.reload();
  await expect(
    page.getByRole('heading', { level: 1, name: /Prix sans repère de marché\./ }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Statut du projet/ })).toHaveText('Offre faite');

  await ouvrirMesProjets(page);
  const liste = page.getByRole('main');
  await expect(liste.getByRole('link', { name: NOM_LYON })).toBeVisible();
  await expect(liste.getByRole('link', { name: NOM_EXEMPLE })).toBeVisible();
  await expect(liste.getByText('Offre faite')).toBeVisible();

  // Un onglet neuf du même navigateur voit les mêmes projets.
  const autre = await page.context().newPage();
  await ouvrirMesProjets(autre);
  await expect(autre.getByRole('main').getByRole('link', { name: NOM_LYON })).toBeVisible();
  await autre.close();
});
