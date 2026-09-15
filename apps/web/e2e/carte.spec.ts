import { expect, test, type Locator, type Page } from '@playwright/test';

import { preparerDonnees } from './formats';
import { HOTE_TUILES_IGN, simulerWorker } from './reponses-worker';

/*
 * La carte des ventes de l'onglet Estimation, avec la vraie bibliothèque Leaflet : tuiles IGN interceptées (jamais
 * demandées au vrai service), pastilles et groupe au même point, bulle d'une vente, liaison avec le tableau, cercles
 * qui filtrent, fonds, gestes qui ne piègent pas la page, plein écran, absente à l'impression.
 */

interface Ouverture {
  readonly carte: Locator;
  readonly region: Locator;
  readonly conteneur: Locator;
  readonly tableau: Locator;
  readonly tuiles: string[];
}

async function ouvrir(page: Page): Promise<Ouverture> {
  const tuiles: string[] = [];
  page.on('request', (requete) => {
    const url = new URL(requete.url());
    if (url.hostname === HOTE_TUILES_IGN) tuiles.push(url.search);
  });
  const { idAvecAdresse } = await preparerDonnees(page);
  await simulerWorker(page);
  await page.goto(`/projets/${idAvecAdresse}/adresse`);
  const carte = page.locator('section', {
    has: page.getByRole('heading', { level: 2, name: 'Les ventes autour du bien' }),
  });
  const conteneur = carte.locator('.leaflet-container');
  await expect(conteneur).toBeVisible();
  const tableau = page.locator('section', {
    has: page.getByRole('heading', { level: 2, name: 'Les ventes comparables les plus proches' }),
  });
  return {
    carte,
    region: carte.getByRole('region', { name: /^Carte des ventes comparables/ }),
    conteneur,
    tableau,
    tuiles,
  };
}

/** Largeur du plus grand cercle dessiné : elle grandit quand la carte zoome. */
function largeurCercle(conteneur: Locator): Promise<number> {
  return conteneur.evaluate((el) =>
    Math.max(
      ...[...el.querySelectorAll('path.carte-cercle')].map((p) => p.getBoundingClientRect().width),
    ),
  );
}

function defilementPage(page: Page): Promise<number> {
  return page.locator('main').evaluate((el) => el.scrollTop);
}

test('la carte des ventes : pastilles, groupe, bulle, tableau lié, cercles, fonds, pas d’impression', async ({
  page,
}) => {
  const { carte, region, conteneur, tableau, tuiles } = await ouvrir(page);

  await expect(region).toHaveAccessibleName(/: 24 points\.$/);
  // 24 ventes : 21 pastilles et un groupe de trois ventes du même immeuble ; trois cercles (tracé et cible), le bien.
  await expect(carte.locator('path.carte-vente')).toHaveCount(21);
  await expect(carte.locator('.carte-groupe')).toHaveText('3');
  await expect(carte.locator('path.carte-cercle')).toHaveCount(3);
  await expect(carte.locator('path.carte-cercle-cible')).toHaveCount(3);
  await expect(carte.locator('path.carte-bien')).toHaveCount(1);
  await expect(carte.locator('path.carte-vente-bas').first()).toBeAttached();
  await expect(carte.locator('path.carte-vente-haut').first()).toBeAttached();

  await expect.poll(() => tuiles.length).toBeGreaterThan(0);
  expect(tuiles.every((r) => r.includes('LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2'))).toBe(true);
  await expect(carte.getByText(/Plan IGN \(Géoplateforme\)/).first()).toBeVisible();

  // La carte reste sous l'en-tête collé.
  expect(await conteneur.evaluate((el) => getComputedStyle(el).isolation)).toBe('isolate');

  // Cadrage : le cercle de 300 m remplit la carte (au zoom entier inférieur, il n'en couvrait que 45 %).
  const cote = await conteneur.evaluate((el) => Math.min(el.clientWidth, el.clientHeight));
  const plusGrand = await largeurCercle(conteneur);
  expect(plusGrand / cote).toBeGreaterThan(0.7);
  expect(plusGrand).toBeLessThanOrEqual(cote);

  // Le groupe s'ouvre en éventail.
  await carte.locator('.carte-groupe').dispatchEvent('click');
  await expect(carte.locator('path.carte-vente')).toHaveCount(24);

  // Une pastille ouvre la fiche de la vente.
  await carte.locator('path.carte-vente').nth(10).dispatchEvent('click');
  const bulle = page.locator('.leaflet-popup');
  await expect(bulle).toContainText('Vente du');
  await expect(bulle).toContainText('Au prix d’aujourd’hui');
  await expect(bulle.getByRole('button', { name: 'Fermer la fiche de la vente' })).toBeAttached();
  await expect(carte.locator('path.carte-vente-selectionnee')).toHaveCount(1);

  // « Voir dans le tableau » : la ligne est mise en avant et à l'écran.
  await bulle.getByRole('button', { name: 'Voir dans le tableau' }).click();
  const ligne = tableau.locator('tr[aria-current="true"]');
  await expect(ligne).toHaveCount(1);
  await expect(ligne).toBeInViewport();

  // « Sur la carte » depuis une autre ligne : la carte revient, centrée sur cette vente, sa fiche ouverte.
  await tableau
    .getByRole('button', { name: /^Sur la carte/ })
    .nth(4)
    .click();
  await expect(bulle).toBeVisible();
  await expect(conteneur).toBeInViewport();
  await expect(tableau.locator('tr[aria-current="true"]')).toHaveCount(1);

  // Le cercle de 100 m filtre le tableau (et les pastilles).
  await carte.locator('path.carte-cercle-cible').first().dispatchEvent('click');
  await expect(tableau.getByRole('button', { name: 'À moins de 100 m' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(region).toHaveAccessibleName(/: 7 points\.$/);
  await tableau.getByRole('button', { name: 'À moins de 100 m' }).click();
  await expect(region).toHaveAccessibleName(/: 24 points\.$/);

  // Couleur par DPE : les ventes sans DPE rapproché sont « inconnues ».
  await carte.locator('label', { hasText: /^DPE$/ }).click();
  await expect(carte.getByText('DPE inconnu')).toBeVisible();
  await expect(carte.locator('path.carte-vente-inconnu').first()).toBeAttached();

  // Photo aérienne, puis parcelles cadastrales par-dessus.
  await carte.locator('label', { hasText: 'Photo aérienne' }).click();
  await expect.poll(() => tuiles.some((r) => r.includes('ORTHOIMAGERY.ORTHOPHOTOS'))).toBe(true);
  await carte.getByRole('checkbox', { name: 'Parcelles cadastrales' }).check();
  await expect
    .poll(() => tuiles.some((r) => r.includes('CADASTRALPARCELS.PARCELLAIRE_EXPRESS')))
    .toBe(true);

  await page.emulateMedia({ media: 'print' });
  await expect(carte).toBeHidden();
  await expect(tableau).toBeVisible();
});

test('ordinateur : la molette sans Ctrl fait défiler la page, Ctrl + molette zoome ; plein écran fermé par Échap', async ({
  page,
}, infos) => {
  test.skip(infos.project.name !== 'ordinateur', 'gestes à la souris');
  const { carte, conteneur } = await ouvrir(page);
  await conteneur.scrollIntoViewIfNeeded();
  const survoler = async (): Promise<void> => {
    const boite = await conteneur.boundingBox();
    if (boite === null) throw new Error('carte sans taille');
    await page.mouse.move(boite.x + boite.width / 2, boite.y + boite.height / 2);
  };

  await survoler();
  const avant = await largeurCercle(conteneur);
  const haut = await defilementPage(page);
  await page.mouse.wheel(0, 200);
  await expect(carte.getByText('Ctrl + molette pour zoomer')).toBeVisible();
  await expect.poll(() => defilementPage(page)).toBeGreaterThan(haut);
  expect(await largeurCercle(conteneur)).toBeCloseTo(avant, 0);

  await conteneur.scrollIntoViewIfNeeded();
  await survoler();
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -300);
  await page.keyboard.up('Control');
  await expect.poll(() => largeurCercle(conteneur)).toBeGreaterThan(avant * 1.2);

  // Plein écran : la carte couvre la fenêtre, par-dessus la coque.
  await carte.getByRole('button', { name: 'Plein écran' }).click();
  const fermer = carte.getByRole('button', { name: 'Fermer la carte' });
  await expect(fermer).toBeFocused();
  const cadre = await carte.getByRole('region').evaluate((region) => {
    const rect = region.parentElement?.getBoundingClientRect();
    const coin = document.elementFromPoint(8, 8);
    return {
      taille: [rect?.width, rect?.height],
      fenetre: [window.innerWidth, window.innerHeight],
      dessus: coin !== null && region.parentElement?.contains(coin) === true,
    };
  });
  expect(cadre.taille).toEqual(cadre.fenetre);
  expect(cadre.dessus).toBe(true);
  await page.keyboard.press('Escape');
  await expect(carte.getByRole('button', { name: 'Plein écran' })).toBeVisible();
});

test('téléphone : un doigt fait défiler la page, pas la carte', async ({ page }, infos) => {
  test.skip(infos.project.name !== 'telephone', 'geste au doigt');
  const { carte, conteneur } = await ouvrir(page);
  await conteneur.scrollIntoViewIfNeeded();
  // Hors plein écran, Leaflet laisse au navigateur le glisser à un doigt (deux doigts zooment la carte).
  expect(await conteneur.evaluate((el) => getComputedStyle(el).touchAction)).toBe('pan-x pan-y');
  const position = (): Promise<string> =>
    conteneur.locator('.leaflet-map-pane').evaluate((el) => (el as HTMLElement).style.transform);
  const cdp = await page.context().newCDPSession(page);
  // Un doigt posé, qui remonte de 160 px en dix pas, puis levé : le navigateur en tire le défilement.
  const glisser = async (x: number, y: number): Promise<void> => {
    const point = (dy: number): { x: number; y: number }[] => [
      { x: Math.round(x), y: Math.round(y - dy) },
    ];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(0) });
    for (let pas = 1; pas <= 10; pas += 1) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: point(pas * 16),
      });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const boiteLegende = await carte.getByRole('list', { name: 'Légende de la carte' }).boundingBox();
  if (boiteLegende === null) throw new Error('légende sans taille');
  // Témoin : le même geste sur la légende, juste au-dessus de la carte, fait défiler la page.
  const temoin = await defilementPage(page);
  await glisser(boiteLegende.x + boiteLegende.width / 2, boiteLegende.y + boiteLegende.height / 2);
  await expect.poll(() => defilementPage(page)).toBeGreaterThan(temoin);
  await conteneur.scrollIntoViewIfNeeded();
  const avant = await position();
  const haut = await defilementPage(page);
  const boite = await conteneur.boundingBox();
  if (boite === null) throw new Error('carte sans taille');
  // Sur la carte, dans un coin sans pastille.
  await glisser(boite.x + boite.width * 0.93, boite.y + boite.height * 0.15);
  await expect.poll(() => defilementPage(page)).toBeGreaterThan(haut);
  expect(await position()).toBe(avant);
  await expect(carte.getByText('Utilisez deux doigts pour déplacer la carte')).toBeVisible();

  // Le doigt posé sur une pastille (ici celle des trois ventes de l'immeuble) fait aussi défiler la page.
  await conteneur.scrollIntoViewIfNeeded();
  const avantPastille = await position();
  const hautPastille = await defilementPage(page);
  const pastille = await carte.locator('.carte-groupe').boundingBox();
  if (pastille === null) throw new Error('pastille sans taille');
  await glisser(pastille.x + pastille.width / 2, pastille.y + pastille.height / 2);
  await expect.poll(() => defilementPage(page)).toBeGreaterThan(hautPastille);
  expect(await position()).toBe(avantPastille);
});
