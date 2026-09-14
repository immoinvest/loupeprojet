import type { Page } from '@playwright/test';

/**
 * Les biens de la maquette de Gérer : Julie a payé le loyer du mois en cours, Antoine pas encore,
 * le parking est vacant. Le mois vient de l'horloge du test : les loyers du mois se calculent à
 * partir d'aujourd'hui.
 */
export async function simulerGestion(page: Page): Promise<void> {
  const creeLe = '2026-09-01T08:00:00.000Z';
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const bien = {
    adresse: '12 rue des Lices, Marseille 5e',
    type: 'appartement',
    surface: 38,
    meuble: true,
    creeLe,
    modifieLe: creeLe,
  };
  const location = { type: 'meublee', debut: '2025-10-01', jourLoyer: 5, charges: 5_000, creeLe };
  await page.route('**/api/gestion/etat', (route) =>
    route.fulfill({
      json: {
        biens: [
          { ...bien, id: 'bien-lices', nom: 'T2 Lices' },
          { ...bien, id: 'bien-baille', nom: 'Studio Baille', type: 'studio' },
          { ...bien, id: 'bien-prado', nom: 'Parking Prado', type: 'parking', meuble: false },
        ],
        locataires: [
          { id: 'julie', prenom: 'Julie', nom: 'Martin', creeLe },
          { id: 'antoine', prenom: 'Antoine', nom: 'Dupont', creeLe },
        ],
        locations: [
          {
            ...location,
            id: 'location-julie',
            bienId: 'bien-lices',
            locataireId: 'julie',
            loyerHorsCharges: 65_000,
            depot: 130_000,
          },
          {
            ...location,
            id: 'location-antoine',
            bienId: 'bien-baille',
            locataireId: 'antoine',
            loyerHorsCharges: 40_000,
            depot: 80_000,
          },
        ],
        paiements: [
          {
            id: 'paiement-julie',
            locationId: 'location-julie',
            periode: aujourdhui.slice(0, 7),
            montant: 70_000,
            date: aujourdhui,
            source: 'manuel',
            creeLe,
          },
        ],
        bailleur: null,
        documents: [],
        preferences: { analyser: true, gerer: true },
      },
    }),
  );
}
