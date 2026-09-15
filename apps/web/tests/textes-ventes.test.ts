import { describe, expect, it } from 'vitest';

import type { VenteProcheAdresse } from '@/enrichissement';
import { dateCourte } from '@/formatage/nombres';
import {
  LIBELLES_COLONNES,
  LIBELLES_FILTRES,
  libelleFiltrePieces,
  phraseAnnexes,
  phraseDpe,
  phraseNombreVentes,
  phrasePage,
  phraseParcelle,
  phrasePrixDetail,
  phraseSurfaces,
  phraseTri,
  phraseTronquees,
} from '@/textes/ventes';

const n = (s: string | null): string | null => (s === null ? null : s.replace(/\s/g, ' '));

const BASE: VenteProcheAdresse = {
  date: '2025-03-01',
  prix: 240000,
  surface: 60,
  prixM2: 4000,
  pieces: 3,
  type: 'appartement',
  adresse: '144 RUE DE L OLIVIER',
  distanceMetres: 0,
  groupes: ['meme_parcelle'],
};

describe('textes du tableau des ventes', () => {
  it('libellés, pluriels, pages, tri', () => {
    expect(LIBELLES_COLONNES.prixAujourdhui).toBe("Au prix d'aujourd'hui");
    expect(LIBELLES_FILTRES.passoires).toBe('DPE F ou G');
    expect(libelleFiltrePieces(1)).toBe('1 pièce');
    expect(libelleFiltrePieces(3)).toBe('3 pièces');
    expect(phrasePage(2, 7)).toBe('Page 2 sur 7');
    expect(phraseNombreVentes(1)).toBe('1 vente');
    expect(phraseNombreVentes(42)).toBe('42 ventes');
    expect(n(phraseTronquees(300, 1240))).toBe('Les 300 ventes les plus proches sur 1 240.');
    expect(phraseTri('prixM2', true)).toBe('Tri par Prix au m², croissant');
    expect(phraseTri('dpe', false)).toBe('Tri par DPE, décroissant');
  });

  it('prix : à la signature, aujourd’hui, ramené à la surface du bien', () => {
    expect(n(phrasePrixDetail(BASE))).toBe('4 000 €/m² à la signature');
    expect(
      n(
        phrasePrixDetail({
          ...BASE,
          prixM2Actualise: 4120,
          coefficient: 1.03,
          prixM2Corrige: 4150,
          correctionSurface: 1.0073,
        }),
      ),
    ).toBe(
      "4 000 €/m² à la signature → 4 120 €/m² aujourd'hui (× 1,030) → 4 150 €/m² ramené à la surface du bien (× 1,007)",
    );
  });

  it('surfaces, annexes, parcelle', () => {
    expect(n(phraseSurfaces({ ...BASE, carrez: 58.5 }))).toBe(
      '60 m², dont 58,5 m² Carrez · 3 pièces',
    );
    expect(n(phraseSurfaces({ ...BASE, pieces: 0, carrez: null }))).toBe('60 m²');
    expect(n(phraseAnnexes({ ...BASE, dependances: 1, terrain: 850, lots: 2 }))).toBe(
      '1 dépendance vendue avec (cave, parking…) · terrain de 850 m² · 2 lots de copropriété',
    );
    expect(n(phraseAnnexes({ ...BASE, dependances: 2, lots: 1 }))).toBe(
      '2 dépendances vendues avec (cave, parking…) · 1 lot de copropriété',
    );
    expect(phraseAnnexes({ ...BASE, dependances: 0, terrain: null, lots: null })).toBeNull();
    expect(phraseAnnexes(BASE)).toBeNull();
    expect(phraseParcelle({ ...BASE, parcelle: '132058200E0318' })).toBe(
      'Parcelle cadastrale 132058200E0318',
    );
    expect(phraseParcelle({ ...BASE, parcelle: null })).toBeNull();
  });

  it('DPE probable complet ou réduit à l’étiquette', () => {
    expect(
      n(
        phraseDpe({
          etiquetteDpe: 'D',
          etiquetteGes: 'E',
          consommationM2: 232,
          periodeConstruction: '1948-1974',
          energieChauffage: 'Gaz naturel',
          date: '2024-12-10',
          surface: 62,
        }),
      ),
    ).toBe(
      n(
        `DPE D, GES E, 232 kWh/m²/an, établi le ${dateCourte('2024-12-10')} pour 62 m² · période de construction : 1948-1974 · chauffage : gaz naturel`,
      ),
    );
    expect(
      n(
        phraseDpe({
          etiquetteDpe: 'G',
          etiquetteGes: null,
          consommationM2: null,
          periodeConstruction: null,
          energieChauffage: null,
          date: '2024-12-10',
          surface: 64.1,
        }),
      ),
    ).toBe(n(`DPE G, établi le ${dateCourte('2024-12-10')} pour 64,1 m²`));
  });
});
