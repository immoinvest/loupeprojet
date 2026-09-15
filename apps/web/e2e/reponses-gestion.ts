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
  const location = {
    type: 'meublee',
    debut: '2025-10-01',
    jourLoyer: 5,
    charges: 5_000,
    colocataireIds: [],
    creeLe,
  };
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

  // Vie du bail (B1) : DPE du T2 Lices et une lettre de révision déjà émise pour Julie.
  const bailleur = { nom: 'Camille Martin', adresse: '3 rue Paradis, 13006 Marseille' };
  const lettre = {
    id: 'lettre-julie',
    locationId: 'location-julie',
    numero: 'V-202610-LOCATION',
    anniversaire: '2026-10-01',
    emisLe: '2026-09-14T09:00:00.000Z',
  };
  await page.route('**/api/gestion/bail', (route) =>
    route.fulfill({
      json: {
        biens: [
          {
            bienId: 'bien-lices',
            dpeClasse: 'D',
            dpeDate: '2024-03-01',
            zoneTendue: true,
            modifieLe: creeLe,
          },
        ],
        revisions: [],
        lettres: [lettre],
      },
    }),
  );
  await page.route('**/api/gestion/bail/lettres/*', (route) =>
    route.fulfill({
      json: {
        ...lettre,
        contenu: {
          numero: lettre.numero,
          emisLe: '2026-09-14',
          bailleur,
          locataires: [{ prenom: 'Julie', nom: 'Martin' }],
          logement: { nom: 'T2 Lices', adresse: '12 rue des Lices, Marseille 5e' },
          anniversaire: '2026-10-01',
          aPartirDe: '2026-10',
          loyerActuel: 65_000,
          nouveauLoyer: 65_749,
          charges: 5_000,
          indiceAncien: { trimestre: '2025-T2', valeur: 14_668 },
          indiceNouveau: { trimestre: '2026-T2', valeur: 14_837, publieLe: '2026-07-10' },
          variationPourcent: 1.15,
        },
      },
    }),
  );

  // La quittance du mois de Julie, telle que l'API la rend : contenu figé complet.
  const periode = aujourdhui.slice(0, 7);
  const numero = `Q-${periode.replace('-', '')}-LOCATION`;
  await page.route('**/api/gestion/documents/*', (route) =>
    route.fulfill({
      json: {
        id: 'document-julie',
        type: 'quittance',
        numero,
        locationId: 'location-julie',
        periode,
        emisLe: `${aujourdhui}T09:00:00.000Z`,
        contenu: {
          type: 'quittance',
          numero,
          emisLe: aujourdhui,
          bailleur: { nom: 'Camille Martin', adresse: '3 rue Paradis, 13006 Marseille' },
          locataires: [{ prenom: 'Julie', nom: 'Martin' }],
          logement: { nom: 'T2 Lices', adresse: '12 rue des Lices, Marseille 5e' },
          periode,
          debut: `${periode}-01`,
          fin: `${periode}-28`,
          loyerHorsCharges: 65_000,
          charges: 5_000,
          total: 70_000,
          paiements: [{ montant: 70_000, date: aujourdhui }],
          montantRecu: 70_000,
          dejaRecu: 0,
          resteDu: 0,
          mentions: ['pour_acquit'],
        },
      },
    }),
  );
}
