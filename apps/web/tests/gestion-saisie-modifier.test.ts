import { moisModifiables } from '@loupe/gestion';
import { describe, expect, it } from 'vitest';

import { nomSupprime } from '@/gestion/biens';
import {
  modificationDepuisSaisie,
  nomConfirme,
  saisieModification,
  texteDepuisCentimes,
} from '@/gestion/saisie-modifier';
import {
  bienSupprime,
  confirmationSuppression,
  depuisLe,
  ERREURS_MODIFIER,
  loyerAPartirDe,
} from '@/textes/gerer-biens';

import { LOCATION_JULIE, PAIEMENT_JULIE } from './gestion-exemples';

const AUJOURDHUI = '2026-09-14';

describe('saisieModification', () => {
  it('montants en vigueur au premier mois modifiable, jour, dépôt et libellé', () => {
    const mois = moisModifiables(LOCATION_JULIE, [PAIEMENT_JULIE], AUJOURDHUI);
    expect(mois[0]).toBe('2026-10');
    const location = {
      ...LOCATION_JULIE,
      libelle: 'Chambre 1',
      changements: [{ aPartirDe: '2026-10', loyerHorsCharges: 68_050, charges: 5_000, apl: 0 }],
    };
    expect(saisieModification(location, mois, AUJOURDHUI)).toEqual({
      aPartirDe: '2026-10',
      loyer: '680,50',
      charges: '50',
      apl: '',
      jourLoyer: '5',
      depot: '1300',
      libelle: 'Chambre 1',
    });
    // Tout est payé : aucun mois proposé, les montants de ce mois-ci pour mémoire.
    expect(saisieModification(LOCATION_JULIE, [], AUJOURDHUI)).toMatchObject({
      aPartirDe: '',
      loyer: '650',
      libelle: '',
    });
  });

  it('texteDepuisCentimes : euros entiers, ou avec leurs centimes', () => {
    expect(texteDepuisCentimes(65_000)).toBe('650');
    expect(texteDepuisCentimes(65_005)).toBe('650,05');
  });
});

describe('modificationDepuisSaisie', () => {
  const saisie = saisieModification(LOCATION_JULIE, ['2026-10', '2026-11'], AUJOURDHUI);

  it('rien de changé : rien à envoyer', () => {
    expect(modificationDepuisSaisie(LOCATION_JULIE, saisie)).toEqual({
      ok: true,
      modification: null,
    });
  });

  it('seulement ce qui change : montants à partir du mois choisi, jour, dépôt, libellé ajouté ou retiré', () => {
    expect(
      modificationDepuisSaisie(LOCATION_JULIE, {
        ...saisie,
        aPartirDe: '2026-11',
        loyer: '680',
        jourLoyer: '10',
        depot: '0',
        libelle: ' Chambre 1 ',
      }),
    ).toEqual({
      ok: true,
      modification: {
        montants: { aPartirDe: '2026-11', loyerHorsCharges: 68_000, charges: 5_000, apl: 0 },
        jourLoyer: 10,
        depot: 0,
        libelle: 'Chambre 1',
      },
    });
    expect(
      modificationDepuisSaisie(
        { ...LOCATION_JULIE, libelle: 'Chambre 1' },
        { ...saisie, libelle: '' },
      ),
    ).toEqual({ ok: true, modification: { libelle: null } });
    // Seules les charges changent (vides : 0 €).
    expect(modificationDepuisSaisie(LOCATION_JULIE, { ...saisie, charges: '' })).toEqual({
      ok: true,
      modification: {
        montants: { aPartirDe: '2026-10', loyerHorsCharges: 65_000, charges: 0, apl: 0 },
      },
    });
  });

  it('tout payé : loyer et charges ne sont ni lus ni envoyés', () => {
    expect(
      modificationDepuisSaisie(LOCATION_JULIE, {
        ...saisie,
        aPartirDe: '',
        loyer: 'illisible',
        charges: '?',
        jourLoyer: '12',
      }),
    ).toEqual({ ok: true, modification: { jourLoyer: 12 } });
  });

  it('champs à corriger, dans l’ordre de l’écran', () => {
    expect(
      modificationDepuisSaisie(LOCATION_JULIE, {
        ...saisie,
        loyer: '',
        charges: 'abc',
        jourLoyer: '29',
        depot: '',
        libelle: 'x'.repeat(41),
      }),
    ).toEqual({ ok: false, erreurs: ['loyer', 'charges', 'jourLoyer', 'depot', 'libelle'] });
    for (const jourLoyer of ['2.5', '0']) {
      expect(modificationDepuisSaisie(LOCATION_JULIE, { ...saisie, jourLoyer })).toEqual({
        ok: false,
        erreurs: ['jourLoyer'],
      });
    }
  });
});

describe('supprimer : confirmation et textes', () => {
  it('le nom tapé, espaces et majuscules ignorés ; le message de retour sur Mes biens', () => {
    expect(nomConfirme('  t2   lices ', 'T2 Lices')).toBe(true);
    expect(nomConfirme('T2 Lice', 'T2 Lices')).toBe(false);
    expect(confirmationSuppression('T2 Lices')).toBe('Tape « T2 Lices » pour confirmer');
    expect(bienSupprime('T2 Lices')).toBe('T2 Lices a été supprimé.');
    expect(nomSupprime({ supprime: 'T2 Lices' })).toBe('T2 Lices');
    for (const etat of [undefined, null, 'T2 Lices', {}, { supprime: 3 }]) {
      expect(nomSupprime(etat)).toBeNull();
    }
  });

  it('textes de Modifier', () => {
    expect(depuisLe('2026-10')).toBe('depuis octobre 2026');
    expect(loyerAPartirDe('2026-10')).toMatch(/^Loyer hors charges à partir d.octobre 2026$/);
    expect(loyerAPartirDe('2027-03')).toBe('Loyer hors charges à partir de mars 2027');
    expect(Object.keys(ERREURS_MODIFIER)).toEqual([
      'loyer',
      'charges',
      'apl',
      'jourLoyer',
      'depot',
      'libelle',
    ]);
  });
});
