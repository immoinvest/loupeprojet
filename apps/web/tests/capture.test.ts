import { encoderCapture, type Capture } from '@loupe/capture';
import { describe, expect, it } from 'vitest';

import { annonceDepuisCapture, champsDepuisCapture, lireFragmentCapture } from '@/annonces';

const CAPTURE: Capture = {
  version: 1,
  portail: 'leboncoin',
  url: 'https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851',
  id: '2214738851',
  prix: 155_000,
  surface: 65,
  pieces: 3,
  chambres: 2,
  ville: 'Marseille',
  codePostal: '13005',
  etage: 3,
  ascenseur: false,
  dpe: 'D',
  ges: 'B',
  chargesCopro: 90.4,
  taxeFonciere: 1_050,
  anneeConstruction: 1962,
  meuble: true,
  description:
    'Appartement T3 de 62 m² (surface Carrez) construit en 1958. Honoraires charge acquéreur : 7 000 € inclus. Loué meublé.',
  captureLe: '2026-09-13T10:41:00.000Z',
  mode: 'extension',
  regles: 'leboncoin-2026-09-13',
};

describe('champsDepuisCapture', () => {
  it('prend les champs structurés de la page, et le texte de la description pour les trous', () => {
    expect(champsDepuisCapture(CAPTURE)).toEqual({
      prix: 155_000,
      // La surface structurée (65) gagne sur celle du texte (62).
      surface: 65,
      pieces: 3,
      chambres: 2,
      etage: 3,
      ascenseur: false,
      dpe: 'D',
      ges: 'B',
      codePostal: '13005',
      ville: 'Marseille',
      // Idem pour l'année : 1962 (structuré) plutôt que 1958 (texte).
      annee: 1962,
      chargesCoproMois: 90,
      taxeFonciere: 1_050,
      meuble: true,
      // « Loué meublé » dans la description : le type de location lu par règles.
      mode: 'meuble',
      // Les honoraires ne sont pas dans le contrat de capture : ils viennent du texte.
      honorairesAgence: 7_000,
    });
  });

  it('rend un objet vide pour une capture sans champ ni description', () => {
    expect(
      champsDepuisCapture({
        version: 1,
        portail: 'pap',
        url: 'https://www.pap.fr/annonces/appartement-marseille-13005-r456789012',
        captureLe: '2026-09-13T10:41:00.000Z',
      }),
    ).toEqual({});
  });
});

describe('annonceDepuisCapture', () => {
  it('résout portail, identifiant et URL canonique depuis l’URL capturée', () => {
    expect(annonceDepuisCapture({ ...CAPTURE, url: `${CAPTURE.url}?utm_source=ext` })).toEqual({
      portail: 'leboncoin',
      id: '2214738851',
      urlCanonique: CAPTURE.url,
    });
  });

  it('se rabat sur la capture quand l’URL ne se résout pas', () => {
    const url = 'https://www.leboncoin.fr/recherche?category=9';
    expect(annonceDepuisCapture({ ...CAPTURE, url })).toEqual({
      portail: 'leboncoin',
      id: '2214738851',
      urlCanonique: url,
    });
    expect(annonceDepuisCapture({ ...CAPTURE, url, id: undefined })).toEqual({
      portail: 'leboncoin',
      id: url,
      urlCanonique: url,
    });
  });
});

describe('lireFragmentCapture', () => {
  it('distingue fragment absent, illisible et lu', () => {
    expect(lireFragmentCapture('')).toEqual({ statut: 'absente' });
    expect(lireFragmentCapture('#onglet=fiscalite')).toEqual({ statut: 'absente' });
    expect(lireFragmentCapture('#capture=***')).toEqual({ statut: 'illisible' });
    expect(
      lireFragmentCapture(`#capture=${encoderCapture({ ...CAPTURE, version: 2 as 1 })}`),
    ).toEqual({ statut: 'illisible' });

    const lue = lireFragmentCapture(`#capture=${encoderCapture(CAPTURE)}`);
    expect(lue.statut).toBe('lue');
    if (lue.statut !== 'lue') return;
    expect(lue.capture.mode).toBe('extension');
    expect(lue.capture.annonce.id).toBe('2214738851');
    expect(lue.capture.champs.prix).toBe(155_000);
  });

  it('garde le mode de capture (bouton-favori) et suppose l’extension à défaut', () => {
    const favori = lireFragmentCapture(
      `#capture=${encoderCapture({ ...CAPTURE, mode: 'bookmarklet' })}`,
    );
    expect(favori.statut === 'lue' && favori.capture.mode).toBe('bookmarklet');
    const sansMode = lireFragmentCapture(
      `#capture=${encoderCapture({ ...CAPTURE, mode: undefined })}`,
    );
    expect(sansMode.statut === 'lue' && sansMode.capture.mode).toBe('extension');
  });
});
