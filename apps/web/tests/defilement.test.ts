import { describe, expect, it } from 'vitest';

import { defilementPourVoir } from '@/coque/defilement';

/** Bande des volets sur un téléphone de 320 px, au repos. */
const AU_REPOS = { defilement: 0, largeurVisible: 320 };

describe('defilementPourVoir (onglet actif ramené dans la bande)', () => {
  it('ne bouge pas quand l’onglet est déjà visible', () => {
    expect(defilementPourVoir({ debut: 100, largeur: 90 }, AU_REPOS)).toBe(0);
    expect(
      defilementPourVoir({ debut: 300, largeur: 90 }, { defilement: 200, largeurVisible: 320 }),
    ).toBe(200);
  });

  it('ramène un onglet caché à droite, marge comprise', () => {
    // Visite de 400 à 474 px : il faut voir jusqu'à 490 px dans 320 px.
    expect(defilementPourVoir({ debut: 400, largeur: 74 }, AU_REPOS)).toBe(170);
  });

  it('ramène un onglet caché à gauche, sans passer sous zéro', () => {
    const defile = { defilement: 300, largeurVisible: 320 };
    expect(defilementPourVoir({ debut: 120, largeur: 90 }, defile)).toBe(104);
    expect(defilementPourVoir({ debut: 10, largeur: 90 }, defile)).toBe(0);
  });

  it('montre le début d’un élément plus large que la bande', () => {
    expect(defilementPourVoir({ debut: 400, largeur: 500 }, AU_REPOS)).toBe(384);
  });

  it('accepte une marge nulle', () => {
    expect(defilementPourVoir({ debut: 400, largeur: 74 }, AU_REPOS, 0)).toBe(154);
  });
});
