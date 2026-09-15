import { describe, expect, it } from 'vitest';

import {
  cheminDe,
  destinationRetour,
  etatLocationCreee,
  lienDocument,
  lienFicheBien,
  lienFicheLocataire,
  lienLoyers,
  lienNouveauLocataire,
  locationCreee,
  RETOUR_MAX,
  retourValide,
} from '@/gestion/parcours';
import { libelleRetour, locationCreeeMessage, modifierLaLocation } from '@/textes/gerer-parcours';
import { nomsDesLocataires, separateurNom } from '@/textes/gerer-loyers';

import { ETAT_SEPTEMBRE } from './gestion-exemples';

describe('adresses de Gérer', () => {
  it('fiches, avec leur formulaire ouvert à l’arrivée ; identifiants encodés', () => {
    expect(lienFicheBien('bien-lices')).toBe('/gerer/biens/bien-lices');
    expect(lienFicheBien('bien lices', { modifier: 'location-julie' })).toBe(
      '/gerer/biens/bien%20lices?modifier=location-julie',
    );
    expect(lienFicheLocataire('locataire-julie')).toBe('/gerer/locataires/locataire-julie');
    expect(lienFicheLocataire('a/b', { modifier: true })).toBe(
      '/gerer/locataires/a%2Fb?modifier=1',
    );
    expect(lienFicheLocataire('julie', { modifier: false })).toBe('/gerer/locataires/julie');
  });

  it('nouveau locataire, loyers d’un mois, document', () => {
    expect(lienNouveauLocataire()).toBe('/gerer/locataires/nouveau');
    expect(lienNouveauLocataire({ bienId: 'parking', retour: '/gerer/biens' })).toBe(
      '/gerer/locataires/nouveau?bien=parking&retour=%2Fgerer%2Fbiens',
    );
    expect(lienLoyers()).toBe('/gerer/loyers');
    expect(lienLoyers({ periode: '2026-03', bienId: 'bien-lices' })).toBe(
      '/gerer/loyers?mois=2026-03&bien=bien-lices',
    );
    expect(lienDocument('doc 1', '/gerer/loyers?mois=2026-03')).toBe(
      '/gerer/documents/doc%201?retour=%2Fgerer%2Floyers%3Fmois%3D2026-03',
    );
    expect(cheminDe({ pathname: '/gerer/loyers', search: '?mois=2026-03' })).toBe(
      '/gerer/loyers?mois=2026-03',
    );
  });
});

describe('retourValide', () => {
  it('accepte les pages de Gérer', () => {
    for (const chemin of [
      '/gerer',
      '/gerer/',
      '/gerer?x=1',
      '/gerer/biens/bien-lices',
      '/gerer/loyers?mois=2026-03&bien=b',
    ]) {
      expect(retourValide(chemin)).toBe(chemin);
    }
  });

  it('refuse toute autre destination', () => {
    const refuses = [
      null,
      '',
      'gerer',
      'https://exemple.org/gerer',
      '//exemple.org',
      '/\\exemple.org',
      '/gerer//exemple.org',
      '/gerer\\x',
      '/gererx',
      '/projets',
      '/gerer/../projets',
      'javascript:alert(1)',
      `/gerer/${String.fromCharCode(0)}`,
      `/gerer/${String.fromCharCode(127)}`,
      `/gerer/${'a'.repeat(RETOUR_MAX)}`,
    ];
    for (const valeur of refuses) expect(retourValide(valeur)).toBeNull();
  });
});

describe('destinationRetour', () => {
  it('chaque page d’origine et son libellé', () => {
    const cas: [string, string][] = [
      ['/gerer', 'Loyers du mois'],
      ['/gerer/loyers', 'Tous les loyers'],
      ['/gerer/loyers?mois=2026-03', 'Loyers de mars 2026'],
      ['/gerer/loyers?mois=2026-08&bien=bien-lices', 'Loyers d’août 2026'],
      ['/gerer/loyers?mois=13', 'Tous les loyers'],
      ['/gerer/biens', 'Mes biens'],
      ['/gerer/biens/bien-lices', 'T2 Lices'],
      ['/gerer/locataires', 'Mes locataires'],
      ['/gerer/locataires/locataire-julie?modifier=1', 'Julie Martin'],
    ];
    for (const [chemin, libelle] of cas) {
      const destination = destinationRetour(chemin, ETAT_SEPTEMBRE);
      expect(destination.chemin).toBe(chemin);
      expect(libelleRetour(destination.cible)).toBe(libelle);
    }
  });

  it('origine absente, invalide, inconnue ou supprimée : Tous les loyers', () => {
    const parDefaut = { chemin: '/gerer/loyers', cible: { type: 'loyers', periode: null } };
    for (const chemin of [
      null,
      'https://exemple.org',
      '/gerer/ajouter',
      '/gerer/biens/inconnu',
      '/gerer/locataires/inconnu',
      '/gerer/biens/%E0',
      '/gerer/biens/a/b',
    ]) {
      expect(destinationRetour(chemin, ETAT_SEPTEMBRE)).toEqual(parDefaut);
    }
  });
});

describe('location créée', () => {
  it('lit l’état de navigation posé par « Nouveau locataire »', () => {
    const loue = { locataireId: 'l1', locataire: 'Léa Bernard', bien: 'Parking Prado' };
    expect(locationCreee(etatLocationCreee(loue))).toEqual(loue);
    expect(locationCreeeMessage(loue.locataire, loue.bien)).toBe('Léa Bernard loue Parking Prado.');
  });

  it('ignore tout autre état', () => {
    for (const etat of [
      null,
      undefined,
      'loue',
      {},
      { supprime: 'T2' },
      { loue: null },
      { loue: 'Léa' },
      { loue: { locataireId: 'l1', locataire: 'Léa Bernard' } },
      { loue: { locataireId: 1, locataire: 'Léa Bernard', bien: 'Parking' } },
    ]) {
      expect(locationCreee(etat)).toBeNull();
    }
  });
});

describe('montant d’une ligne de loyer', () => {
  it('nom accessible qui dit où mène le lien', () => {
    expect(modifierLaLocation('700 €', 'T2 Lices')).toBe(
      '700 € — modifier la location de T2 Lices',
    );
    expect(modifierLaLocation('430 €', 'Appartement Baille')).toBe(
      '430 € — modifier la location d’Appartement Baille',
    );
  });
});

describe('noms des locataires', () => {
  it('séparateurs : rien, virgule, et', () => {
    expect([0, 1, 2].map((rang) => separateurNom(rang, 3))).toEqual(['', ', ', ' et ']);
    expect(separateurNom(1, 2)).toBe(' et ');
    expect(nomsDesLocataires([])).toBe('');
    expect(nomsDesLocataires(['Julie Martin', 'Léa Bernard', 'Hugo Petit'])).toBe(
      'Julie Martin, Léa Bernard et Hugo Petit',
    );
  });
});
