import { describe, expect, it } from 'vitest';

import type { DonneesArgent } from '../src/argent';
import type { Depense, PretEnregistre } from '../src/depenses';
import { lignesDeLAnnee } from '../src/export-annee';
import { tableauDuPret } from '../src/pret';
import { bien, location, paiement } from './exemples';

const H = '2026-09-01T08:00:00.000Z';

const ASSURANCE_COMMUNE: Depense = {
  id: 'assurance',
  categorie: 'assurance',
  montant: 1_200,
  date: '2026-01-03',
  recuperable: false,
  recurrence: { frequence: 'mensuelle', jusquAu: '2026-02-28' },
  creeLe: H,
  modifieLe: H,
};

const TAXE_LICES: Depense = {
  id: 'taxe',
  bienId: 'bien-lices',
  categorie: 'taxe_fonciere',
  montant: 84_000,
  date: '2026-01-05',
  libelle: 'Taxe foncière',
  recuperable: false,
  creeLe: H,
  modifieLe: H,
};

/** 12 000 € à 0 % sur deux mois : 6 000 € de capital par mois, 5 € d'assurance, aucun intérêt. */
const PRET_STUDIO: PretEnregistre = {
  bienId: 'bien-baille',
  capital: 1_200_000,
  tauxAnnuel: 0,
  dureeMois: 2,
  debut: '2026-01',
  assuranceMensuelle: 500,
  modifieLe: H,
};

/** 12 000 € à 12 % sur un an, première échéance en décembre : 120 € d'intérêts, pas d'assurance. */
const PRET_LICES: PretEnregistre = {
  bienId: 'bien-lices',
  capital: 1_200_000,
  tauxAnnuel: 0.12,
  dureeMois: 12,
  debut: '2026-12',
  assuranceMensuelle: 0,
  modifieLe: H,
};

function donnees(): DonneesArgent {
  return {
    biens: [bien('bien-lices', 'T2 Lices'), bien('bien-baille', 'Studio Baille')],
    locations: [
      location('location-julie'),
      location('location-antoine', {
        bienId: 'bien-baille',
        loyerHorsCharges: 40_000,
        charges: 3_000,
      }),
      location('location-parking', { bienId: 'bien-supprime' }),
    ],
    paiements: [
      paiement('julie', 'location-julie', '2026-01', 70_000),
      paiement('antoine', 'location-antoine', '2026-01', 43_000),
      // Encaissé en 2025 : hors de l'année.
      paiement('avance', 'location-julie', '2026-01', 70_000, '2025-12-30'),
      // Location inconnue, bien supprimé : écartés.
      paiement('inconnu', 'location-inconnue', '2026-01', 1_000),
      paiement('parking', 'location-parking', '2026-01', 5_000),
    ],
    depenses: [TAXE_LICES, ASSURANCE_COMMUNE],
    prets: [PRET_STUDIO, PRET_LICES, { ...PRET_STUDIO, bienId: 'bien-supprime' }],
  };
}

describe('lignes de l’année pour le comptable', () => {
  it('par date, puis loyers, dépenses et prêt ; montants signés ; parts nulles omises ; hors année et biens supprimés écartés', () => {
    const decembre = tableauDuPret(PRET_LICES)[0];
    expect(decembre?.interets).toBe(12_000);
    const capitalDecembre = decembre?.capitalRembourse ?? 0;

    expect(lignesDeLAnnee(donnees(), 2026)).toEqual([
      {
        type: 'pret_capital',
        date: '2026-01-01',
        bienId: 'bien-baille',
        montant: -600_000,
        periode: '2026-01',
      },
      {
        type: 'pret_assurance',
        date: '2026-01-01',
        bienId: 'bien-baille',
        montant: -500,
        periode: '2026-01',
      },
      {
        type: 'depense',
        date: '2026-01-03',
        bienId: null,
        montant: -1_200,
        depense: ASSURANCE_COMMUNE,
      },
      {
        type: 'loyer',
        date: '2026-01-05',
        bienId: 'bien-lices',
        montant: 70_000,
        locationId: 'location-julie',
        periode: '2026-01',
      },
      {
        type: 'loyer',
        date: '2026-01-05',
        bienId: 'bien-baille',
        montant: 43_000,
        locationId: 'location-antoine',
        periode: '2026-01',
      },
      {
        type: 'depense',
        date: '2026-01-05',
        bienId: 'bien-lices',
        montant: -84_000,
        depense: TAXE_LICES,
      },
      {
        type: 'pret_capital',
        date: '2026-02-01',
        bienId: 'bien-baille',
        montant: -600_000,
        periode: '2026-02',
      },
      {
        type: 'pret_assurance',
        date: '2026-02-01',
        bienId: 'bien-baille',
        montant: -500,
        periode: '2026-02',
      },
      {
        type: 'depense',
        date: '2026-02-03',
        bienId: null,
        montant: -1_200,
        depense: ASSURANCE_COMMUNE,
      },
      {
        type: 'pret_interets',
        date: '2026-12-01',
        bienId: 'bien-lices',
        montant: -12_000,
        periode: '2026-12',
      },
      {
        type: 'pret_capital',
        date: '2026-12-01',
        bienId: 'bien-lices',
        montant: -capitalDecembre,
        periode: '2026-12',
      },
    ]);
  });

  it('une année sans mouvement : aucune ligne', () => {
    expect(lignesDeLAnnee(donnees(), 2024)).toEqual([]);
  });
});
