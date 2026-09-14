import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

import { ADRESSE_SIMULEE, simulerWorker } from './reponses-worker';

/** Un format d'écran de la spec (largeur × hauteur, en px CSS). */
export interface Format {
  readonly nom: string;
  readonly largeur: number;
  readonly hauteur: number;
  /** Écran tactile : pointeur grossier, cibles de 44 px et champs de 16 px exigés. */
  readonly tactile: boolean;
}

/** Le plus étroit des téléphones de la spec. */
export const TELEPHONE_ETROIT: Format = {
  nom: 'téléphone 320',
  largeur: 320,
  hauteur: 568,
  tactile: true,
};

/** Téléphones, tablettes (portrait puis paysage) et ordinateurs. */
export const FORMATS: readonly Format[] = [
  TELEPHONE_ETROIT,
  { nom: 'téléphone 375', largeur: 375, hauteur: 667, tactile: true },
  { nom: 'téléphone 390', largeur: 390, hauteur: 844, tactile: true },
  { nom: 'téléphone 412', largeur: 412, hauteur: 915, tactile: true },
  { nom: 'tablette 768', largeur: 768, hauteur: 1024, tactile: true },
  { nom: 'tablette 1024', largeur: 1024, hauteur: 768, tactile: true },
  { nom: 'ordinateur 1280', largeur: 1280, hauteur: 800, tactile: false },
  { nom: 'ordinateur 1440', largeur: 1440, hauteur: 900, tactile: false },
  { nom: 'ordinateur 1920', largeur: 1920, hauteur: 1080, tactile: false },
];

/** Largeur à partir de laquelle la barre latérale est toujours visible (point de rupture `lg`). */
export const LARGEUR_BARRE_LATERALE = 1024;

/** Largeur utile d'une page A4 imprimée : 210 mm moins deux marges de 12 mm, en px CSS. */
export const LARGEUR_A4 = 703;

const CIBLE_MIN_PX = 44;
const POLICE_MIN_PX = 16;

export function ouvrirContexte(browser: Browser, format: Format): Promise<BrowserContext> {
  return browser.newContext({
    viewport: { width: format.largeur, height: format.hauteur },
    isMobile: format.tactile,
    hasTouch: format.tactile,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    // Mesures de mise en page : les requêtes simulées de l'API ne doivent pas passer par le cache.
    serviceWorkers: 'block',
  });
}

export interface DonneesDeTest {
  readonly id: string;
  /** La copie du projet d'exemple, avec une adresse. */
  readonly idAvecAdresse: string;
  readonly lienPartage: string;
}

/**
 * Ouvre Deklic (le projet d'exemple est créé au premier lancement), ajoute une copie pour que
 * Comparer ait deux projets (la copie a une adresse, pour l'onglet Estimation), et fabrique le lien
 * de partage du projet d'exemple.
 */
export async function preparerDonnees(page: Page): Promise<DonneesDeTest> {
  await page.goto('/projets');
  await expect(page.getByRole('heading', { level: 1, name: 'Mes projets' })).toBeVisible();
  return page.evaluate((adresse) => {
    const cle = 'loupe.projets.v1';
    const projets = JSON.parse(localStorage.getItem(cle) ?? '[]') as { id: string; nom: string }[];
    const exemple = projets[0];
    if (exemple === undefined) throw new Error("Le projet d'exemple est absent.");
    const copie = { ...exemple, id: 'copie-formats', nom: 'Copie · T3 · Marseille', adresse };
    localStorage.setItem(cle, JSON.stringify([exemple, copie]));
    // Même encodage que stockage/partage.ts : base64url du JSON UTF-8 du projet enregistré.
    const octets = new TextEncoder().encode(JSON.stringify(exemple));
    let binaire = '';
    for (const octet of octets) binaire += String.fromCharCode(octet);
    const encode = btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return { id: exemple.id, idAvecAdresse: copie.id, lienPartage: `/partage#p=${encode}` };
  }, ADRESSE_SIMULEE);
}

/** Tous les moyens de connexion proposés : la page Connexion montre chacun de ses boutons. */
async function simulerFournisseurs(page: Page): Promise<void> {
  await page.route('**/api/comptes/fournisseurs', (route) =>
    route.fulfill({ json: { email: true, google: true, apple: true } }),
  );
}

/** Une personne connectée, liée à Google : la page Mon compte s'affiche en entier. */
async function simulerSession(page: Page): Promise<void> {
  await page.route('**/api/auth/get-session', (route) =>
    route.fulfill({
      json: {
        user: {
          id: 'camille',
          name: 'Camille Martin',
          email: 'camille.martin@exemple.fr',
          image: null,
        },
      },
    }),
  );
  await page.route('**/api/auth/list-accounts', (route) =>
    route.fulfill({ json: [{ providerId: 'google' }] }),
  );
}

export interface Ecran {
  readonly nom: string;
  readonly chemin: string;
  /** Préparation avant le chargement (réponses simulées du Worker ou de l'API des comptes). */
  readonly avant?: (page: Page) => Promise<void>;
  /** Geste qui mène à l'écran une fois le chemin chargé. */
  readonly ouvrir?: (page: Page) => Promise<void>;
}

/** Les écrans de référence ; la session simulée de « Mon compte » reste active : il vient en dernier. */
export function ecransDeReference({
  id,
  idAvecAdresse,
  lienPartage,
}: DonneesDeTest): readonly Ecran[] {
  const projet = `/projets/${id}`;
  return [
    { nom: 'Mes projets', chemin: '/projets' },
    { nom: 'Nouveau projet', chemin: '/projets/nouveau' },
    {
      nom: 'Vérifier (saisie à la main)',
      chemin: '/projets/nouveau',
      ouvrir: async (page) => {
        await page.getByRole('button', { name: /je saisis à la main/ }).click();
        await expect(
          page.getByRole('button', { name: 'Créer le projet et voir le rapport' }),
        ).toBeVisible();
      },
    },
    { nom: 'Rapport', chemin: projet },
    {
      nom: 'Estimation',
      chemin: `/projets/${idAvecAdresse}/adresse`,
      avant: simulerWorker,
      // Les cartes DPE, loyer et risques arrivent avec les réponses du Worker simulé.
      ouvrir: async (page) => {
        await expect(
          page.getByRole('heading', { level: 2, name: 'Le DPE du logement' }),
        ).toBeVisible();
      },
    },
    { nom: 'Hypothèses', chemin: `${projet}/hypotheses` },
    { nom: 'Fiscalité', chemin: `${projet}/fiscalite` },
    { nom: 'Revente', chemin: `${projet}/revente` },
    { nom: 'Visite', chemin: `${projet}/visite` },
    { nom: 'Comparer', chemin: '/comparer' },
    { nom: 'Méthode', chemin: '/methode' },
    { nom: 'Extension', chemin: '/extension' },
    { nom: 'Projet partagé', chemin: lienPartage },
    { nom: "Aperçu d'impression", chemin: `${projet}/imprimer` },
    { nom: 'Connexion', chemin: '/connexion', avant: simulerFournisseurs },
    { nom: 'Mon compte', chemin: '/compte', avant: simulerSession },
  ];
}

export interface Mesure {
  /** `scrollWidth − clientWidth` de la page : 0 attendu. */
  readonly debordement: number;
  readonly quiDebordent: readonly string[];
  readonly ciblesTropPetites: readonly string[];
  readonly champsTropPetits: readonly string[];
}

/**
 * Mesure l'écran affiché. Cible effective : l'élément, ou le `label` qui l'entoure ; les liens au
 * fil d'une phrase sont exemptés. Un élément qui déborde dans un conteneur qui défile ne compte pas.
 */
export function mesurer(page: Page): Promise<Mesure> {
  return page.evaluate(
    ({ cibleMin, policeMin }) => {
      const largeur = document.documentElement.clientWidth;
      const decrire = (el: Element): string => {
        const libelle = el.getAttribute('aria-label') ?? el.textContent;
        const texte = libelle.replace(/\s+/g, ' ').trim().slice(0, 40);
        const r = el.getBoundingClientRect();
        const taille = `${String(Math.round(r.width))}×${String(Math.round(r.height))}`;
        return `${el.tagName.toLowerCase()} « ${texte} » ${taille}, bord droit ${String(Math.round(r.right))} px`;
      };
      const dansUnDefilement = (el: Element): boolean => {
        for (let p = el.parentElement; p !== null && p !== document.body; p = p.parentElement) {
          const coupe = getComputedStyle(p).overflowX !== 'visible';
          if (coupe && p.getBoundingClientRect().right <= largeur + 1) return true;
        }
        return false;
      };
      const deborde = (el: Element): boolean =>
        el.getBoundingClientRect().right > largeur + 1 && !dansUnDefilement(el);
      // On nomme le premier élément qui déborde, pas tous ses descendants.
      const quiDebordent = [...document.querySelectorAll('body *')]
        .filter((el) => el.getBoundingClientRect().width > 0 && deborde(el))
        .filter((el) => el.parentElement === null || !deborde(el.parentElement))
        .map(decrire);

      const visibles = (selecteur: string): Element[] =>
        [...document.querySelectorAll(selecteur)].filter((el) =>
          el.checkVisibility({ checkVisibilityCSS: true }),
        );
      const auFilDUnePhrase = (el: Element): boolean => {
        if (el.tagName !== 'A' || getComputedStyle(el).display !== 'inline') return false;
        const phrase = el.parentElement?.textContent ?? '';
        return phrase.trim().length > el.textContent.trim().length + 3;
      };
      const tolerance = 0.5;
      const ciblesTropPetites = visibles('a, button, summary, select, input, textarea')
        .filter((el) => !auFilDUnePhrase(el))
        .filter((el) => {
          const r = (el.closest('label') ?? el).getBoundingClientRect();
          return r.width < cibleMin - tolerance || r.height < cibleMin - tolerance;
        })
        .map(decrire);
      const champsTropPetits = visibles(
        'input:not([type="checkbox"]):not([type="radio"]), select, textarea',
      )
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) < policeMin)
        .map(decrire);

      return {
        debordement: document.documentElement.scrollWidth - largeur,
        quiDebordent: quiDebordent.slice(0, 10),
        ciblesTropPetites,
        champsTropPetits,
      };
    },
    { cibleMin: CIBLE_MIN_PX, policeMin: POLICE_MIN_PX },
  );
}
