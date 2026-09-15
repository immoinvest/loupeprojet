import { describe, expect, it } from 'vitest';

import type { Depense } from '../src/depenses';
import {
  anneesARegulariser,
  DemandeRegularisationSchema,
  echeanceRegularisation,
  ModeChargesLocationSchema,
  ModeChargesSaisieSchema,
  RegleeSchema,
  RegularisationSchema,
  regularisationDeLAnnee,
  type EntreesRegularisation,
} from '../src/regularisation';
import { location } from './exemples';

const CREE = '2026-01-01T08:00:00.000Z';

function depense(surcharges: Partial<Depense> = {}): Depense {
  return {
    id: 'd1',
    bienId: 'bien-lices',
    categorie: 'copropriete',
    montant: 4_500,
    date: '2026-01-10',
    recuperable: true,
    recurrence: { frequence: 'mensuelle' },
    creeLe: CREE,
    modifieLe: CREE,
    ...surcharges,
  };
}

/** Julie depuis le 1er octobre 2025, 50 € de provisions par mois. */
function entrees(surcharges: Partial<EntreesRegularisation> = {}): EntreesRegularisation {
  const l = location('l1');
  return {
    location: l,
    locationsDuBien: [l],
    depenses: [depense()],
    annee: 2026,
    mode: 'provision',
    ...surcharges,
  };
}

describe('régularisation annuelle des charges (art. 23)', () => {
  it('cas de la spec : 50 € × 12 de provisions, 540 € récupérables → remboursement de 60 €', () => {
    expect(regularisationDeLAnnee(entrees())).toEqual({
      statut: 'proposee',
      annee: 2026,
      debut: '2026-01-01',
      fin: '2026-12-31',
      provisions: 60_000,
      charges: [{ categorie: 'copropriete', montant: 54_000 }],
      totalCharges: 54_000,
      joursOccupes: 365,
      joursAnnee: 365,
      chambres: 1,
      solde: -6_000,
    });
  });

  it('forfait : jamais proposée ; année sans location ; aucune dépense récupérable de l’année', () => {
    expect(regularisationDeLAnnee(entrees({ mode: 'forfait' }))).toEqual({ statut: 'forfait' });
    expect(regularisationDeLAnnee(entrees({ annee: 2024 }))).toEqual({ statut: 'hors_location' });
    const autres = [
      depense({ recuperable: false }),
      depense({ bienId: 'bien-baille' }),
      depense({ recurrence: undefined, date: '2025-06-01' }),
    ];
    expect(regularisationDeLAnnee(entrees({ depenses: autres }))).toEqual({
      statut: 'sans_depenses',
      provisions: 60_000,
    });
  });

  it('entrée au 1er juillet : 184 jours, 365 € de taxe foncière → 184 €, complément ou remboursement', () => {
    const l = location('l1', { debut: '2026-07-01' });
    const taxe = depense({
      categorie: 'taxe_fonciere',
      montant: 36_500,
      date: '2026-10-15',
      recurrence: undefined,
    });
    expect(
      regularisationDeLAnnee(entrees({ location: l, locationsDuBien: [l], depenses: [taxe] })),
    ).toMatchObject({
      debut: '2026-07-01',
      fin: '2026-12-31',
      provisions: 30_000,
      charges: [{ categorie: 'taxe_fonciere', montant: 18_400 }],
      joursOccupes: 184,
      solde: -11_600,
    });
  });

  it('natures dans l’ordre des catégories, montants d’une même nature additionnés, sortie en cours d’année', () => {
    const l = location('l1', { fin: '2026-06-30' });
    const resultat = regularisationDeLAnnee(
      entrees({
        location: l,
        locationsDuBien: [l],
        depenses: [
          depense(),
          depense({ id: 'd2', montant: 1_000, recurrence: undefined, date: '2026-03-01' }),
          depense({ id: 'd3', categorie: 'taxe_fonciere', montant: 73_000, recurrence: undefined }),
        ],
      }),
    );
    expect(resultat).toMatchObject({
      fin: '2026-06-30',
      joursOccupes: 181,
      charges: [
        { categorie: 'taxe_fonciere', montant: Math.round((73_000 * 181) / 365) },
        { categorie: 'copropriete', montant: Math.round((55_000 * 181) / 365) },
      ],
    });
  });

  it('chambres louées dans l’année : charges partagées ; année bissextile de 366 jours', () => {
    const l = location('l1', { libelle: 'Chambre 1' });
    const locationsDuBien = [
      l,
      location('l2', { libelle: 'chambre 1', debut: '2024-01-01', fin: '2024-12-31' }),
      location('l3', { libelle: 'Chambre 2', debut: '2026-03-01' }),
      location('l4', { libelle: 'CHAMBRE 2', debut: '2026-09-01' }),
    ];
    expect(regularisationDeLAnnee(entrees({ location: l, locationsDuBien }))).toMatchObject({
      chambres: 2,
      charges: [{ categorie: 'copropriete', montant: 27_000 }],
    });
    const bissextile = regularisationDeLAnnee(
      entrees({ annee: 2028, depenses: [depense({ date: '2028-01-10' })] }),
    );
    expect(bissextile).toMatchObject({ joursAnnee: 366, joursOccupes: 366 });
    expect(regularisationDeLAnnee(entrees({ locationsDuBien: [] }))).toMatchObject({ chambres: 1 });
  });

  it('années proposées : passées, courues par la location, trois au plus, la plus récente d’abord', () => {
    expect(anneesARegulariser(location('l1'), '2026-09-15')).toEqual([2025]);
    expect(anneesARegulariser(location('l1', { debut: '2020-01-01' }), '2026-09-15')).toEqual([
      2025, 2024, 2023,
    ]);
    const partie = location('l1', { debut: '2020-01-01', fin: '2024-06-30' });
    expect(anneesARegulariser(partie, '2026-09-15')).toEqual([2024, 2023]);
    expect(anneesARegulariser(location('l1', { debut: '2026-02-01' }), '2026-09-15')).toEqual([]);
  });

  it('échéance : premier mois qui commence au moins un mois après la validation', () => {
    expect(echeanceRegularisation('2026-09-15')).toBe('2026-11');
    expect(echeanceRegularisation('2026-09-01')).toBe('2026-10');
  });

  it('schémas', () => {
    expect(ModeChargesSaisieSchema.safeParse({ mode: 'forfait' }).success).toBe(true);
    expect(ModeChargesSaisieSchema.safeParse({ mode: 'reel' }).success).toBe(false);
    const mode = { locationId: 'l1', mode: 'provision', modifieLe: CREE };
    expect(ModeChargesLocationSchema.safeParse(mode).success).toBe(true);
    expect(DemandeRegularisationSchema.safeParse({ annee: 1999 }).success).toBe(false);
    expect(RegleeSchema.safeParse({ regleeLe: '2026-11-05' }).success).toBe(true);
    const regularisation = {
      id: 'r1',
      locationId: 'l1',
      annee: 2025,
      solde: -6_000,
      aPartirDe: '2026-11',
      decompteId: 'd1',
      regleeLe: null,
      creeLe: CREE,
    };
    expect(RegularisationSchema.safeParse(regularisation).success).toBe(true);
  });
});
