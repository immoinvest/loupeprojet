import { describe, expect, it } from 'vitest';

import {
  CaptureSchema,
  CHAMPS_FICHE,
  FicheAnnonceSchema,
  LONGUEUR_MAX_DESCRIPTION,
  LONGUEUR_MAX_URL_PHOTO,
  PHOTOS_MAX,
  VERSION_CAPTURE,
} from '../src';

import { CAPTURE_COMPLETE, CAPTURE_MINIMALE } from './captures';

describe('CaptureSchema', () => {
  it('accepte une capture minimale (portail, url, date) et une capture complète', () => {
    expect(CaptureSchema.parse(CAPTURE_MINIMALE)).toEqual(CAPTURE_MINIMALE);
    expect(CaptureSchema.parse(CAPTURE_COMPLETE)).toEqual(CAPTURE_COMPLETE);
    expect(VERSION_CAPTURE).toBe(1);
  });

  it('ignore les clés inconnues et nettoie les espaces autour des textes', () => {
    const lue = CaptureSchema.parse({
      ...CAPTURE_MINIMALE,
      ville: '  Marseille ',
      telephoneVendeur: '0600000000',
    });
    expect(lue).toEqual({ ...CAPTURE_MINIMALE, ville: 'Marseille' });
    expect('telephoneVendeur' in lue).toBe(false);
  });

  it('accepte les trois modes de lecture, dont la lecture par le serveur de Deklic', () => {
    for (const mode of ['extension', 'bookmarklet', 'serveur'] as const) {
      expect(CaptureSchema.parse({ ...CAPTURE_MINIMALE, mode }).mode).toBe(mode);
    }
  });

  it.each<[string, Record<string, unknown>]>([
    ['une autre version du contrat', { version: 2 }],
    ['un portail inconnu', { portail: 'figaroimmo' }],
    ['une URL invalide', { url: 'pas une url' }],
    ['une date qui n’est pas ISO 8601', { captureLe: '13/09/2026' }],
    ['un prix négatif', { prix: -1 }],
    ['un prix infini', { prix: Number.POSITIVE_INFINITY }],
    ['une surface nulle', { surface: 0 }],
    ['des pièces non entières', { pieces: 2.5 }],
    ['un code postal à quatre chiffres', { codePostal: '1300' }],
    ['une classe énergie hors A–G', { dpe: 'H' }],
    ['un étage aberrant', { etage: 200 }],
    ['une année de construction aberrante', { anneeConstruction: 2999 }],
    ['une ville vide', { ville: '   ' }],
    ['un mode de capture inconnu', { mode: 'robot' }],
    ['une description trop longue', { description: 'a'.repeat(LONGUEUR_MAX_DESCRIPTION + 1) }],
    ['un ascenseur qui n’est pas un booléen', { ascenseur: 'oui' }],
    ['une photo en http', { photos: ['http://img.exemple.fr/1.jpg'] }],
    ['une photo en javascript:', { photos: ['javascript:alert(1)'] }],
    ['une liste de photos vide', { photos: [] }],
    [
      'plus de 30 photos',
      { photos: Array.from({ length: PHOTOS_MAX + 1 }, (_, i) => `https://i.fr/${String(i)}`) },
    ],
    [
      'une adresse de photo trop longue',
      { photos: [`https://i.fr/${'a'.repeat(LONGUEUR_MAX_URL_PHOTO)}`] },
    ],
    ['une énergie de chauffage inconnue', { chauffageEnergie: 'charbon' }],
    ['un état inconnu', { etat: 'neuf' }],
    ['des honoraires nuls', { honoraires: 0 }],
    ['une charge d’honoraires inconnue', { honorairesACharge: 'locataire' }],
    ['un vendeur inconnu', { vendeur: 'notaire' }],
    ['une date de DPE au format français', { dateDpe: '12/03/2025' }],
    ['une date de publication avec l’heure', { publieeLe: '2026-09-01T10:00:00Z' }],
    ['trop de salles d’eau', { sallesEau: 21 }],
    ['un immeuble aberrant', { etagesImmeuble: 101 }],
    ['une consommation aberrante', { consommationEnergie: 2_001 }],
    ['un budget énergie négatif', { budgetEnergieMin: -1 }],
    ['un quartier vide', { quartier: ' ' }],
  ])('refuse %s', (_, ecart) => {
    expect(CaptureSchema.safeParse({ ...CAPTURE_MINIMALE, ...ecart }).success).toBe(false);
  });

  it('accepte une description à la longueur maximale exactement', () => {
    const description = 'é'.repeat(LONGUEUR_MAX_DESCRIPTION);
    expect(CaptureSchema.parse({ ...CAPTURE_MINIMALE, description }).description).toBe(description);
  });
});

describe('FicheAnnonceSchema', () => {
  it('garde la description du bien, sans texte, photo, prix ni identifiant', () => {
    const fiche = FicheAnnonceSchema.parse(CAPTURE_COMPLETE);
    expect(fiche).toMatchObject({ chauffageEnergie: 'gaz', cave: true, vendeur: 'pro' });
    for (const exclu of ['description', 'photos', 'prix', 'id', 'url', 'ville']) {
      expect(exclu in fiche).toBe(false);
    }
    expect(CHAMPS_FICHE).toHaveLength(26);
    expect(CHAMPS_FICHE).toContain('publieeLe');
  });
});
