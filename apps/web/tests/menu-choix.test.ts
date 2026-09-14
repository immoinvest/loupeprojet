import { describe, expect, it } from 'vitest';

import { indexParLettre, indexSuivant, placementListe } from '@/composants/menu-choix';
import { STATUTS } from '@/stockage/projets';
import { ORDRE_STATUTS, PRECISIONS_STATUT } from '@/textes/statut';

describe('indexSuivant', () => {
  it('flèches sans boucle, Début et Fin', () => {
    expect(indexSuivant(0, 'ArrowDown', 6)).toBe(1);
    expect(indexSuivant(5, 'ArrowDown', 6)).toBe(5);
    expect(indexSuivant(3, 'ArrowUp', 6)).toBe(2);
    expect(indexSuivant(0, 'ArrowUp', 6)).toBe(0);
    expect(indexSuivant(3, 'Home', 6)).toBe(0);
    expect(indexSuivant(1, 'End', 6)).toBe(5);
  });

  it('une autre touche ou une liste vide ne déplace rien', () => {
    expect(indexSuivant(2, 'a', 6)).toBeNull();
    expect(indexSuivant(0, 'ArrowDown', 0)).toBeNull();
  });
});

describe('indexParLettre', () => {
  const libelles = ['En analyse', 'Visite prévue', 'Offre faite', 'Acheté', 'Scénario', 'Écarté'];

  it('la prochaine option qui commence par la lettre, accents et majuscules ignorés', () => {
    expect(indexParLettre(libelles, 0, 'o')).toBe(2);
    expect(indexParLettre(libelles, 0, 'E')).toBe(5);
    // Depuis « Écarté », on repart du début : « En analyse ».
    expect(indexParLettre(libelles, 5, 'é')).toBe(0);
    expect(indexParLettre(libelles, 3, 'a')).toBe(3);
  });

  it('aucune correspondance, touche longue ou espace : rien', () => {
    expect(indexParLettre(libelles, 0, 'z')).toBeNull();
    expect(indexParLettre(libelles, 0, 'Shift')).toBeNull();
    expect(indexParLettre(libelles, 0, ' ')).toBeNull();
    expect(indexParLettre([], 0, 'a')).toBeNull();
  });
});

describe('placementListe', () => {
  it('dessous quand la place suffit', () => {
    expect(placementListe({ haut: 100, bas: 144 }, 300, 800)).toBe('dessous');
  });

  it('dessus quand la place manque dessous et qu’il y en a davantage au-dessus', () => {
    expect(placementListe({ haut: 600, bas: 644 }, 300, 800)).toBe('dessus');
  });

  it('dessous quand la place manque partout mais qu’il y en a davantage dessous', () => {
    expect(placementListe({ haut: 150, bas: 194 }, 400, 450)).toBe('dessous');
  });
});

describe('ordre des statuts', () => {
  it('le parcours puis les « à côté », chaque statut une seule fois', () => {
    const tous = ORDRE_STATUTS.flatMap((g) => g.statuts);
    expect(tous.map((s) => STATUTS[s])).toEqual([
      'En analyse',
      'Visite prévue',
      'Offre faite',
      'Acheté',
      'Scénario',
      'Écarté',
    ]);
    expect(new Set(tous).size).toBe(Object.keys(STATUTS).length);
    expect(PRECISIONS_STATUT).toEqual({ scenario: 'pour comparer', ecarte: 'on n’y va pas' });
  });
});
