import { describe, expect, it } from 'vitest';

import {
  moisCourt,
  quittanceDuMois,
  STATUTS_FRISE,
  statutDuBien,
  titreLocation,
  TONS_BIEN,
  TONS_FRISE,
} from '@/textes/gerer-fiche';

describe('textes de la fiche d’un bien', () => {
  it('statut du bien, en mot et en couleur', () => {
    expect(statutDuBien({ statut: 'loue', locations: [] })).toBe('Loué');
    expect(statutDuBien({ statut: 'vacant', locations: [] })).toBe('Vacant');
    expect(statutDuBien({ statut: 'depart_prevu', date: '2027-03-14', locations: [] })).toBe(
      'Départ prévu le 14 mars 2027',
    );
    expect(statutDuBien({ statut: 'a_venir', date: '2026-10-01', locations: [] })).toBe(
      'Entrée le 1er octobre 2026',
    );
    expect(TONS_BIEN).toEqual({
      loue: 'bon',
      vacant: 'neutre',
      depart_prevu: 'surveiller',
      a_venir: 'accent',
    });
  });

  it('titre d’une location : en cours ou à venir, avec sa chambre', () => {
    expect(titreLocation(undefined, false)).toBe('Location en cours');
    expect(titreLocation('Chambre 2', true)).toBe('Location à venir · Chambre 2');
  });

  it('frise : mois court, statut vacant, quittance d’une chambre', () => {
    expect(moisCourt('2026-09')).toBe('sept. 2026');
    expect(STATUTS_FRISE.vacant).toBe('Vacant');
    expect(STATUTS_FRISE.partiel).toBe('Partiel');
    expect(TONS_FRISE.vacant).toBe('neutre');
    expect(quittanceDuMois(undefined)).toBe('Quittance');
    expect(quittanceDuMois('Chambre 2')).toBe('Quittance · Chambre 2');
  });
});
