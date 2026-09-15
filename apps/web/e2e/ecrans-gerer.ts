import { expect } from '@playwright/test';

import type { Ecran } from './formats';

/**
 * Les écrans de Gérer ajoutés par `quittances-fiches` (G1b), mesurés après « Gérer (loyers du mois) » :
 * la session et les réponses simulées de l'API de gestion sont déjà en place.
 */
export const ECRANS_QUITTANCES_FICHES: readonly Ecran[] = [
  {
    nom: 'Loyers (mois par mois)',
    chemin: '/gerer/loyers',
    // Le loyer de Julie est reçu ce mois-ci : le groupe « Reçus » est toujours là.
    ouvrir: async (page) => {
      await expect(page.getByRole('heading', { level: 2, name: 'Reçus' })).toBeVisible();
    },
  },
  {
    nom: 'Fiche d’un bien',
    chemin: '/gerer/biens/bien-lices',
    ouvrir: async (page) => {
      await expect(page.getByRole('list', { name: 'Les 12 derniers mois' })).toBeVisible();
    },
  },
  {
    // L'ancienne adresse redirige vers « Nouveau locataire » (gerer-parcours, G1d).
    nom: 'Louer un bien vacant',
    chemin: '/gerer/biens/bien-prado?louer=1',
    ouvrir: async (page) => {
      await expect(page.getByRole('form', { name: 'Nouveau locataire' })).toBeVisible();
    },
  },
  {
    nom: 'Quittance imprimable',
    chemin: '/gerer/documents/document-julie',
    ouvrir: async (page) => {
      await expect(
        page.getByRole('heading', { level: 1, name: 'Quittance de loyer' }),
      ).toBeVisible();
    },
  },
];

/** Les écrans ajoutés par `gerer-parcours` (G1d) : la fiche d'un locataire et sa liste des biens ouverte. */
export const ECRANS_GERER_PARCOURS: readonly Ecran[] = [
  {
    nom: 'Fiche d’un locataire',
    chemin: '/gerer/locataires/julie',
    ouvrir: async (page) => {
      await expect(page.getByRole('list', { name: 'Ses 12 derniers loyers' })).toBeVisible();
    },
  },
  {
    nom: 'Nouveau locataire (choix du bien)',
    chemin: '/gerer/locataires/nouveau',
    ouvrir: async (page) => {
      await page.getByRole('button', { name: 'Bien Parking Prado' }).click();
      await expect(page.getByRole('listbox', { name: 'Bien' })).toBeVisible();
    },
  },
];

/** Les écrans ajoutés par `gerer-biens` (G1c) : Mes biens, Mes locataires, Modifier, Supprimer. */
export const ECRANS_GERER_BIENS: readonly Ecran[] = [
  {
    nom: 'Mes biens',
    chemin: '/gerer/biens',
    ouvrir: async (page) => {
      await expect(page.getByRole('list', { name: 'Mes biens' })).toBeVisible();
    },
  },
  {
    nom: 'Mes locataires',
    chemin: '/gerer/locataires',
    ouvrir: async (page) => {
      await expect(page.getByRole('list', { name: 'En ce moment' })).toBeVisible();
    },
  },
  {
    nom: 'Modifier une location',
    chemin: '/gerer/biens/bien-lices',
    ouvrir: async (page) => {
      await page.getByRole('button', { name: 'Modifier', exact: true }).click();
      await expect(page.getByRole('form', { name: 'Modifier la location' })).toBeVisible();
    },
  },
  {
    nom: 'Supprimer un bien',
    chemin: '/gerer/biens/bien-prado',
    ouvrir: async (page) => {
      await page.getByRole('button', { name: 'Supprimer ce bien' }).click();
      await expect(page.getByRole('region', { name: 'Supprimer ce bien ?' })).toBeVisible();
    },
  },
];

/** Les écrans ajoutés par `quittances-auto` (G2-1, G2-2) : accord du locataire, bailleur d'un bien. */
export const ECRANS_QUITTANCES_AUTO: readonly Ecran[] = [
  {
    nom: 'Accord du locataire (page publique)',
    chemin: `/accord#${'a'.repeat(43)}.1790000000.${'b'.repeat(43)}`,
    ouvrir: async (page) => {
      await expect(
        page.getByRole('button', { name: 'Oui, recevoir mes quittances par e-mail' }),
      ).toBeVisible();
    },
  },
  {
    nom: 'Quittances par e-mail (fiche du locataire)',
    chemin: '/gerer/locataires/julie',
    ouvrir: async (page) => {
      await expect(page.getByRole('heading', { name: 'Quittances par e-mail' })).toBeVisible();
    },
  },
  {
    nom: 'Bailleur d’un bien',
    chemin: '/gerer/biens/bien-lices',
    ouvrir: async (page) => {
      await page.getByRole('button', { name: 'Indiquer un autre bailleur' }).click();
      await expect(page.getByRole('form', { name: 'Bailleur de ce bien' })).toBeVisible();
    },
  },
];

/** Tous les écrans de Gérer mesurés après « Gérer (loyers du mois) », feature par feature. */
export const ECRANS_GERER: readonly Ecran[] = [
  ...ECRANS_QUITTANCES_FICHES,
  ...ECRANS_GERER_BIENS,
  ...ECRANS_GERER_PARCOURS,
  ...ECRANS_QUITTANCES_AUTO,
];
