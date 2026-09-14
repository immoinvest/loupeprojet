import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

import { ouvrirMesProjets, ouvrirNavigation } from './aides';

/** Le formulaire d'une offre : la première carte qui porte son nom (la seconde est ses résultats). */
function formulaire(page: Page, nom: string): Locator {
  return page
    .locator('section', { has: page.getByRole('heading', { level: 2, name: nom, exact: true }) })
    .first();
}

test('comparer deux offres, déplier une année, télécharger le CSV, rouvrir par le lien', async ({
  page,
  browser,
}) => {
  // Sur le PC Windows de développement, l'enregistrement du fichier téléchargé a pris jusqu'à une
  // minute (trace : clic à 3 s, `download.path()` résolu vers 58 s ; analyse antivirus probable).
  // Au-delà des 60 s par défaut, Playwright ferme la page et signale le téléchargement « canceled ».
  test.setTimeout(120_000);
  await ouvrirMesProjets(page);
  await ouvrirNavigation(page);
  await page
    .getByRole('navigation', { name: 'Outils' })
    .getByRole('link', { name: 'Simulateur de prêt' })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Comparer deux offres de prêt' }),
  ).toBeVisible();
  // Les défauts sont déjà calculés : deux offres identiques.
  await expect(page.getByText('Les deux offres sont identiques.')).toBeVisible();

  // Le nom de la banque en dernier : dès qu'il est saisi, la carte prend ce nom pour titre.
  const a = formulaire(page, 'Offre A');
  await a.getByLabel('Taux nominal').fill('3,3');
  await a.getByLabel('Durée').fill('25');
  await a.getByLabel('Banque').fill('LCL');
  const b = formulaire(page, 'Offre B');
  await b.getByLabel('Taux nominal').fill('1,7');
  await b.getByLabel('Banque').fill('CIC');
  await expect(page.getByRole('heading', { level: 2, name: 'LCL' }).first()).toBeVisible();

  // La comparaison suit sans autre action, avec la meilleure valeur et la phrase de synthèse.
  const comparaison = page.locator('section', {
    has: page.getByRole('heading', { level: 2, name: 'Laquelle coûte le moins ?' }),
  });
  await expect(comparaison).toBeVisible();
  await expect(comparaison.getByText('meilleure').first()).toBeVisible();
  await expect(comparaison.getByText(/CIC le coût total le plus bas/)).toBeVisible();

  // Tableaux : un onglet par offre, une année dépliable en douze mois.
  const onglets = page.getByRole('group', { name: 'Offre affichée' });
  await expect(onglets.getByRole('button', { name: 'LCL' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: "Voir les mois de l'année 1", exact: true }).click();
  const mois = page.getByRole('table', { name: "Mois de l'année 1" });
  await expect(mois).toBeVisible();
  await expect(mois.getByRole('row')).toHaveCount(13);

  // Le CSV : nom du fichier, BOM, séparateur « ; », virgule décimale, CRLF.
  const [telechargement] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Télécharger le tableau (CSV)' }).click(),
  ]);
  expect(telechargement.suggestedFilename()).toBe('deklic-amortissement-lcl-25-ans-3-30.csv');
  const chemin = await telechargement.path();
  const contenu = readFileSync(chemin, 'utf8');
  expect(contenu.charCodeAt(0)).toBe(0xfeff);
  const lignes = contenu.slice(1).split('\r\n');
  expect(lignes[0]).toBe(
    'Mois;Année;Phase;Capital restant dû début;Intérêts;Capital remboursé;Mensualité hors assurance;Assurance;Mensualité totale;Capital restant dû fin',
  );
  expect(lignes[1]).toMatch(/^1;1;Amortissement(;\d+,\d{2}){7}$/);
  expect(lignes[301]).toMatch(/^Totaux;;;(;\d+,\d{2}){6}$/);
  expect(lignes).toHaveLength(303);

  // La dernière simulation est retrouvée après rechargement, et l'adresse porte le lien.
  await page.reload();
  await expect(formulaire(page, 'LCL').getByLabel('Durée')).toHaveValue('25');
  await expect.poll(() => page.url()).toMatch(/#s=/);

  // « Copier le lien » : copié, ou affiché à copier quand le presse-papiers refuse.
  await page.getByRole('button', { name: 'Copier le lien' }).click();
  await expect(
    page.getByRole('button', { name: 'Lien copié' }).or(page.getByLabel('Lien de la simulation')),
  ).toBeVisible();

  // Le lien reproduit la simulation dans un contexte neuf.
  const neuf = await browser.newContext();
  const autre = await neuf.newPage();
  await autre.goto(page.url());
  await expect(formulaire(autre, 'CIC').getByLabel('Taux nominal')).toHaveValue('1.7');
  await expect(autre.getByText(/CIC le coût total le plus bas/)).toBeVisible();
  await neuf.close();
});

test('imprimer ouvre le document de la simulation, hors coque', async ({ page }) => {
  await page.goto('/simulateur-pret');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Comparer deux offres de prêt' }),
  ).toBeVisible();
  await page.addInitScript(() => {
    window.print = () => undefined;
  });
  await page.getByRole('button', { name: 'Imprimer', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Simulation de prêt' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Les hypothèses' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Outils' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Retour au simulateur' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Comparer deux offres de prêt' }),
  ).toBeVisible();
});
