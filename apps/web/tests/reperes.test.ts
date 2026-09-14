import { describe, expect, it } from 'vitest';

import { rangerLibelles } from '@/analyses/reperes';

describe('rangerLibelles', () => {
  it('laisse sur une ligne des libellés éloignés', () => {
    const lignes = rangerLibelles([
      { centre: 50, largeur: 90 },
      { centre: 300, largeur: 110 },
      { centre: 550, largeur: 80 },
    ]);
    expect(lignes).toEqual([0, 0, 0]);
  });

  // Cas du rapport : « 3 023, à rénover » et « 3 088 €/m², estimé » à 40 px l'un de l'autre.
  it('descend d’une ligne le libellé qui chevaucherait son voisin', () => {
    const lignes = rangerLibelles([
      { centre: 235, largeur: 95 },
      { centre: 275, largeur: 110 },
      { centre: 555, largeur: 70 },
    ]);
    expect(lignes).toEqual([0, 1, 0]);
  });

  it('remonte sur la première ligne dès que la place est libre', () => {
    const lignes = rangerLibelles([
      { centre: 100, largeur: 100 },
      { centre: 120, largeur: 100 },
      { centre: 240, largeur: 100 },
    ]);
    expect(lignes).toEqual([0, 1, 0]);
  });

  it('empile trois libellés superposés sur trois lignes, quel que soit l’ordre reçu', () => {
    const lignes = rangerLibelles([
      { centre: 210, largeur: 100 },
      { centre: 200, largeur: 100 },
      { centre: 205, largeur: 100 },
    ]);
    expect(lignes).toEqual([2, 0, 1]);
  });

  it('exige l’écart minimal entre deux libellés', () => {
    expect(
      rangerLibelles(
        [
          { centre: 50, largeur: 100 },
          { centre: 155, largeur: 100 },
        ],
        8,
      ),
    ).toEqual([0, 1]);
    expect(rangerLibelles([], 8)).toEqual([]);
  });
});
