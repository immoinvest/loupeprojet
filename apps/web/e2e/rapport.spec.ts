import { expect, test } from '@playwright/test';

import { carte, ouvrirExemple } from './aides';

test('le rapport affiche le verdict, les cinq feux et les chiffres clés', async ({ page }) => {
  await ouvrirExemple(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Le prix est bon. Le loyer ne couvre pas tout.',
  );
  await expect(
    page.getByText(
      '−25 % par rapport au prix estimé, le crédit prend 84 % du loyer, 210 € à sortir chaque mois.',
    ),
  ).toBeVisible();

  const feux = page.getByLabel('Cinq feux');
  await expect(feux.getByText(/Prix|Rendement net|Cash-flow|Crédit|Risques/)).toHaveText([
    'Prix −25 %',
    'Rendement net 4,3 %',
    'Cash-flow −210 €/mois',
    'Crédit 84 % du loyer',
    'Risques : aucun',
  ]);

  await expect(carte(page, "Est-ce que c'est cher ?")).toContainText('Non.');
  await expect(carte(page, "Est-ce que c'est cher ?")).toContainText('31 ventes réelles');

  const autofinancement = carte(page, "Est-ce que ça s'autofinance ?");
  await expect(autofinancement).toContainText('Non.');
  await expect(autofinancement).toContainText(/Reste chaque mois\s*−210\s€/);
  await expect(autofinancement).toContainText("À l'équilibre avec un loyer de 1 203 €");

  await expect(page.getByText('Levier 1 · Négocier').locator('..')).toContainText('119 663 €');

  await expect(carte(page, "Combien d'impôts ?")).toContainText(/0\s€\s*sur 10 ans/);
  await expect(carte(page, "Combien d'impôts ?")).toContainText(
    'Meublé au réel : aucun impôt sur la période.',
  );

  await expect(carte(page, "Qu'est-ce qu'il vous restera ?")).toContainText(
    /58\s217\s€\s*dans 10 ans/,
  );
  await expect(page.getByText(/Outil d'aide à la décision, pas un conseil/)).toBeVisible();
});
