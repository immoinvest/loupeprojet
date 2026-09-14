import { describe, expect, it } from 'vitest';

import {
  CHEMIN_NOUVEAU_PROJET,
  CLE_FRAGMENT,
  captureDepuisHash,
  decoderCapture,
  encoderCapture,
  urlDeCapture,
  type Capture,
} from '../src';

import { CAPTURE_COMPLETE, CAPTURE_MINIMALE } from './captures';

/** Encode un texte arbitraire en base64url, pour forger des fragments invalides. */
function base64url(texte: string): string {
  return btoa(texte).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('encoderCapture / decoderCapture', () => {
  it('rend la capture à l’identique, accents, apostrophes et symboles compris', () => {
    const capture: Capture = {
      ...CAPTURE_COMPLETE,
      ville: 'Aix-en-Provence',
      description: "Appartement « cosy » de 65 m² à l'étage, DPE D — 155 000 € FAI ✓",
    };
    const encode = encoderCapture(capture);
    expect(encode).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decoderCapture(encode)).toEqual({ ok: true, capture });
  });

  it('produit un texte sans « = » quel que soit le reste de la division par trois', () => {
    for (const longueur of [0, 1, 2, 3, 4, 5]) {
      const capture = { ...CAPTURE_MINIMALE, description: 'x'.repeat(longueur) };
      const encode = encoderCapture(capture);
      expect(encode).not.toContain('=');
      expect(decoderCapture(encode)).toEqual({ ok: true, capture });
    }
  });

  it('signale un encodage illisible : caractères hors base64url, longueur impossible, vide', () => {
    expect(decoderCapture('abc$')).toEqual({ ok: false, raison: 'encodage' });
    expect(decoderCapture('A')).toEqual({ ok: false, raison: 'encodage' });
    expect(decoderCapture('')).toEqual({ ok: false, raison: 'encodage' });
  });

  it('signale un JSON illisible : texte tronqué ou octets qui ne sont pas de l’UTF-8', () => {
    expect(decoderCapture(base64url('{"version":1,'))).toEqual({ ok: false, raison: 'json' });
    expect(decoderCapture(base64url('ÿþ'))).toEqual({ ok: false, raison: 'json' });
  });

  it('signale un objet hors schéma : version inconnue, champ manquant, tableau', () => {
    expect(decoderCapture(base64url(JSON.stringify({ ...CAPTURE_MINIMALE, version: 7 })))).toEqual({
      ok: false,
      raison: 'schema',
    });
    expect(decoderCapture(base64url(JSON.stringify({ portail: 'pap' })))).toEqual({
      ok: false,
      raison: 'schema',
    });
    expect(decoderCapture(base64url('[1,2,3]'))).toEqual({ ok: false, raison: 'schema' });
  });

  it('ignore les clés inconnues au décodage (compatibilité ascendante d’une capture enrichie)', () => {
    const encode = base64url(JSON.stringify({ ...CAPTURE_MINIMALE, telephoneVendeur: '06' }));
    expect(decoderCapture(encode)).toEqual({ ok: true, capture: CAPTURE_MINIMALE });
  });

  it('refuse une capture dont les photos ne sont pas des adresses https (champ connu, donc validé)', () => {
    const encode = base64url(JSON.stringify({ ...CAPTURE_MINIMALE, photos: ['a', 'b'] }));
    expect(decoderCapture(encode)).toEqual({ ok: false, raison: 'schema' });
  });
});

describe('urlDeCapture / captureDepuisHash', () => {
  it('construit l’URL de l’écran Nouveau projet avec la capture dans le fragment', () => {
    const url = urlDeCapture('https://loupeprojet.pages.dev/', CAPTURE_COMPLETE);
    expect(url.startsWith(`https://loupeprojet.pages.dev${CHEMIN_NOUVEAU_PROJET}#`)).toBe(true);
    const hash = new URL(url).hash;
    expect(hash.startsWith(`#${CLE_FRAGMENT}=`)).toBe(true);
    expect(captureDepuisHash(hash)).toEqual({ ok: true, capture: CAPTURE_COMPLETE });
  });

  it('accepte une base sans barre finale et en localhost', () => {
    expect(urlDeCapture('http://localhost:5173', CAPTURE_MINIMALE)).toMatch(
      /^http:\/\/localhost:5173\/projets\/nouveau#capture=[A-Za-z0-9_-]+$/,
    );
  });

  it('rend null sans fragment ou sans clé capture, et lit la clé parmi d’autres paramètres', () => {
    expect(captureDepuisHash('')).toBeNull();
    expect(captureDepuisHash('#')).toBeNull();
    expect(captureDepuisHash('#onglet=fiscalite')).toBeNull();
    const encode = encoderCapture(CAPTURE_MINIMALE);
    expect(captureDepuisHash(`#onglet=fiscalite&capture=${encode}`)).toEqual({
      ok: true,
      capture: CAPTURE_MINIMALE,
    });
    expect(captureDepuisHash(`capture=${encode}`)).toEqual({ ok: true, capture: CAPTURE_MINIMALE });
  });

  it('rend la raison du refus quand le fragment est présent mais forgé', () => {
    expect(captureDepuisHash('#capture=***')).toEqual({ ok: false, raison: 'encodage' });
  });
});
