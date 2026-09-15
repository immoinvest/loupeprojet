import { describe, expect, it } from 'vitest';

import { occupationDepuisSaisie, saisieLouer, type SaisieLouer } from '@/gestion/saisie-louer';

import { LOCATION_JULIE } from './gestion-exemples';

const AUJOURDHUI = '2026-09-14';

/** Une saisie juste : Léa Bernard, meublée, 490 € + 40 €. */
function saisie(champs: Partial<SaisieLouer> = {}): SaisieLouer {
  return {
    ...saisieLouer(undefined, AUJOURDHUI),
    locataire: 'Léa Bernard',
    loyer: '490',
    charges: '40',
    ...champs,
  };
}

describe('saisieLouer', () => {
  it('sans location précédente : meublée, vide, entrée le 1er du mois', () => {
    expect(saisieLouer(undefined, AUJOURDHUI)).toEqual({
      apl: '',
      locataire: '',
      email: '',
      colocataires: [],
      libelle: '',
      type: 'meublee',
      loyer: '',
      charges: '',
      entree: '2026-09-01',
      jourLoyer: '',
      depot: '',
    });
  });

  it('reprend type, loyer, charges et jour de la dernière location ; pas la chambre ni le dépôt', () => {
    const derniere = {
      ...LOCATION_JULIE,
      type: 'nue' as const,
      loyerHorsCharges: 65_050,
      charges: 5_000,
      jourLoyer: 3,
      libelle: 'Chambre 1',
    };
    expect(saisieLouer(derniere, AUJOURDHUI)).toMatchObject({
      type: 'nue',
      loyer: '650,50',
      charges: '50',
      jourLoyer: '3',
      libelle: '',
      depot: '',
    });
  });
});

describe('occupationDepuisSaisie', () => {
  it('le bien entier : locataire, location au dépôt légal, aucun colocataire', () => {
    expect(occupationDepuisSaisie(saisie({ email: 'lea.bernard@exemple.fr' }))).toEqual({
      ok: true,
      occupation: {
        locataire: { prenom: 'Léa', nom: 'Bernard', email: 'lea.bernard@exemple.fr' },
        location: {
          type: 'meublee',
          debut: '2026-09-01',
          jourLoyer: 5,
          loyerHorsCharges: 49_000,
          charges: 4_000,
          depot: 98_000,
        },
        colocataires: [],
      },
    });
  });

  it('une chambre en colocation : libellé nettoyé, colocataires dans l’ordre, lignes vides ignorées', () => {
    const r = occupationDepuisSaisie(
      saisie({
        libelle: ' Chambre 2 ',
        colocataires: ['Hugo Petit', '  ', 'Jean-Pierre de La Tour'],
      }),
    );
    expect(r).toMatchObject({
      ok: true,
      occupation: {
        location: { libelle: 'Chambre 2' },
        colocataires: [
          { prenom: 'Hugo', nom: 'Petit' },
          { prenom: 'Jean-Pierre', nom: 'de La Tour' },
        ],
      },
    });
  });

  it('champs à corriger, dans l’ordre de l’écran', () => {
    expect(
      occupationDepuisSaisie(
        saisie({
          locataire: 'Léa',
          email: 'pas-un-email',
          colocataires: ['Hugo'],
          libelle: 'x'.repeat(41),
          loyer: 'six cents',
          entree: '2026-02-30',
        }),
      ),
    ).toEqual({
      ok: false,
      erreurs: ['locataire', 'email', 'colocataires', 'libelle', 'loyer', 'entree'],
    });
  });

  it('plus de dix colocataires : refusé sur la ligne des colocataires', () => {
    const onze = Array.from({ length: 11 }, (_, i) => `Coloc Numero${String(i)}`);
    expect(occupationDepuisSaisie(saisie({ colocataires: onze }))).toEqual({
      ok: false,
      erreurs: ['colocataires'],
    });
  });
});
