import { expect, test, type Page } from '@playwright/test';

import { carte, ouvrirExemple, ouvrirVolet } from './aides';

/** Position de défilement du contenu (seul `main` défile, coque fixe). */
const defilement = (page: Page): Promise<number> =>
  page.getByRole('main').evaluate((main) => main.scrollTop);

/** Le champ n'est pas caché sous l'en-tête collé du projet. */
async function sousLEnTete(page: Page, champ: ReturnType<Page['getByLabel']>): Promise<void> {
  const enTete = await page.locator('[data-cadre-projet] header').boundingBox();
  const boite = await champ.boundingBox();
  if (enTete === null || boite === null) throw new Error('en-tête ou champ non affiché');
  expect(boite.y).toBeGreaterThanOrEqual(enTete.y + enTete.height - 1);
}

test('Rapport → loyer → Hypothèses au champ, modifier, voir l’effet, revenir au même endroit', async ({
  page,
}) => {
  await ouvrirExemple(page);
  const cascade = carte(page, "Est-ce que ça s'autofinance ?");
  const lien = cascade.getByRole('link', { name: /modifier Loyer visé, hors charges$/ });
  await lien.scrollIntoViewIfNeeded();
  const avant = await defilement(page);
  await lien.click();

  await expect(page.getByRole('heading', { level: 1, name: 'Vos hypothèses' })).toBeVisible();
  const loyer = page.getByLabel('Loyer visé, hors charges');
  await expect(loyer).toBeFocused();
  await expect(loyer).toBeInViewport();
  await sousLEnTete(page, loyer);
  await expect(page.getByRole('button', { name: 'Revenir à Rapport' })).toBeVisible();

  await loyer.fill('1300');
  const message = page.getByRole('status').filter({ hasText: 'Cash-flow' });
  await expect(message).toContainText(/Cash-flow\s:\s−210\s€\/mois\s→\s\+91\s€\/mois/);

  await message.getByRole('button', { name: 'Revenir à Rapport' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Le prix est bon\./ })).toBeVisible();
  await expect(cascade).toContainText(/\+1\s300\s€/);
  // Retour par l'historique : la position du Rapport revient (à la hauteur du contenu près).
  await expect.poll(async () => Math.abs((await defilement(page)) - avant)).toBeLessThan(80);
});

test('Fiscalité → tranche d’imposition : Hypothèses au champ ; le lien direct ouvre le champ', async ({
  page,
}) => {
  await ouvrirExemple(page);
  await ouvrirVolet(page, 'Fiscalité', /Combien d'impôts/);
  await page.getByRole('link', { name: /modifier Tranche d'imposition$/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Vos hypothèses' })).toBeVisible();
  const tranche = page.getByLabel("Tranche d'imposition", { exact: true });
  await expect(tranche).toBeFocused();
  await sousLEnTete(page, tranche);
  await expect(page.getByRole('button', { name: 'Revenir à Fiscalité' })).toBeVisible();

  // Adresse partageable : le fragment seul suffit, sans bandeau de retour.
  const adresse = new URL(page.url());
  await page.goto(`${adresse.pathname}#hypotheses.charges.taxeFonciere`);
  await expect(page.getByLabel('Taxe foncière')).toBeFocused();
  await expect(page.getByRole('button', { name: /^Revenir à/ })).toHaveCount(0);
});

test('Financement : l’apport de « D’où vient l’argent » se change sur place', async ({ page }) => {
  await ouvrirExemple(page);
  await ouvrirVolet(page, 'Financement', /financement/i);
  const avant = page.url();
  await page.getByRole('link', { name: /modifier Apport$/ }).click();
  await expect(page.getByLabel('Apport', { exact: true })).toBeFocused();
  expect(page.url()).toBe(avant);
});
