import { describe, expect, it } from 'vitest';

import { occupationDe } from '../src/creation';
import type { CreationLocation } from '../src/schemas';

const BIEN: CreationLocation['bien'] = {
  nom: 'T2 Lices',
  adresse: '12 rue des Lices',
  type: 'appartement',
  meuble: true,
};
const LOCATAIRE = { prenom: 'Julie', nom: 'Martin' };
const LOCATION: NonNullable<CreationLocation['location']> = {
  type: 'meublee',
  debut: '2026-10-01',
  jourLoyer: 5,
  loyerHorsCharges: 65_000,
  charges: 5_000,
  depot: 130_000,
};

describe('occupationDe', () => {
  it('rend le locataire et la location d’un bien loué, sans colocataire par défaut', () => {
    expect(occupationDe({ bien: BIEN, locataire: LOCATAIRE, location: LOCATION })).toEqual({
      locataire: LOCATAIRE,
      location: LOCATION,
      colocataires: [],
    });
  });

  it('colocation : les colocataires suivent, dans l’ordre de saisie', () => {
    const colocataires = [
      { prenom: 'Léa', nom: 'Bernard' },
      { prenom: 'Hugo', nom: 'Petit' },
    ];
    expect(
      occupationDe({ bien: BIEN, locataire: LOCATAIRE, location: LOCATION, colocataires })
        ?.colocataires,
    ).toEqual(colocataires);
  });

  it('rend null pour un bien vacant, et pour une création incohérente', () => {
    expect(occupationDe({ bien: BIEN, locataire: null, location: null })).toBeNull();
    expect(occupationDe({ bien: BIEN, locataire: LOCATAIRE, location: null })).toBeNull();
    expect(occupationDe({ bien: BIEN, locataire: null, location: LOCATION })).toBeNull();
  });
});
