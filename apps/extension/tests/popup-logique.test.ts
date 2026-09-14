import type { Capture } from '@loupe/capture';
import { describe, expect, it } from 'vitest';

import { etatPourUrl, messagePourRaison, resumeCapture } from '../src/logique/popup';

const CAPTURE: Capture = {
  version: 1,
  portail: 'leboncoin',
  url: 'https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851',
  captureLe: '2026-09-13T10:41:00.000Z',
};

/** Espace fine insécable : le séparateur de milliers français d'Intl.NumberFormat. */
const FINE = String.fromCharCode(0x20_2f);

describe('etatPourUrl', () => {
  it('reconnaît une annonce, une page qui n’en est pas une, et l’absence d’onglet', () => {
    expect(
      etatPourUrl('https://www.pap.fr/annonces/appartement-marseille-13005-r456789012'),
    ).toEqual({
      statut: 'annonce',
      portail: 'pap',
      message: 'Annonce pap.fr reconnue. Un clic, et Deklic la lit.',
    });
    expect(etatPourUrl('https://www.pap.fr/annonce/vente-appartement-marseille-13')).toMatchObject({
      statut: 'hors-annonce',
    });
    expect(etatPourUrl('chrome://extensions')).toMatchObject({ statut: 'hors-annonce' });
    expect(etatPourUrl(undefined)).toMatchObject({
      statut: 'sans-onglet',
      message: expect.stringContaining('Ouvrez une annonce') as string,
    });
  });
});

describe('resumeCapture', () => {
  it('résume ce qui a été lu, en français', () => {
    expect(
      resumeCapture({
        ...CAPTURE,
        prix: 155_000,
        surface: 65,
        ville: 'Marseille',
        codePostal: '13005',
      }),
    ).toBe(`155${FINE}000 € · 65 m² · Marseille (13005)`);
    expect(resumeCapture({ ...CAPTURE, surface: 32.5, ville: 'Ajaccio' })).toBe(
      '32.5 m² · Ajaccio',
    );
    expect(resumeCapture(CAPTURE)).toBe('aucun chiffre reconnu, tout reste à saisir');
  });
});

describe('messagePourRaison', () => {
  it('a une phrase pour chaque raison', () => {
    expect(messagePourRaison('hors-annonce')).toMatch(/pas une annonce/);
    expect(messagePourRaison('portail-sans-regles')).toMatch(/Collez le lien/);
    expect(messagePourRaison('permission')).toMatch(/Autoriser la lecture automatique/);
    expect(messagePourRaison('chargement')).toMatch(/pas pu être chargée/);
    expect(messagePourRaison('vide')).toMatch(/Rien n'a pu être lu/);
    expect(messagePourRaison('occupe')).toMatch(/déjà en cours/);
  });
});
