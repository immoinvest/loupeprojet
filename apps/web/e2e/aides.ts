import { expect, type Locator, type Page } from '@playwright/test';

/** Nom du projet créé au premier lancement (voir `ProjetsProvider`). */
export const NOM_EXEMPLE = 'T3 · 65 m² · Marseille 5e';

export type Volet = 'Rapport' | 'Hypothèses' | 'Fiscalité' | 'Revente' | 'Visite';

/** Ouvre la liste « Mes projets » et attend son titre. */
export async function ouvrirMesProjets(page: Page): Promise<void> {
  await page.goto('/projets');
  await expect(page.getByRole('heading', { level: 1, name: 'Mes projets' })).toBeVisible();
}

/** Depuis la liste, ouvre le rapport du projet d'exemple et attend son verdict. */
export async function ouvrirExemple(page: Page): Promise<void> {
  await ouvrirMesProjets(page);
  await page.getByRole('main').getByRole('link', { name: NOM_EXEMPLE }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Le prix est bon\./ })).toBeVisible();
}

/** Depuis un projet ouvert, passe à un volet du rapport et attend son titre. */
export async function ouvrirVolet(page: Page, volet: Volet, titre: string | RegExp): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Volets du rapport' })
    .getByRole('link', { name: volet, exact: true })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: titre })).toBeVisible();
}

/** La carte (section) dont le titre de niveau 2 est exactement `titre`. */
export function carte(page: Page, titre: string): Locator {
  return page.locator('section', {
    has: page.getByRole('heading', { level: 2, name: titre, exact: true }),
  });
}
