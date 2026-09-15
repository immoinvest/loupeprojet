import { expect, test } from '@playwright/test';

import { simulerSessionEtGestion } from './formats';

/*
 * Argent (G5-1) et dépenses (G5-4), sur l'API de gestion simulée (`reponses-gestion.ts`) : la page
 * se lit, ses montants mènent aux fiches, « Ajouter une dépense » arrive avec le bien et y ramène.
 */

test.beforeEach(async ({ page }) => {
  await simulerSessionEtGestion(page);
});

test('Argent : la phrase du mois, la courbe des 12 mois, un montant du T2 Lices ouvre sa fiche', async ({
  page,
}) => {
  await page.goto('/gerer/argent');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    /tes biens t’ont (rapporté|coûté)/,
  );
  await expect(
    page.getByRole('list', { name: 'Cash-flow des 12 derniers mois' }).getByRole('listitem'),
  ).toHaveCount(12);
  await page.getByRole('link', { name: /^Loyers encaissés de T2 Lices/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'T2 Lices' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Le prêt' })).toContainText('Capital restant dû');
});

test('fiche d’un bien : « Ajouter une dépense » arrive avec le bien choisi ; « Annuler » ramène', async ({
  page,
}) => {
  await page.goto('/gerer/biens/bien-lices');
  await page.getByRole('link', { name: 'Ajouter une dépense' }).click();
  const formulaire = page.getByRole('form', { name: 'Nouvelle dépense' });
  await expect(formulaire.getByRole('button', { name: 'Bien T2 Lices' })).toBeVisible();
  await formulaire.getByRole('link', { name: 'Annuler' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'T2 Lices' })).toBeVisible();
});
