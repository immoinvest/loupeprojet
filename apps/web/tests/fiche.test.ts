import type { Capture, FicheAnnonce } from '@loupe/capture';
import { describe, expect, it } from 'vitest';

import { importerCapture } from '@/annonces';
import {
  annonceLue,
  exterieurDepuis,
  ficheDepuisCapture,
  honorairesAcquereur,
} from '@/annonces/fiche';
import { decoderPartage, encoderPartage } from '@/stockage/partage';
import {
  creerProjet,
  lireProjets,
  ecrireProjets,
  ProjetEnregistreSchema,
} from '@/stockage/projets';

const PHOTOS = ['https://img.exemple.fr/li-1.jpg', 'https://img.exemple.fr/li-2.jpg'];

/** Le studio Logic-Immo du 14/09/2026 (règles enrichies), tel que la lecture serveur le rend. */
const CAPTURE: Capture = {
  version: 1,
  portail: 'logicimmo',
  url: 'https://www.logic-immo.com/detail-annonce/vente/ile-de-france/paris-75/paris-75000/26H77PARXRYA',
  captureLe: '2026-09-14T12:00:00.000Z',
  mode: 'serveur',
  prix: 149_500,
  surface: 14,
  pieces: 1,
  codePostal: '75013',
  ville: 'Paris 13ème arrondissement',
  description: 'Studio rénové, emplacement exceptionnel.',
  photos: PHOTOS,
  chauffageEnergie: 'gaz',
  etat: 'renove',
  etagesImmeuble: 1,
  balcon: false,
  jardin: true,
  digicode: true,
  honoraires: 6_000,
  honorairesACharge: 'acquereur',
  vendeur: 'pro',
  quartier: 'Bièvres Sud Tolbiac',
  publieeLe: '2026-06-29',
};

const FICHE: FicheAnnonce = {
  chauffageEnergie: 'gaz',
  etat: 'renove',
  etagesImmeuble: 1,
  balcon: false,
  jardin: true,
  digicode: true,
  honoraires: 6_000,
  honorairesACharge: 'acquereur',
  vendeur: 'pro',
  quartier: 'Bièvres Sud Tolbiac',
  publieeLe: '2026-06-29',
};

describe('fiche du bien', () => {
  it('garde les champs descriptifs, jamais le texte, les photos ni le prix', () => {
    expect(ficheDepuisCapture(CAPTURE)).toEqual(FICHE);
  });

  it.each<[string, Pick<Capture, 'balcon' | 'terrasse' | 'jardin'>, boolean | undefined]>([
    ['un balcon', { balcon: true }, true],
    ['pas de balcon mais un jardin', { balcon: false, jardin: true }, true],
    ['les trois absents', { balcon: false, terrasse: false, jardin: false }, false],
    ['pas de balcon, le reste inconnu', { balcon: false }, undefined],
    ['rien', {}, undefined],
  ])('extérieur avec %s', (_, capture, attendu) => {
    expect(exterieurDepuis(capture)).toBe(attendu);
  });

  it('honoraires : comptés seulement à la charge de l’acquéreur', () => {
    expect(honorairesAcquereur(CAPTURE)).toBe(6_000);
    expect(
      honorairesAcquereur({ honoraires: 6_000, honorairesACharge: 'vendeur' }),
    ).toBeUndefined();
    expect(honorairesAcquereur({ honoraires: 6_000 })).toBeUndefined();
  });

  it('annonce à enregistrer : photos copiées, fiche seule, ou rien', () => {
    const avec = annonceLue(PHOTOS, FICHE, '2026-09-14T12:00:00.000Z');
    expect(avec).toEqual({ photos: PHOTOS, fiche: FICHE, lueLe: '2026-09-14T12:00:00.000Z' });
    expect(avec?.photos).not.toBe(PHOTOS);
    expect(annonceLue(undefined, { cave: true }, 'd')).toEqual({
      fiche: { cave: true },
      lueLe: 'd',
    });
    expect(annonceLue([], {}, 'd')).toBeUndefined();
    expect(annonceLue(undefined, {}, 'd')).toBeUndefined();
  });
});

describe('importerCapture · données enrichies', () => {
  it('état, extérieur et honoraires de l’acquéreur remplissent le formulaire ; photos et fiche suivent', () => {
    const importee = importerCapture(CAPTURE);
    expect(importee.champsPage).toMatchObject({
      etat: 'renove',
      exterieur: true,
      honorairesAgence: 6_000,
    });
    expect(importee.mode).toBe('serveur');
    expect(importee.photos).toEqual(PHOTOS);
    expect(importee.fiche).toEqual(FICHE);
  });

  it('honoraires à la charge du vendeur : pas d’honoraires préremplis', () => {
    const importee = importerCapture({ ...CAPTURE, honorairesACharge: 'vendeur' });
    expect(importee.champsPage.honorairesAgence).toBeUndefined();
  });
});

describe('projet enregistré avec son annonce', () => {
  const annonce = {
    photos: PHOTOS,
    fiche: ficheDepuisCapture(CAPTURE),
    lueLe: '2026-09-14T12:00:00.000Z',
  };

  it('garde photos, fiche et date ; se relit, et voyage dans le lien de partage', () => {
    const p = creerProjet({
      annonce,
      genererId: () => 'p1',
      maintenant: () => '2026-09-14T12:00:00.000Z',
    });
    expect(p.annonce).toEqual(annonce);
    ecrireProjets(window.localStorage, [p]);
    expect(lireProjets(window.localStorage)[0]?.annonce).toEqual(annonce);
    const recu = decoderPartage(encoderPartage(p));
    expect(recu.ok && recu.enregistre.annonce).toEqual(annonce);
  });

  it('écarte une annonce invalide plutôt que de rendre la liste illisible', () => {
    const p = creerProjet({ annonce: { ...annonce, photos: ['http://img.exemple.fr/1.jpg'] } });
    expect(p).not.toHaveProperty('annonce');
    expect(ProjetEnregistreSchema.safeParse(p).success).toBe(true);
  });

  it('un projet sans annonce reste valide', () => {
    const p = creerProjet();
    expect(p).not.toHaveProperty('annonce');
    expect(ProjetEnregistreSchema.safeParse(p).success).toBe(true);
  });
});
