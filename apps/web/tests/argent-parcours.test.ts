import { describe, expect, it } from 'vitest';

import {
  CHEMIN_ARGENT,
  CHEMIN_NOUVELLE_DEPENSE,
  lienArgent,
  lienDepense,
  lienNouvelleDepense,
  retourValide,
} from '@/gestion/parcours';

describe('adresses de l’argent', () => {
  it('la page Argent : un mois, une année, un bien', () => {
    expect(lienArgent()).toBe(CHEMIN_ARGENT);
    expect(lienArgent({ periode: '2026-10', bienId: 'bien lices' })).toBe(
      '/gerer/argent?mois=2026-10&bien=bien+lices',
    );
    expect(lienArgent({ annee: 2026 })).toBe('/gerer/argent?annee=2026');
  });

  it('nouvelle dépense et dépense existante, avec la page où revenir (validée comme page de Gérer)', () => {
    expect(lienNouvelleDepense()).toBe(CHEMIN_NOUVELLE_DEPENSE);
    const lien = lienNouvelleDepense({ bienId: 'bien-lices', retour: '/gerer/biens/bien-lices' });
    expect(lien).toBe(
      '/gerer/depenses/nouvelle?bien=bien-lices&retour=%2Fgerer%2Fbiens%2Fbien-lices',
    );
    expect(lienDepense('d/1')).toBe('/gerer/depenses/d%2F1');
    expect(lienDepense('d1', '/gerer/argent?mois=2026-10')).toBe(
      '/gerer/depenses/d1?retour=%2Fgerer%2Fargent%3Fmois%3D2026-10',
    );
    expect(retourValide('/gerer/argent?mois=2026-10')).toBe('/gerer/argent?mois=2026-10');
  });
});
