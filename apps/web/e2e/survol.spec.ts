import { expect, test, type Page } from '@playwright/test';

import { ouvrirExemple, ouvrirMesProjets } from './aides';

/*
 * Survol (.product/design/design-guidelines.md) : à la souris, tout ce qui se clique montre la main
 * et change d'apparence. Chaque écran passe ses éléments cliquables sous la souris et compare leur
 * style avant et après. Un élément sélectionné ou désactivé n'a pas de survol : il est écarté.
 */

// Transitions coupées : le style lu juste après le survol est le style final.
test.use({ reducedMotion: 'reduce' });
test.skip(({ isMobile }) => isMobile, "Le survol n'existe qu'à la souris.");

const CLIQUABLES =
  'a[href], button, summary, select, [role="button"], label:has(input[type="checkbox"]), label:has(input[type="radio"])';

const PROPRIETES = [
  'color',
  'background-color',
  'border-top-color',
  'border-bottom-color',
  'text-decoration-line',
  'text-decoration-thickness',
  'box-shadow',
] as const;

/**
 * Marque d'un attribut `data-survol` les éléments cliquables à vérifier dans `portee` : visibles,
 * ni sélectionnés ni désactivés, un seul par apparence (même balise, mêmes classes) pour que les
 * listes de 74 questions ne coûtent qu'un survol. Renvoie leur nombre.
 */
function marquerCliquables(page: Page, portee: string): Promise<number> {
  return page
    .locator(portee)
    .first()
    .evaluate((racine, selecteur) => {
      const vus = new Set<string>();
      let n = 0;
      for (const el of racine.querySelectorAll(selecteur)) {
        el.removeAttribute('data-survol');
        const boite = el.getBoundingClientRect();
        const visible =
          boite.width > 0 &&
          boite.height > 0 &&
          getComputedStyle(el).visibility !== 'hidden' &&
          el.closest('[inert]') === null;
        const ecarte = el.matches(
          '[aria-current="page"], [aria-pressed="true"], label:has(input:checked), :disabled, [aria-disabled="true"], label:has(input:disabled)',
        );
        const signature = `${el.tagName}|${el.className}`;
        if (!visible || ecarte || el.closest('.leaflet-container') !== null || vus.has(signature)) {
          continue;
        }
        vus.add(signature);
        el.setAttribute('data-survol', String(n));
        n += 1;
      }
      return n;
    }, CLIQUABLES);
}

/** Passe chaque élément cliquable de l'écran sous la souris ; liste ceux sans main ou sans survol. */
async function verifierSurvol(page: Page, ecran: string, portee = 'main'): Promise<void> {
  const repos = page.getByRole('heading', { level: 1 }).first();
  await expect(repos).toBeVisible();
  const nombre = await marquerCliquables(page, portee);
  expect(nombre, `${ecran} : aucun élément cliquable trouvé`).toBeGreaterThan(0);

  const fautes: string[] = [];
  for (let i = 0; i < nombre; i += 1) {
    const element = page.locator(`[data-survol="${String(i)}"]`);
    const { nom, curseur, curseurAttendu } = await element.evaluate((el) => ({
      nom: `<${el.tagName.toLowerCase()}> « ${(el.getAttribute('aria-label') ?? el.textContent).trim().slice(0, 40)} »`,
      curseur: getComputedStyle(el).cursor,
      curseurAttendu: el.hasAttribute('draggable') ? 'grab' : 'pointer',
    }));
    if (curseur !== curseurAttendu) fautes.push(`${nom} : curseur « ${curseur} »`);

    // La souris se pose d'abord sur le titre de la page, qui ne se clique pas.
    await repos.hover();
    const lire = (): Promise<string> =>
      element.evaluate(
        (el, proprietes) => {
          const style = getComputedStyle(el);
          return proprietes.map((p) => style.getPropertyValue(p)).join(' | ');
        },
        [...PROPRIETES],
      );
    const avant = await lire();
    await element.hover();
    if ((await lire()) === avant) fautes.push(`${nom} : aucun effet de survol`);
  }
  expect(fautes, `${ecran} : éléments cliquables sans main ou sans survol`).toEqual([]);
}

test('accueil, menu et profil', async ({ page }) => {
  await page.goto('/');
  await verifierSurvol(page, 'Accueil', 'body');
});

test('mes projets', async ({ page }) => {
  await ouvrirMesProjets(page);
  await verifierSurvol(page, 'Mes projets');
});

const VOLETS = [
  ['Rapport', ''],
  ['Estimation', '/adresse'],
  ['Financement', '/financement'],
  ['Hypothèses', '/hypotheses'],
  ['Fiscalité', '/fiscalite'],
  ['Revente', '/revente'],
  ['Visite', '/visite'],
] as const;

for (const [volet, chemin] of VOLETS) {
  test(`projet, volet ${volet}`, async ({ page }) => {
    await ouvrirExemple(page);
    if (chemin !== '') await page.goto(`${new URL(page.url()).pathname}${chemin}`);
    await verifierSurvol(page, volet);
  });
}

test('nouveau projet, saisie à la main', async ({ page }) => {
  await ouvrirMesProjets(page);
  await page.getByRole('main').getByRole('button', { name: 'Nouveau projet' }).click();
  await verifierSurvol(page, 'Nouveau projet');
  await page.getByRole('button', { name: /je saisis à la main/ }).click();
  await expect(
    page.getByRole('button', { name: 'Créer le projet et voir le rapport' }),
  ).toBeVisible();
  await verifierSurvol(page, 'Formulaire Vérifier');
});

for (const [ecran, adresse] of [
  ['Simulateur de prêt', '/simulateur-pret'],
  ['Extension', '/extension'],
  ['Gérer sans compte', '/gerer'],
  ['Connexion', '/connexion'],
] as const) {
  test(ecran, async ({ page }) => {
    await page.goto(adresse);
    await verifierSurvol(page, ecran);
  });
}
