import { expect, test } from '@playwright/test';

import { carte, ouvrirExemple } from './aides';

test('le rapport affiche le verdict, les cinq feux et les chiffres clés', async ({ page }) => {
  await ouvrirExemple(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Le prix est bon. Le loyer ne couvre pas tout.',
  );

  const feux = page.getByLabel('Cinq feux');
  await expect(feux.getByText(/Prix|Rendement net|Cash-flow|Crédit|Risques/)).toHaveText([
    'Prix −25 %',
    'Rendement net 4,3 %',
    'Cash-flow −210 €/mois',
    'Crédit 84 % du loyer',
    'Risques : aucun',
  ]);

  // L'autofinancement est la première carte : la cascade, puis les trois repères.
  const autofinancement = carte(page, "Est-ce que ça s'autofinance ?");
  await expect(page.getByRole('heading', { level: 2 }).first()).toHaveText(
    "Est-ce que ça s'autofinance ?",
  );
  await expect(autofinancement).toContainText('Non.');
  await expect(autofinancement).toContainText(/Loyer\s*\+980\s€/);
  await expect(autofinancement).toContainText(/Après le crédit\s*\+153\s€/);
  await expect(autofinancement).toContainText(/Reste chaque mois\s*−210\s€/);
  await expect(autofinancement).toContainText(/Meublé au réel, moyenne sur 10 ans\s*0\s€/);
  await expect(autofinancement).toContainText(/Après l'impôt\s*−210\s€/);
  await expect(autofinancement).toContainText('Part du loyer prise par le crédit');
  await expect(autofinancement).toContainText(/84\s%/);
  await expect(autofinancement).toContainText("Effort d'épargne");
  await expect(autofinancement).toContainText(/210\s€\/mois/);
  await expect(autofinancement).toContainText("Loyer d'équilibre");
  await expect(autofinancement).toContainText(/1\s203\s€/);

  await expect(carte(page, "Est-ce que c'est cher ?")).toContainText('Non.');

  const rendements = carte(page, 'Combien ça rapporte ?');
  await expect(rendements).toContainText(/6,8\s%/);
  await expect(rendements).toContainText(/4,3\s%/);
  await expect(rendements).toContainText(/1,0\s%/);

  await expect(page.getByText('Levier 1 · Négocier').locator('..')).toContainText('119 663 €');

  await expect(carte(page, "Combien d'impôts ?")).toContainText(/0\s€\s*sur 10 ans/);
  await expect(carte(page, "Combien d'impôts ?")).toContainText('Meublé au réel.');

  const revente = carte(page, "Qu'est-ce qu'il vous restera ?");
  await expect(revente).toContainText(/58\s217\s€\s*dans 10 ans/);
  await expect(revente).toContainText('Multiple sur apport');
  await expect(revente).toContainText(/×\s0,7/);
});

test('les icônes ouvrent une bulle qui tient dans l’écran, les liens mènent aux onglets', async ({
  page,
}) => {
  await ouvrirExemple(page);

  // Aucun « Pourquoi ? » ni faux lien : une icône ⓘ par titre et par repère.
  await expect(page.getByText('Pourquoi ?')).toHaveCount(0);
  await expect(page.getByText('Comparer les 4 régimes')).toHaveCount(0);

  const icone = page.getByRole('button', {
    name: 'Explication : Part du loyer prise par le crédit',
  });
  await icone.click();
  const bulle = page.getByRole('tooltip');
  await expect(bulle).toBeVisible();
  await expect(bulle).toContainText('représente 84 % du loyer (980 €)');
  const boite = await bulle.boundingBox();
  const largeur = page.viewportSize()?.width ?? 0;
  expect(boite).not.toBeNull();
  if (boite !== null) {
    expect(boite.x).toBeGreaterThanOrEqual(0);
    expect(boite.x + boite.width).toBeLessThanOrEqual(largeur + 1);
  }

  await page.keyboard.press('Escape');
  await expect(bulle).toBeHidden();

  // Une seule bulle à la fois : la suivante ferme la précédente.
  await page.getByRole('button', { name: 'Explication : Rendement brut' }).click();
  await expect(page.getByRole('tooltip')).toHaveCount(1);
  await expect(page.getByRole('tooltip')).toContainText('11 760 €');
  await page.getByRole('heading', { level: 1 }).click();
  await expect(page.getByRole('tooltip')).toHaveCount(0);

  await page.getByRole('link', { name: 'Voir la fiscalité' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: /Combien d'impôts, selon le régime/ }),
  ).toBeVisible();
  await page.goBack();
  await page.getByRole('link', { name: 'Voir la revente' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: "Qu'est-ce qu'il vous restera ?" }),
  ).toBeVisible();
  await page.goBack();
  await page.getByRole('link', { name: "Voir l'estimation" }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Combien vaut ce bien/ })).toBeVisible();
});
