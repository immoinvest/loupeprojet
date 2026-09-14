import { expect, test } from '@playwright/test';

import {
  FORMATS,
  LARGEUR_A4,
  LARGEUR_BARRE_LATERALE,
  TELEPHONE_ETROIT,
  ecransDeReference,
  mesurer,
  ouvrirContexte,
  preparerDonnees,
} from './formats';

/*
 * Preuve continue du responsive : chaque format ouvre son propre contexte (taille, écran tactile).
 * En cas d'échec, le message nomme l'écran, le format et les éléments fautifs.
 */

for (const format of FORMATS) {
  test(`${format.nom} px : chaque écran tient dans la largeur`, async ({ browser }) => {
    test.setTimeout(240_000);
    const contexte = await ouvrirContexte(browser, format);
    const page = await contexte.newPage();
    const donnees = await preparerDonnees(page);

    for (const ecran of ecransDeReference(donnees)) {
      if (ecran.avant !== undefined) await ecran.avant(page);
      await page.goto(ecran.chemin);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      if (ecran.ouvrir !== undefined) await ecran.ouvrir(page);
      const mesure = await mesurer(page);
      const ou = `${ecran.nom}, ${format.nom} px`;

      expect
        .soft(mesure.debordement, `débordement (${ou}) : ${mesure.quiDebordent.join(' ; ')}`)
        .toBe(0);
      if (format.tactile) {
        expect.soft(mesure.ciblesTropPetites, `cibles de moins de 44 px (${ou})`).toEqual([]);
        expect.soft(mesure.champsTropPetits, `champs sous 16 px (${ou})`).toEqual([]);
      }
    }
    await contexte.close();
  });
}

test('menu : tiroir sous 1 024 px, barre latérale au-delà', async ({ browser }) => {
  test.setTimeout(120_000);
  for (const format of FORMATS) {
    const contexte = await ouvrirContexte(browser, format);
    const page = await contexte.newPage();
    await page.goto('/projets');
    await expect(page.getByRole('heading', { level: 1, name: 'Mes projets' })).toBeVisible();
    const bouton = page.getByRole('button', { name: 'Ouvrir le menu' });
    const navigation = page.getByRole('navigation', { name: 'Analyser' });

    if (format.largeur >= LARGEUR_BARRE_LATERALE) {
      await expect(bouton, format.nom).toBeHidden();
      await expect(navigation, format.nom).toBeVisible();
    } else {
      await expect(bouton, format.nom).toBeVisible();
      await expect(navigation, format.nom).toBeHidden();
      await bouton.click();
      await expect(bouton, format.nom).toHaveAttribute('aria-expanded', 'true');
      await navigation.getByRole('link', { name: 'Comparer' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Comparer' })).toBeVisible();
      await expect(navigation, format.nom).toBeHidden();
      await expect(bouton, format.nom).toHaveAttribute('aria-expanded', 'false');
    }
    await contexte.close();
  }
});

test('téléphone 320 px : un volet ouvert directement a son onglet visible', async ({ browser }) => {
  const contexte = await ouvrirContexte(browser, TELEPHONE_ETROIT);
  const page = await contexte.newPage();
  const { id } = await preparerDonnees(page);
  await page.goto(`/projets/${id}/visite`);

  const bande = page.getByRole('navigation', { name: 'Volets du rapport' });
  const onglet = bande.getByRole('link', { name: 'Visite', exact: true });
  await expect(onglet).toHaveAttribute('aria-current', 'page');
  await expect
    .poll(async () => {
      const [cadre, boite] = await Promise.all([bande.boundingBox(), onglet.boundingBox()]);
      if (cadre === null || boite === null) return false;
      return boite.x >= cadre.x - 1 && boite.x + boite.width <= cadre.x + cadre.width + 1;
    })
    .toBe(true);
  await contexte.close();
});

test("impression : sur une page A4, le document garde la mise en page d'ordinateur", async ({
  browser,
}) => {
  const contexte = await browser.newContext({
    viewport: { width: LARGEUR_A4, height: 1000 },
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  });
  const page = await contexte.newPage();
  const { id } = await preparerDonnees(page);
  await page.emulateMedia({ media: 'print' });
  await page.goto(`/projets/${id}/imprimer`);
  await expect(page.getByText(/dossier d'analyse locative/)).toBeVisible();

  const miseEnPage = await page.evaluate(() => {
    const volets = [...document.querySelectorAll('.document article')];
    const [rapport, financement, fiscalite, revente] = volets;
    const colonnes = (volet: Element | undefined): number[] =>
      [...(volet?.querySelectorAll('.grid') ?? [])].map(
        (grille) => getComputedStyle(grille).gridTemplateColumns.split(' ').length,
      );
    const style = (el: Element | null | undefined): CSSStyleDeclaration | null =>
      el === null || el === undefined ? null : getComputedStyle(el);
    const leviers = [...(rapport?.querySelectorAll('section') ?? [])].find((section) =>
      section.textContent.includes('Levier 1'),
    );
    const titre = rapport?.querySelector('h1');
    return {
      volets: volets.length,
      grillesRapport: colonnes(rapport),
      grillesFinancement: colonnes(financement),
      grillesFiscalite: colonnes(fiscalite),
      grillesRevente: colonnes(revente),
      leviers: style(leviers)?.flexDirection ?? null,
      titre: style(titre)?.fontSize ?? null,
      marge: style(titre?.parentElement?.parentElement)?.paddingLeft ?? null,
      enTete: style(document.querySelector('.document header'))?.flexDirection ?? null,
      barre: style(document.querySelector('.no-print'))?.display ?? null,
    };
  });

  expect(miseEnPage).toMatchObject({
    volets: 5,
    leviers: 'row',
    titre: '40px',
    marge: '40px',
    enTete: 'row',
    barre: 'none',
  });
  // Rapport, dans l'ordre du document : cascade et repères côte à côte (2), repères empilés (1),
  // Prix et Rendements (2), brut · net · net-net (3), Impôts et Revente (2).
  expect(miseEnPage.grillesRapport).toEqual([2, 1, 2, 3, 2]);
  // Financement sur papier : le prêt en lignes, puis les deux rangées de cartes, toutes à deux colonnes.
  expect(miseEnPage.grillesFinancement).toEqual([2, 2, 2]);
  expect(miseEnPage.grillesFiscalite[0]).toBe(2);
  expect(miseEnPage.grillesRevente.slice(0, 2)).toEqual([2, 2]);
  await contexte.close();
});
