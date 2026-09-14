import { expect, test } from '@playwright/test';

import { carte, ouvrirExemple, ouvrirVolet } from './aides';

test('fiscalité : « Retenir ce régime » change le régime retenu et le rapport', async ({
  page,
}) => {
  await ouvrirExemple(page);
  await ouvrirVolet(page, 'Fiscalité', /Combien d'impôts, selon le régime/);

  const reel = carte(page, 'Meublé au réel');
  const microBic = carte(page, 'Meublé micro-BIC');
  await expect(reel.getByText('retenu', { exact: true })).toBeVisible();
  await expect(microBic).toContainText(/26\s928\s€\s*d'impôt sur 10 ans/);
  await expect(page.getByRole('button', { name: 'Retenir ce régime' })).toHaveCount(3);

  await microBic.getByRole('button', { name: 'Retenir ce régime' }).click();

  await expect(microBic.getByText('retenu', { exact: true })).toBeVisible();
  await expect(reel.getByText('retenu', { exact: true })).toHaveCount(0);
  await expect(reel.getByRole('button', { name: 'Retenir ce régime' })).toBeVisible();
  await expect(
    page.getByRole('heading', {
      level: 2,
      name: 'Quand commencez-vous à payer, en meublé micro-BIC ?',
    }),
  ).toBeVisible();
  await expect(page.getByRole('img', { name: '10 années imposées sur 10' })).toBeVisible();
  await expect(page.getByText(/Premier impôt l'année 1\./)).toBeVisible();

  await ouvrirVolet(page, 'Rapport', /Le prix est bon\./);
  await expect(carte(page, "Combien d'impôts ?")).toContainText(/26\s928\s€\s*sur 10 ans/);
  await expect(carte(page, "Combien d'impôts ?")).toContainText(
    "Meublé micro-BIC : imposé à partir de l'année 1.",
  );
});

test('revente : cliquer « Dans 20 ans » change l’horizon', async ({ page }) => {
  await ouvrirExemple(page);
  await ouvrirVolet(page, 'Revente', "Qu'est-ce qu'il vous restera ?");

  const horizons = page.getByRole('group', { name: 'Horizon de revente' });
  await expect(horizons.getByRole('button')).toHaveCount(4);
  await expect(horizons.getByRole('button', { name: /Dans 10 ans/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('heading', { level: 2, name: 'Revente dans 10 ans' })).toBeVisible();

  await horizons.getByRole('button', { name: /Dans 20 ans/ }).click();

  await expect(horizons.getByRole('button', { name: /Dans 20 ans/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(horizons.getByRole('button', { name: /Dans 10 ans/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.getByRole('heading', { level: 2, name: 'Revente dans 20 ans' })).toBeVisible();
  await expect(carte(page, 'Revente dans 20 ans')).toContainText(
    /Ce qu'il vous reste en poche\s*147\s662\s€/,
  );
  await expect(page.getByText('Cash-flows cumulés sur 20 ans')).toBeVisible();

  await ouvrirVolet(page, 'Rapport', /Le prix est bon\./);
  await expect(carte(page, "Qu'est-ce qu'il vous restera ?")).toContainText(
    /147\s662\s€\s*dans 20 ans/,
  );
});

test('visite : répondre, retrouver ses réponses après rechargement, marquer la visite faite', async ({
  page,
}) => {
  await ouvrirExemple(page);
  await ouvrirVolet(page, 'Visite', 'Préparer la visite');

  await expect(page.getByRole('heading', { level: 2, name: 'Documents à demander' })).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Sur place, le logement' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Exploitation locative' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: "À régler avant l'offre" })).toHaveCount(
    0,
  );

  const ok = page.getByRole('radio', { name: 'OK' });
  const total = await ok.count();
  expect(total).toBeGreaterThanOrEqual(40);
  await expect(page.getByText(`0 sur ${String(total)} répondues`)).toBeVisible();

  // Les boutons radio sont masqués visuellement : on touche leur libellé.
  await page.getByText('OK', { exact: true }).first().click();
  await expect(ok.first()).toBeChecked();
  await expect(page.getByText(`1 sur ${String(total)} répondue`, { exact: true })).toBeVisible();
  await page.getByText('Problème', { exact: true }).nth(1).click();
  await expect(page.getByText(`2 sur ${String(total)} répondues, 1 problème`)).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Préparer la visite' })).toBeVisible();
  await expect(page.getByText(`2 sur ${String(total)} répondues, 1 problème`)).toBeVisible();
  await expect(ok.first()).toBeChecked();
  await expect(page.getByRole('link', { name: 'vos hypothèses' })).toBeVisible();

  await page.getByRole('button', { name: 'Marquer la visite comme faite' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Le prix est bon\./ })).toBeVisible();
  const bande = page.getByRole('navigation', { name: 'Volets du rapport' });
  await expect(bande.getByRole('link', { name: 'Visite', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Visite faite le .* · 1 problème/ })).toBeVisible();
  await expect(carte(page, 'Avant de faire une offre')).toContainText(
    'Prélèvements sociaux du meublé',
  );
});
