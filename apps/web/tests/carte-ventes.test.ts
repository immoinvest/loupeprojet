import { describe, expect, it } from 'vitest';

import {
  classePrix,
  donneesCarte,
  repereCarte,
  URL_TUILES_IGN,
  type ReponseAdresse,
  type VenteCarte,
} from '@/enrichissement';
import {
  legendeCarte,
  libelleAccessibleCarte,
  libelleVenteCarte,
  PHRASES_CARTE,
  phraseCarte,
} from '@/textes/carte';

const n = (s: string): string => s.replace(/\s/g, ' ');

const STATS = { ventes: 6, medianeM2: 3600, q1M2: 3440, q3M2: 3750, minM2: 2929, maxM2: 4000 };

function vente(prixM2Corrige: number, distanceMetres = 40): VenteCarte {
  return {
    lat: 43.2949,
    lon: 5.3939,
    date: '2025-03-01',
    prix: 210_000,
    surface: 58,
    prixM2Corrige,
    distanceMetres,
    groupes: ['meme_cote', 'rayon_100'],
  };
}

const CERCLE_300 = {
  code: 'rayon_300' as const,
  ventes: 9,
  comparables: 8,
  statistiques: { ...STATS, q1M2: 3000, q3M2: 4000 },
  distanceMaxMetres: 280,
};

const ANALYSE: ReponseAdresse = {
  codeInsee: '13205',
  millesime: '2025',
  parcelle: null,
  parcellesVoisines: [],
  cadastre: 'ok',
  ventesCommune: 10,
  groupes: [CERCLE_300],
  reference: { code: 'meme_cote', rayonMetres: 90, statistiques: STATS },
  ventesProches: [],
  sources: [],
  ventesCarte: [vente(3200, 12), vente(3600), vente(3900, 150)],
};

describe('carte des ventes : données', () => {
  it('tuiles du Plan IGN en web Mercator, sans clé', () => {
    expect(URL_TUILES_IGN.startsWith('https://data.geopf.fr/wmts?')).toBe(true);
    expect(URL_TUILES_IGN).toContain('LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2');
    expect(URL_TUILES_IGN).toContain('TILEMATRIXSET=PM');
    expect(URL_TUILES_IGN).toMatch(/TILEMATRIX=\{z\}&TILEROW=\{y\}&TILECOL=\{x\}$/);
    expect(URL_TUILES_IGN).not.toMatch(/apikey/i);
  });

  it('repère : celui de l’analyse, sinon le cercle de 300 m, sinon aucun', () => {
    expect(repereCarte(ANALYSE)).toEqual({ q1M2: 3440, q3M2: 3750 });
    expect(repereCarte({ ...ANALYSE, reference: null })).toEqual({ q1M2: 3000, q3M2: 4000 });
    expect(
      repereCarte({
        ...ANALYSE,
        reference: null,
        groupes: [{ ...CERCLE_300, statistiques: null }],
      }),
    ).toBeNull();
    expect(repereCarte({ ...ANALYSE, reference: null, groupes: [] })).toBeNull();
  });

  it('classe chaque prix : sous le premier quart, entre les quarts, au-dessus du troisième', () => {
    const repere = { q1M2: 3440, q3M2: 3750 };
    expect(classePrix(3439, repere)).toBe('bas');
    expect(classePrix(3440, repere)).toBe('milieu');
    expect(classePrix(3750, repere)).toBe('milieu');
    expect(classePrix(3751, repere)).toBe('haut');
    expect(classePrix(9999, null)).toBe('milieu');
  });

  it('points classés ; rien sans vente géolocalisée ni avec un Worker d’avant la carte', () => {
    const donnees = donneesCarte(ANALYSE);
    expect(donnees?.repere).toEqual({ q1M2: 3440, q3M2: 3750 });
    expect(donnees?.points.map((p) => [p.distanceMetres, p.classe])).toEqual([
      [12, 'bas'],
      [40, 'milieu'],
      [150, 'haut'],
    ]);
    expect(donneesCarte({ ...ANALYSE, ventesCarte: [] })).toBeNull();
    expect(donneesCarte({ ...ANALYSE, ventesCarte: undefined })).toBeNull();
  });
});

describe('carte des ventes : textes', () => {
  it('phrase, libellé pour lecteur d’écran, légende et infobulle', () => {
    expect(n(phraseCarte(18))).toContain('18 ventes comparables à 300 m au plus');
    expect(phraseCarte(1)).toContain('1 vente comparable à 300 m au plus');
    expect(n(libelleAccessibleCarte(18))).toBe(
      'Carte des ventes comparables autour du bien : 18 points.',
    );
    expect(libelleAccessibleCarte(1)).toBe(
      'Carte des ventes comparables autour du bien : 1 point.',
    );
    expect(legendeCarte({ q1M2: 3440, q3M2: 3750 }).map((e) => [e.classe, n(e.libelle)])).toEqual([
      ['bas', 'Moins de 3 440 €/m²'],
      ['milieu', 'Entre 3 440 €/m² et 3 750 €/m²'],
      ['haut', 'Plus de 3 750 €/m²'],
    ]);
    expect(legendeCarte(null)).toEqual([{ classe: 'milieu', libelle: 'Ventes comparables' }]);
    expect(n(libelleVenteCarte({ ...vente(3621), classe: 'milieu' }))).toBe(
      '3 621 €/m² · 58 m² · 210 000 € · 1 mars 2025 · à 40 m',
    );
    expect(PHRASES_CARTE.fondDeCarte).toContain('Plan IGN (Géoplateforme)');
  });
});
