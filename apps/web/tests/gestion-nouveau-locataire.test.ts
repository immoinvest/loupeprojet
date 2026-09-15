import type { EtatGestion } from '@loupe/gestion';
import { describe, expect, it } from 'vitest';

import { saisieLouer } from '@/gestion/saisie-louer';
import {
  apresChangementDeBien,
  bienInitial,
  choixDesBiens,
} from '@/gestion/saisie-nouveau-locataire';

import { BIEN_LICES, ETAT_SEPTEMBRE, LOCATION_ANTOINE, LOCATION_JULIE } from './gestion-exemples';

const AUJOURDHUI = '2026-09-14';

/** Deux biens loués, deux vacants (dont un qui l'a été), et un bien dont le locataire arrive. */
const DONNEES: EtatGestion = {
  ...ETAT_SEPTEMBRE,
  biens: [
    ...ETAT_SEPTEMBRE.biens,
    { ...BIEN_LICES, id: 'parking-10', nom: 'Parking 10' },
    { ...BIEN_LICES, id: 'parking-2', nom: 'Parking 2' },
    { ...BIEN_LICES, id: 'neuf', nom: 'Appartement neuf' },
  ],
  locations: [
    LOCATION_JULIE,
    LOCATION_ANTOINE,
    { ...LOCATION_ANTOINE, id: 'ancienne', bienId: 'parking-2', fin: '2026-06-30' },
    { ...LOCATION_JULIE, id: 'future', bienId: 'neuf', debut: '2026-10-01' },
  ],
};

describe('choixDesBiens', () => {
  it('sans locataire, puis les autres ; ordre naturel des noms', () => {
    const choix = choixDesBiens(DONNEES, AUJOURDHUI);
    expect(choix.vacants.map((b) => b.nom)).toEqual(['Parking 2', 'Parking 10']);
    expect(choix.loues.map((b) => [b.nom, b.etat.statut])).toEqual([
      ['Appartement neuf', 'a_venir'],
      ['Studio Baille', 'loue'],
      ['T2 Lices', 'loue'],
    ]);
  });
});

describe('bienInitial', () => {
  const choix = choixDesBiens(DONNEES, AUJOURDHUI);

  it('le bien demandé s’il existe, vacant ou non', () => {
    expect(bienInitial(choix, 'bien-lices')).toBe('bien-lices');
    expect(bienInitial(choix, 'parking-10')).toBe('parking-10');
  });

  it('sinon le premier bien vacant, sinon le premier bien, sinon rien', () => {
    expect(bienInitial(choix, 'inconnu')).toBe('parking-2');
    expect(bienInitial(choix, null)).toBe('parking-2');
    expect(bienInitial(choixDesBiens(ETAT_SEPTEMBRE, AUJOURDHUI), null)).toBe('bien-baille');
    expect(bienInitial({ vacants: [], loues: [] }, 'bien-lices')).toBeNull();
  });
});

describe('apresChangementDeBien', () => {
  it('reprend la location du nouveau bien, garde le reste de la saisie', () => {
    const tapee = {
      ...saisieLouer(undefined, AUJOURDHUI),
      locataire: 'Léa Bernard',
      email: 'lea@exemple.fr',
      colocataires: ['Hugo Petit'],
      libelle: 'Chambre 2',
      entree: '2026-10-01',
      depot: '900',
      apl: '100',
      loyer: '120',
    };
    const lices = apresChangementDeBien(tapee, LOCATION_JULIE, AUJOURDHUI);
    expect(lices).toEqual({
      ...tapee,
      type: 'meublee',
      loyer: '650',
      charges: '50',
      jourLoyer: '5',
    });
    // Un bien sans location : loyer, charges et jour redeviennent vides.
    expect(apresChangementDeBien(lices, undefined, AUJOURDHUI)).toEqual({
      ...tapee,
      type: 'meublee',
      loyer: '',
      charges: '',
      jourLoyer: '',
    });
  });
});
