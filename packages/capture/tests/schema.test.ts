import { describe, expect, it } from 'vitest';

import { CaptureSchema, LONGUEUR_MAX_DESCRIPTION, VERSION_CAPTURE } from '../src';

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
      photos: ['https://img.exemple.fr/1.jpg'],
    });
    expect(lue).toEqual({ ...CAPTURE_MINIMALE, ville: 'Marseille' });
    expect('photos' in lue).toBe(false);
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
    ['un mode de capture inconnu', { mode: 'serveur' }],
    ['une description trop longue', { description: 'a'.repeat(LONGUEUR_MAX_DESCRIPTION + 1) }],
    ['un ascenseur qui n’est pas un booléen', { ascenseur: 'oui' }],
  ])('refuse %s', (_, ecart) => {
    expect(CaptureSchema.safeParse({ ...CAPTURE_MINIMALE, ...ecart }).success).toBe(false);
  });

  it('accepte une description à la longueur maximale exactement', () => {
    const description = 'é'.repeat(LONGUEUR_MAX_DESCRIPTION);
    expect(CaptureSchema.parse({ ...CAPTURE_MINIMALE, description }).description).toBe(description);
  });
});
