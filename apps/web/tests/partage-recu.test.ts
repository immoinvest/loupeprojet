import { describe, expect, it } from 'vitest';

import { LONGUEUR_MAX_TEXTE_PARTAGE, annoncePartagee, lirePartageRecu } from '@/annonces';

const LEBONCOIN = 'https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851';
const SELOGER = 'https://www.seloger.com/annonces/achat/appartement/lyon-3eme-69/123456789.htm';

function recherche(parametres: Record<string, string>): string {
  return `?${new URLSearchParams(parametres).toString()}`;
}

describe('lirePartageRecu (annonce partagée vers Deklic)', () => {
  it('rien de partagé, ou des paramètres vides : absent', () => {
    expect(lirePartageRecu('')).toEqual({ statut: 'absent' });
    expect(lirePartageRecu('?autre=1')).toEqual({ statut: 'absent' });
    expect(lirePartageRecu(recherche({ titre: '', texte: '  ', lien: '' }))).toEqual({
      statut: 'absent',
    });
  });

  it('Android : le lien est dans le texte, suivi de ponctuation', () => {
    expect(lirePartageRecu(recherche({ texte: `Regarde cette annonce ${LEBONCOIN}.` }))).toEqual({
      statut: 'recu',
      url: LEBONCOIN,
    });
    expect(lirePartageRecu(recherche({ texte: `(voir ${LEBONCOIN}) !` }))).toEqual({
      statut: 'recu',
      url: LEBONCOIN,
    });
  });

  it('lien seul, ou trouvé dans le titre quand lien et texte n’en ont pas', () => {
    expect(lirePartageRecu(recherche({ lien: SELOGER }))).toEqual({ statut: 'recu', url: SELOGER });
    expect(
      lirePartageRecu(recherche({ titre: `T3 à Lyon ${SELOGER}`, texte: 'Vu sur SeLoger' })),
    ).toEqual({ statut: 'recu', url: SELOGER });
  });

  it('préfère le lien d’annonce reconnu, sinon garde le premier lien', () => {
    expect(
      lirePartageRecu(recherche({ texte: `https://exemple.fr/a puis (${LEBONCOIN})` })),
    ).toEqual({ statut: 'recu', url: LEBONCOIN });
    expect(
      lirePartageRecu(recherche({ lien: 'https://exemple.fr/b', titre: `T3 à Lyon ${SELOGER}` })),
    ).toEqual({ statut: 'recu', url: SELOGER });
    expect(lirePartageRecu(recherche({ texte: 'Vu ici https://exemple.fr/annonce/42' }))).toEqual({
      statut: 'recu',
      url: 'https://exemple.fr/annonce/42',
    });
  });

  it('sans lien : le texte partagé est rendu pour être lu, titre compris', () => {
    const texte = 'Appartement T3 de 65 m² au 3e étage, prix 155 000 €, DPE D';
    expect(lirePartageRecu(recherche({ texte }))).toEqual({ statut: 'recu', texte });
    expect(lirePartageRecu(recherche({ titre: 'T3 Marseille', texte }))).toEqual({
      statut: 'recu',
      texte: `T3 Marseille\n${texte}`,
    });
    expect(lirePartageRecu(recherche({ lien: 'leboncoin.fr/ad/123' }))).toEqual({
      statut: 'recu',
      texte: 'leboncoin.fr/ad/123',
    });
  });

  it('tronque un texte démesuré et supporte un encodage abîmé', () => {
    const recu = lirePartageRecu(recherche({ texte: 'a'.repeat(50_000) }));
    expect(recu).toEqual({ statut: 'recu', texte: 'a'.repeat(LONGUEUR_MAX_TEXTE_PARTAGE) });
    expect(lirePartageRecu('?texte=%E9t%C3%A9%')).toEqual({ statut: 'recu', texte: '\uFFFDté%' });
  });

  it('reste rapide face à une adresse piégée (longue ponctuation finale)', () => {
    const piege = `${LEBONCOIN}${'.'.repeat(15_000)}`;
    const debut = performance.now();
    expect(lirePartageRecu(recherche({ texte: piege }))).toEqual({
      statut: 'recu',
      url: LEBONCOIN,
    });
    expect(performance.now() - debut).toBeLessThan(500);
  });
});

describe('annoncePartagee (premier rendu de Nouveau projet)', () => {
  it('lien d’annonce reconnu ou texte à lire : l’écran s’ouvre sur le texte de l’annonce', () => {
    expect(annoncePartagee(false, recherche({ texte: `Vu ${LEBONCOIN}` }))).toEqual({
      recue: true,
      lien: LEBONCOIN,
      texte: '',
      etape: 'texte',
    });
    expect(annoncePartagee(false, recherche({ texte: 'T3 lumineux' }))).toEqual({
      recue: true,
      lien: null,
      texte: 'T3 lumineux',
      etape: 'texte',
    });
  });

  it('site non reconnu : l’écran reste sur le lien ; rien de partagé : rien ne change', () => {
    expect(annoncePartagee(false, recherche({ lien: 'https://exemple.fr/42' }))).toEqual({
      recue: true,
      lien: 'https://exemple.fr/42',
      texte: '',
      etape: 'lien',
    });
    expect(annoncePartagee(false, '')).toEqual({
      recue: false,
      lien: null,
      texte: '',
      etape: 'lien',
    });
  });

  it('une capture de l’extension reçue en même temps l’emporte : le partage est ignoré', () => {
    expect(annoncePartagee(true, recherche({ texte: `Vu ${LEBONCOIN}` }))).toEqual({
      recue: false,
      lien: null,
      texte: '',
      etape: 'lien',
    });
  });
});
