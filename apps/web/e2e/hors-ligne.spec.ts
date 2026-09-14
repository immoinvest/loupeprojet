import { expect, test } from '@playwright/test';

import { NOM_EXEMPLE, attendreServiceWorker, ouvrirMesProjets } from './aides';

test('déjà visitée, Deklic s’ouvre sans réseau, jusqu’aux volets d’un projet', async ({
  page,
  context,
}) => {
  await ouvrirMesProjets(page);
  await attendreServiceWorker(page);
  const href = await page
    .getByRole('main')
    .getByRole('link', { name: NOM_EXEMPLE })
    .getAttribute('href');
  if (href === null) throw new Error("Le lien du projet d'exemple n'a pas d'adresse.");

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Mes projets' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: NOM_EXEMPLE })).toBeVisible();

  // Route profonde, jamais ouverte : la coque en cache sert la page, le volet se calcule ici.
  await page.goto(`${href}/fiscalite`);
  await expect(
    page.getByRole('heading', { level: 1, name: /Combien d'impôts, selon le régime/ }),
  ).toBeVisible();
  await context.setOffline(false);
});

test('une annonce partagée reste sur l’appareil : la coque en cache la sert, sans le serveur', async ({
  page,
  context,
}) => {
  await ouvrirMesProjets(page);
  await attendreServiceWorker(page);
  // Requêtes que le service worker envoie lui-même au réseau.
  const envoyees: string[] = [];
  context.on('request', (requete) => {
    if (requete.serviceWorker() !== null) envoyees.push(requete.url());
  });

  // Témoin : une navigation ordinaire passe par le réseau, et l'écoute la voit bien.
  await page.goto('/extension');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect
    .poll(() => envoyees.some((adresse) => new URL(adresse).pathname === '/extension'))
    .toBe(true);

  const annonce = 'T3 lumineux, 155 000 €, DPE D';
  await page.goto(`/projets/nouveau?texte=${encodeURIComponent(annonce)}`);
  await expect(page.getByRole('heading', { level: 1, name: /Colle le lien/ })).toBeVisible();
  await expect(page.locator('textarea[name="texte"]')).toHaveValue(annonce);
  expect(envoyees.filter((adresse) => adresse.includes('texte='))).toEqual([]);
});
