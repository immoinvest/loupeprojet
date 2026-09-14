import { calculerProjet, projetExemple } from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import { HORIZONS, variantesRevente } from '@/analyses';
import { descripteurParChemin } from '@/hypotheses';

describe('variantesRevente', () => {
  it('projette le même bien à 5, 10, 15 et 20 ans', () => {
    const v = variantesRevente(projetExemple);
    expect(v.map((x) => x.annees)).toEqual([...HORIZONS]);
    expect(v[1]?.cashNetVendeur).toBeCloseTo(
      calculerProjet(projetExemple).revente!.cashNetVendeur,
      6,
    );
    expect(v[3]!.valeur).toBeGreaterThan(v[0]!.valeur);
    expect(v[3]!.cashNetVendeur).toBeGreaterThan(v[0]!.cashNetVendeur);
    for (const x of v) {
      expect(x.tri).not.toBeNull();
      expect(Number.isFinite(x.enrichissement)).toBe(true);
      expect(x.impotPlusValue).toBeGreaterThanOrEqual(0);
    }
  });

  it('accepte des horizons sur mesure', () => {
    const v = variantesRevente(projetExemple, [3, 25]);
    expect(v.map((x) => x.annees)).toEqual([3, 25]);
  });

  it('ne rend rien pour un projet sans loyer : aucune revente calculable', () => {
    const location = Object.fromEntries(
      Object.entries(projetExemple.hypotheses.location).filter(([k]) => k !== 'loyerHc'),
    );
    const sansLoyer = {
      ...projetExemple,
      hypotheses: { ...projetExemple.hypotheses, location },
    } as typeof projetExemple;
    expect(variantesRevente(sansLoyer)).toEqual([]);
  });
});

describe('descripteurParChemin', () => {
  it('retrouve un champ éditable et refuse un chemin inconnu', () => {
    expect(descripteurParChemin('hypotheses.revente.annees').libelle).toBe('Revente dans');
    expect(() => descripteurParChemin('hypotheses.inconnu')).toThrow(/Aucun descripteur/);
  });
});
