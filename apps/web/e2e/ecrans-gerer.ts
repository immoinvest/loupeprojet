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
    nom: 'Louer un bien vacant',
    chemin: '/gerer/biens/bien-prado?louer=1',
    ouvrir: async (page) => {
      await expect(page.getByRole('form', { name: 'Louer le bien' })).toBeVisible();
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
