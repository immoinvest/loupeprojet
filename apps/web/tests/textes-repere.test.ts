import { describe, expect, it } from 'vitest';

import type { ReferenceAdresse } from '@/enrichissement';
import { PHRASES_REPERE, phraseRepereApplique, phraseRepereNonApplique } from '@/textes/repere';

const n = (s: string): string => s.replace(/\s/g, ' ');

const STATS = { ventes: 6, medianeM2: 3600, q1M2: 3440, q3M2: 3750, minM2: 2929, maxM2: 4000 };
const REFERENCE: ReferenceAdresse = { code: 'meme_cote', rayonMetres: 90, statistiques: STATS };

describe('textes du repère de l’adresse', () => {
  it('appliqué, non appliqué, protégé', () => {
    expect(n(phraseRepereApplique(REFERENCE))).toBe(
      'Repère appliqué : même côté de la rue, 6 ventes comparables, médiane 3 600 €/m².',
    );
    expect(
      n(
        phraseRepereNonApplique({
          ...REFERENCE,
          code: 'rayon_100',
          statistiques: { ...STATS, ventes: 1 },
        }),
      ),
    ).toBe(
      'Repère de l’adresse non appliqué : à moins de 100 m, 1 vente comparable, médiane 3 600 €/m².',
    );
    expect(PHRASES_REPERE.remplacer).toBe('Remplacer par le repère de l’adresse');
    expect(PHRASES_REPERE.protege).toBe('Votre repère saisi dans Hypothèses est conservé.');
  });
});
