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

/**
 * La navigation « Mes projets » : barre latérale à partir de 1 024 px, tiroir en dessous.
 * Ouvre le tiroir quand le bouton de menu est affiché.
 */
export async function ouvrirNavigation(page: Page): Promise<Locator> {
  const menu = page.getByRole('button', { name: 'Ouvrir le menu' });
  if (await menu.isVisible()) await menu.click();
  const navigation = page.getByRole('navigation', { name: 'Mes projets' });
  await expect(navigation).toBeVisible();
  return navigation;
}

/** La carte (section) dont le titre de niveau 2 est exactement `titre`. */
export function carte(page: Page, titre: string): Locator {
  return page.locator('section', {
    has: page.getByRole('heading', { level: 2, name: titre, exact: true }),
  });
}

/** Nom donné par l'app au projet saisi à la main dans `creerProjetManuel`. */
export const NOM_LYON = '40 m² · Lyon';

/**
 * Depuis la liste, crée un projet à la main avec le strict minimum (Lyon, 120 000 €, 40 m²),
 * plus le loyer s'il est donné. Le Worker n'est pas joignable depuis les tests : pas de ventes
 * réelles ni de loyer de marché, donc « Prix sans repère de marché ».
 */
export async function creerProjetMinimal(page: Page, loyer?: string): Promise<void> {
  await ouvrirMesProjets(page);
  await page.getByRole('main').getByRole('button', { name: 'Nouveau projet' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Colle le lien/ })).toBeVisible();
  await page.getByRole('button', { name: /je saisis à la main/ }).click();

  await page.getByLabel('Prix affiché').fill('120000');
  await page.getByLabel('Surface').fill('40');
  await page.getByLabel('Code postal').fill('69003');
  await page.getByLabel('Ville').fill('Lyon');
  if (loyer !== undefined) await page.getByLabel('Loyer visé, hors charges').fill(loyer);
  await page.getByRole('button', { name: 'Créer le projet et voir le rapport' }).click();

  await expect(
    page.getByRole('heading', { level: 1, name: /Prix sans repère de marché\./ }),
  ).toBeVisible();
}

/** Le projet de Lyon avec un loyer de 700 € : apport, durée et tranche gardent leurs défauts. */
export async function creerProjetManuel(page: Page): Promise<void> {
  await creerProjetMinimal(page, '700');
}

/** Attend que le service worker, installé après le chargement, prenne la main sur la page. */
export async function attendreServiceWorker(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
}
