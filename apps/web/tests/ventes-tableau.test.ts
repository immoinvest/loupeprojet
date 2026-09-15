import { describe, expect, it } from 'vitest';

import {
  dateMoinsJours,
  filtrerVentes,
  pageDe,
  prixAujourdhui,
  SANS_FILTRE,
  TRI_DEFAUT,
  trierVentes,
  triSuivant,
  valeurDeTri,
  type VenteProcheAdresse,
} from '@/enrichissement';

const BASE: VenteProcheAdresse = {
  date: '2025-03-01',
  prix: 240000,
  surface: 60,
  prixM2: 4000,
  pieces: 3,
  type: 'appartement',
  adresse: '144 RUE DE L OLIVIER',
  distanceMetres: 0,
  groupes: ['meme_parcelle', 'meme_cote', 'rayon_100'],
};

const vente = (o: Partial<VenteProcheAdresse>): VenteProcheAdresse => ({ ...BASE, ...o });

const DPE = {
  etiquetteGes: null,
  consommationM2: null,
  periodeConstruction: null,
  energieChauffage: null,
  date: '2024-11-06',
  surface: 60,
} as const;

const dpe = (etiquetteDpe: 'A' | 'D' | 'F' | 'G'): VenteProcheAdresse['dpe'] => ({
  ...DPE,
  etiquetteDpe,
});

describe('valeurs de tri', () => {
  it('lit chaque colonne ; pièces à 0 et DPE absent sont inconnus', () => {
    const v = vente({ prixM2Actualise: 4100, prixM2Corrige: 4150, dpe: dpe('G') });
    expect(valeurDeTri(v, 'date')).toBe('2025-03-01');
    expect(valeurDeTri(v, 'surface')).toBe(60);
    expect(valeurDeTri(v, 'pieces')).toBe(3);
    expect(valeurDeTri(vente({ pieces: 0 }), 'pieces')).toBeNull();
    expect(valeurDeTri(v, 'prix')).toBe(240000);
    expect(valeurDeTri(v, 'prixM2')).toBe(4000);
    expect(valeurDeTri(v, 'prixAujourdhui')).toBe(4150);
    expect(valeurDeTri(v, 'distance')).toBe(0);
    expect(valeurDeTri(v, 'dpe')).toBe(6);
    expect(valeurDeTri(vente({ dpe: dpe('A') }), 'dpe')).toBe(0);
    expect(valeurDeTri(vente({ dpe: null }), 'dpe')).toBeNull();
    expect(valeurDeTri(BASE, 'dpe')).toBeNull();
  });

  it('prix d’aujourd’hui : corrigé, sinon actualisé, sinon celui de l’acte', () => {
    expect(prixAujourdhui(vente({ prixM2Actualise: 4100, prixM2Corrige: 4150 }))).toBe(4150);
    expect(prixAujourdhui(vente({ prixM2Actualise: 4100 }))).toBe(4100);
    expect(prixAujourdhui(BASE)).toBe(4000);
  });
});

describe('tri', () => {
  const a = vente({ adresse: 'a', distanceMetres: 40, prixM2: 3000, dpe: dpe('D') });
  const b = vente({ adresse: 'b', distanceMetres: null, prixM2: 3500 });
  const c = vente({ adresse: 'c', distanceMetres: 12, prixM2: 3000, dpe: dpe('F') });
  const d = vente({ adresse: 'd', distanceMetres: null, prixM2: 2500, dpe: dpe('A') });
  const adresses = (liste: readonly VenteProcheAdresse[]): (string | null)[] =>
    liste.map((v) => v.adresse);

  it('par défaut, du plus près au plus loin ; sans distance à la fin, dans l’ordre reçu', () => {
    expect(adresses(trierVentes([a, b, c, d], TRI_DEFAUT))).toEqual(['c', 'a', 'b', 'd']);
    expect(adresses(trierVentes([a, b, c, d], { cle: 'distance', sens: 'decroissant' }))).toEqual([
      'a',
      'c',
      'b',
      'd',
    ]);
  });

  it('tri stable à égalité ; DPE de A à G, inconnus à la fin dans les deux sens', () => {
    expect(adresses(trierVentes([a, b, c, d], { cle: 'prixM2', sens: 'croissant' }))).toEqual([
      'd',
      'a',
      'c',
      'b',
    ]);
    expect(adresses(trierVentes([a, b, c, d], { cle: 'dpe', sens: 'croissant' }))).toEqual([
      'd',
      'a',
      'c',
      'b',
    ]);
    expect(adresses(trierVentes([a, b, c, d], { cle: 'dpe', sens: 'decroissant' }))).toEqual([
      'c',
      'a',
      'd',
      'b',
    ]);
    expect(
      adresses(
        trierVentes([vente({ adresse: 'x', date: '2024-01-01' }), a], {
          cle: 'date',
          sens: 'croissant',
        }),
      ),
    ).toEqual(['x', 'a']);
  });

  it('un clic sur la même colonne inverse le sens, une autre colonne repart en croissant', () => {
    expect(triSuivant(TRI_DEFAUT, 'distance')).toEqual({ cle: 'distance', sens: 'decroissant' });
    expect(triSuivant({ cle: 'distance', sens: 'decroissant' }, 'distance')).toEqual(TRI_DEFAUT);
    expect(triSuivant({ cle: 'prix', sens: 'decroissant' }, 'dpe')).toEqual({
      cle: 'dpe',
      sens: 'croissant',
    });
  });
});

describe('filtres', () => {
  const immeuble = vente({ adresse: 'immeuble', date: '2025-06-30', dpe: dpe('G') });
  const ancienne = vente({
    adresse: 'ancienne',
    date: '2023-06-29',
    groupes: ['rayon_200'],
    pieces: 2,
    dpe: dpe('F'),
  });
  const limite = vente({ adresse: 'limite', date: '2023-07-01', groupes: ['en_face'] });
  const liste = [immeuble, ancienne, limite];
  const adresses = (l: readonly VenteProcheAdresse[]): (string | null)[] => l.map((v) => v.adresse);

  it('sans filtre, tout ; chaque filtre seul ; filtres cumulés', () => {
    expect(filtrerVentes(liste, SANS_FILTRE, 3)).toEqual(liste);
    expect(adresses(filtrerVentes(liste, { ...SANS_FILTRE, memeImmeuble: true }, 3))).toEqual([
      'immeuble',
    ]);
    // 730 jours avant le 30/06/2025 : le 01/07/2023.
    expect(dateMoinsJours('2025-06-30', 730)).toBe('2023-07-01');
    expect(adresses(filtrerVentes(liste, { ...SANS_FILTRE, recentes: true }, 3))).toEqual([
      'immeuble',
      'limite',
    ]);
    expect(adresses(filtrerVentes(liste, { ...SANS_FILTRE, memesPieces: true }, 2))).toEqual([
      'ancienne',
    ]);
    expect(
      adresses(filtrerVentes(liste, { ...SANS_FILTRE, memesPieces: true }, undefined)),
    ).toEqual([]);
    expect(adresses(filtrerVentes(liste, { ...SANS_FILTRE, passoires: true }, 3))).toEqual([
      'immeuble',
      'ancienne',
    ]);
    expect(
      adresses(filtrerVentes(liste, { ...SANS_FILTRE, passoires: true, recentes: true }, 3)),
    ).toEqual(['immeuble']);
    expect(filtrerVentes([], { ...SANS_FILTRE, recentes: true }, 3)).toEqual([]);
  });
});

describe('pages', () => {
  const nombres = Array.from({ length: 45 }, (_, i) => i + 1);

  it('20 par page, page ramenée entre 1 et le nombre de pages', () => {
    expect(pageDe(nombres, 1)).toMatchObject({ page: 1, pages: 3 });
    expect(pageDe(nombres, 1).lignes).toHaveLength(20);
    expect(pageDe(nombres, 3).lignes).toEqual([41, 42, 43, 44, 45]);
    expect(pageDe(nombres, 0).page).toBe(1);
    expect(pageDe(nombres, 99).page).toBe(3);
    expect(pageDe(nombres, 2.7).lignes[0]).toBe(21);
    expect(pageDe([], 4)).toEqual({ lignes: [], page: 1, pages: 1 });
    expect(pageDe(nombres, 2, 10).lignes[0]).toBe(11);
  });
});
