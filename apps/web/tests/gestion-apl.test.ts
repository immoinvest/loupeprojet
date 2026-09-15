import type { NouvelleLocation } from '@loupe/gestion';
import { describe, expect, it } from 'vitest';

import { recoitApl } from '@/gestion/fiche';
import { montant } from '@/gestion/format';
import { creationDepuisSaisie, saisieInitiale, type SaisieMain } from '@/gestion/saisie';
import { occupationDepuisSaisie, saisieLouer } from '@/gestion/saisie-louer';
import { modificationDepuisSaisie, saisieModification } from '@/gestion/saisie-modifier';
import { plusApl } from '@/textes/gerer-loyers';

import { LOCATION_JULIE } from './gestion-exemples';

const AUJOURDHUI = '2026-09-14';

const SAISIE: SaisieMain = {
  ...saisieInitiale(AUJOURDHUI),
  adresse: '12 rue des Lices, Marseille',
  loyer: '650',
  charges: '50',
  locataire: 'Julie Martin',
};

function locationCreee(saisie: SaisieMain): NouvelleLocation | null {
  const r = creationDepuisSaisie(saisie);
  if (!r.ok) throw new Error(`champs refusés : ${r.erreurs.join(', ')}`);
  return r.creation.location;
}

describe('APL versée au bailleur, dans les saisies', () => {
  it('« Ajouter à la main » : facultative, en euros, jamais au-dessus du loyer charges comprises', () => {
    expect(locationCreee(SAISIE)).not.toHaveProperty('apl');
    expect(locationCreee({ ...SAISIE, apl: '180' })).toMatchObject({ apl: 18_000 });
    expect(locationCreee({ ...SAISIE, apl: '700' })).toMatchObject({ apl: 70_000 });
    expect(creationDepuisSaisie({ ...SAISIE, apl: '700,01' })).toEqual({
      ok: false,
      erreurs: ['apl'],
    });
    expect(creationDepuisSaisie({ ...SAISIE, apl: 'beaucoup' })).toEqual({
      ok: false,
      erreurs: ['apl'],
    });
  });

  it('« Louer » : vide au départ, même règle', () => {
    const saisie = {
      ...saisieLouer(undefined, AUJOURDHUI),
      locataire: 'Léa Bernard',
      loyer: '490',
      charges: '40',
    };
    expect(saisie.apl).toBe('');
    const louee = occupationDepuisSaisie({ ...saisie, apl: '120' });
    expect(louee.ok && louee.occupation.location.apl).toBe(12_000);
    expect(occupationDepuisSaisie({ ...saisie, apl: '531' })).toEqual({
      ok: false,
      erreurs: ['apl'],
    });
  });

  it('« Modifier » : aide en vigueur préremplie, changée seule, contrôlée ; ignorée sans mois modifiable', () => {
    const avecAide = { ...LOCATION_JULIE, apl: 18_000 };
    const saisie = saisieModification(avecAide, ['2026-10'], AUJOURDHUI);
    expect(saisie.apl).toBe('180');
    expect(modificationDepuisSaisie(avecAide, saisie)).toEqual({ ok: true, modification: null });
    expect(modificationDepuisSaisie(avecAide, { ...saisie, apl: '' })).toEqual({
      ok: true,
      modification: {
        montants: { aPartirDe: '2026-10', loyerHorsCharges: 65_000, charges: 5_000, apl: 0 },
      },
    });
    expect(modificationDepuisSaisie(avecAide, { ...saisie, apl: '701' })).toEqual({
      ok: false,
      erreurs: ['apl'],
    });
    expect(
      modificationDepuisSaisie(avecAide, { ...saisie, aPartirDe: '', apl: 'n’importe quoi' }),
    ).toEqual({ ok: true, modification: null });
  });

  it('rappel à la sortie : aide à l’entrée ou après un changement ; texte de la ligne du loyer', () => {
    const changement = { aPartirDe: '2026-10', loyerHorsCharges: 65_000, charges: 5_000, apl: 0 };
    expect(recoitApl(LOCATION_JULIE)).toBe(false);
    expect(recoitApl({ ...LOCATION_JULIE, apl: 18_000 })).toBe(true);
    expect(recoitApl({ ...LOCATION_JULIE, changements: [changement] })).toBe(false);
    expect(recoitApl({ ...LOCATION_JULIE, changements: [{ ...changement, apl: 9_000 }] })).toBe(
      true,
    );
    expect(plusApl(18_000)).toBe(`+ ${montant(18_000)} d’APL`);
  });
});
