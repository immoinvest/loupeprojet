import { expect, test, type Page } from '@playwright/test';

import {
  NOM_EXEMPLE,
  ouvrirExemple,
  ouvrirGroupe,
  ouvrirMesProjets,
  ouvrirNavigation,
  ouvrirVolet,
} from './aides';

/*
 * Coque fixe : la fenêtre ne défile jamais, seul le contenu (`main`) défile ; le menu et l'en-tête
 * du projet restent en vue. Les mêmes parcours tournent sur ordinateur, téléphone et tablette.
 */

/** Largeur à partir de laquelle tout l'en-tête du projet reste collé (point de rupture `md`). */
const LARGEUR_EN_TETE_ENTIER = 768;

/** Défile le contenu jusqu'en bas et attend qu'il ait bougé. */
async function defilerEnBas(page: Page): Promise<void> {
  const contenu = page.getByRole('main');
  await contenu.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect.poll(() => contenu.evaluate((el) => el.scrollTop)).toBeGreaterThan(300);
}

function defilementDuContenu(page: Page): Promise<number> {
  return page.getByRole('main').evaluate((el) => el.scrollTop);
}

function defilementDeLaFenetre(page: Page): Promise<number> {
  return page.evaluate(() => window.scrollY);
}

test('menu et en-tête restent en vue quand le contenu défile ; changer de volet remet en haut', async ({
  page,
}) => {
  await ouvrirExemple(page);
  await ouvrirVolet(page, 'Hypothèses', 'Vos hypothèses');
  await defilerEnBas(page);
  expect(await defilementDeLaFenetre(page)).toBe(0);

  // La bande des volets est collée, la synthèse juste dessous, sans la recouvrir.
  const volets = page.getByRole('navigation', { name: 'Volets du rapport' });
  await expect(volets).toBeInViewport({ ratio: 1 });
  const synthese = page.getByText('Cash-flow', { exact: true }).locator('..');
  await expect(synthese).toBeInViewport({ ratio: 1 });
  const [bande, resume] = await Promise.all([volets.boundingBox(), synthese.boundingBox()]);
  if (bande === null || resume === null) throw new Error('bande des volets ou synthèse sans boîte');
  expect(resume.y).toBeGreaterThanOrEqual(bande.y + bande.height - 1);

  // Le menu : barre latérale entière sur ordinateur, bouton de menu en dessous de 1 024 px.
  const boutonMenu = page.getByRole('button', { name: 'Ouvrir le menu' });
  if (await boutonMenu.isVisible()) {
    await expect(boutonMenu).toBeInViewport({ ratio: 1 });
  } else {
    const navigation = page.getByRole('navigation', { name: 'Analyser' });
    await expect(navigation.getByRole('link', { name: NOM_EXEMPLE })).toBeInViewport({ ratio: 1 });
    await expect(navigation.getByRole('link', { name: 'Nouveau projet' })).toBeInViewport({
      ratio: 1,
    });
    await expect(page.getByRole('link', { name: 'Extension navigateur' })).toBeInViewport({
      ratio: 1,
    });
    await expect(page.getByText('Gratuit · 1 projet')).toBeInViewport({ ratio: 1 });
  }

  // Sous 768 px, seule la bande reste collée : le nom et les actions ont défilé avec le contenu.
  const filDAriane = page.getByRole('link', { name: 'Mes projets', exact: true });
  const largeur = page.viewportSize()?.width ?? 0;
  if (largeur < LARGEUR_EN_TETE_ENTIER) {
    await expect(filDAriane).not.toBeInViewport();
  } else {
    await expect(filDAriane).toBeInViewport({ ratio: 1 });
    await expect(page.getByLabel('Statut du projet')).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: 'PDF' })).toBeInViewport({ ratio: 1 });
  }

  await ouvrirVolet(page, 'Fiscalité', /Combien d'impôts, selon le régime/);
  await expect.poll(() => defilementDuContenu(page)).toBe(0);
  expect(await defilementDeLaFenetre(page)).toBe(0);
});

test('formulaire Vérifier : les choix réservés aux lecteurs d’écran ne font pas défiler la fenêtre', async ({
  page,
}) => {
  await ouvrirMesProjets(page);
  await page.getByRole('main').getByRole('button', { name: 'Nouveau projet' }).click();
  await page.getByRole('button', { name: /je saisis à la main/ }).click();
  await expect(
    page.getByRole('button', { name: 'Créer le projet et voir le rapport' }),
  ).toBeVisible();
  // Le strict minimum tient presque sans défiler : on déplie les groupes pleins de tuiles et d'échelles.
  await ouvrirGroupe(page, /^Estimé pour vous/);
  await ouvrirGroupe(page, /^Préciser pour une analyse plus juste/);
  await expect(page.getByRole('radiogroup', { name: 'DPE' })).toBeVisible();

  // Le document tient dans la fenêtre : aucun élément ne dépasse de la coque.
  const depassement = await page.evaluate(
    () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
  );
  expect(depassement).toBeLessThanOrEqual(1);

  await defilerEnBas(page);
  expect(await defilementDeLaFenetre(page)).toBe(0);
});

test('trente projets : le menu en montre trois puis « Tous mes projets », le profil reste en bas', async ({
  page,
}) => {
  await ouvrirMesProjets(page);
  await page.evaluate(() => {
    const cle = 'loupe.projets.v1';
    const projets = JSON.parse(localStorage.getItem(cle) ?? '[]') as { id: string; nom: string }[];
    const exemple = projets[0];
    if (exemple === undefined) throw new Error("Le projet d'exemple est absent.");
    const copies = Array.from({ length: 29 }, (_, i) => ({
      ...exemple,
      id: `copie-${String(i + 1)}`,
      nom: `Copie ${String(i + 1)} · T2 · Lyon 3e`,
    }));
    localStorage.setItem(cle, JSON.stringify([exemple, ...copies]));
  });
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Mes projets' })).toBeVisible();

  const navigation = await ouvrirNavigation(page);
  const profil = page.getByText('Gratuit · 30 projets');
  await expect(profil).toBeInViewport({ ratio: 1 });

  // Les trois plus récents seulement (l'exemple puis les copies 1 et 2), puis le lien vers la liste.
  const lien = (nom: string): ReturnType<Page['getByRole']> =>
    navigation.getByRole('link', { name: nom, exact: true });
  await expect(lien('Copie 2 · T2 · Lyon 3e')).toBeVisible();
  await expect(lien('Copie 3 · T2 · Lyon 3e')).toHaveCount(0);
  const tous = lien('Tous mes projets · 30');
  await tous.scrollIntoViewIfNeeded();
  await expect(tous).toBeInViewport({ ratio: 1 });
  // Le profil n'a pas bougé : seul le menu a défilé, à l'intérieur de sa zone.
  await expect(profil).toBeInViewport({ ratio: 1 });
  expect(await defilementDeLaFenetre(page)).toBe(0);
});
