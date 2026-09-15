import { expect, test, type Page } from '@playwright/test';

import { NOM_EXEMPLE, ouvrirExemple, ouvrirMesProjets } from './aides';

/**
 * Liens de partage courts et transfert des projets (fiche 23). `vite preview` ne sert pas l'API des
 * comptes : `/api/partage` est simulée par une mémoire partagée entre les contextes du test, aux
 * règles de l'API (création 201, lecture 200, 404 sinon).
 */

interface Lien {
  readonly contenu: string;
}

async function simulerPartage(page: Page, liens: Map<string, Lien>): Promise<void> {
  await page.route('**/api/partage**', async (route) => {
    const requete = route.request();
    const chemin = new URL(requete.url()).pathname;
    if (requete.method() === 'POST' && chemin === '/api/partage') {
      const id = `e2e${String(liens.size + 1).padStart(5, '0')}`;
      const corps = requete.postDataJSON() as { projet: unknown };
      liens.set(id, { contenu: JSON.stringify(corps.projet) });
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id, jeton: `jeton-${id}`, expireLe: '2026-12-14T10:00:00.000Z' }),
      });
      return;
    }
    const lien = liens.get(chemin.replace('/api/partage/', ''));
    await route.fulfill(
      lien === undefined
        ? { status: 404, contentType: 'application/json', body: '{"code":"INTROUVABLE"}' }
        : {
            status: 200,
            contentType: 'application/json',
            body: `{"projet":${lien.contenu},"expireLe":"2026-12-14T10:00:00.000Z"}`,
          },
    );
  });
}

test('partager crée un lien court, qui s’ouvre dans un navigateur neuf', async ({
  page,
  browser,
}) => {
  const liens = new Map<string, Lien>();
  await simulerPartage(page, liens);
  await ouvrirExemple(page);
  await page.getByRole('button', { name: 'Partager' }).click();
  const champ = page.getByLabel('Lien de partage');
  await expect(champ).toHaveValue(/\/p\/e2e00001$/);
  const lien = await champ.inputValue();

  const autre = await browser.newContext();
  const nouvelle = await autre.newPage();
  await simulerPartage(nouvelle, liens);
  await nouvelle.goto(new URL(lien).pathname);
  await expect(nouvelle.getByText('Projet partagé')).toBeVisible();
  await nouvelle.getByRole('button', { name: 'Ajouter à mes projets' }).click();
  await expect(nouvelle.getByRole('navigation', { name: 'Volets du rapport' })).toBeVisible();
  await autre.close();
});

test('sans API de partage, le lien long compressé fonctionne', async ({ page, browser }) => {
  await ouvrirExemple(page);
  await page.getByRole('button', { name: 'Partager' }).click();
  const champ = page.getByLabel('Lien de partage');
  await expect(champ).toHaveValue(/\/partage#z=/);
  const lien = await champ.inputValue();

  const autre = await browser.newContext();
  const nouvelle = await autre.newPage();
  await nouvelle.goto(new URL(lien).pathname + new URL(lien).hash);
  await expect(nouvelle.getByText('Projet partagé')).toBeVisible();
  await autre.close();
});

test('un lien court inconnu est expliqué', async ({ page }) => {
  await simulerPartage(page, new Map());
  await page.goto('/p/ZZZZZZZZ');
  await expect(page.getByText(/Ce lien a expiré/)).toBeVisible();
});

test('les projets arrivés par /transfert s’ajoutent à ceux de l’appareil', async ({
  page,
  browser,
}) => {
  // L'ancienne adresse : un projet renommé à emporter, compressé comme le fait l'application.
  await ouvrirMesProjets(page);
  const hash = await page.evaluate(async (nomExemple) => {
    const projets = JSON.parse(localStorage.getItem('loupe.projets.v1') ?? '[]') as {
      id: string;
      nom: string;
      modifieLe: string;
    }[];
    const exemple = projets.find((p) => p.nom === nomExemple);
    if (exemple === undefined) throw new Error("Le projet d'exemple est absent.");
    const emporte = {
      ...exemple,
      id: 'transfere',
      nom: 'Transféré · T3',
      modifieLe: new Date().toISOString(),
    };
    const octets = new TextEncoder().encode(JSON.stringify({ version: 1, projets: [emporte] }));
    const flux = new Blob([octets]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const compresse = new Uint8Array(await new Response(flux).arrayBuffer());
    let binaire = '';
    for (const octet of compresse) binaire += String.fromCharCode(octet);
    return `#d=${btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
  }, NOM_EXEMPLE);

  const autre = await browser.newContext();
  const nouvelle = await autre.newPage();
  await nouvelle.goto(`/transfert${hash}`);
  await expect(
    nouvelle.getByText('1 projet récupéré depuis l’ancienne adresse de Deklic.'),
  ).toBeVisible();
  await expect(nouvelle).toHaveURL(/\/transfert$/);
  await nouvelle.getByRole('link', { name: 'Voir mes projets' }).click();
  await expect(
    nouvelle.getByRole('main').getByRole('link', { name: 'Transféré · T3' }),
  ).toBeVisible();
  await autre.close();
});
