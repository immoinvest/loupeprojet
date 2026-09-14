import type { EtatGestion, LocationGeree } from '@loupe/gestion';
import { describe, expect, it } from 'vitest';

import { etatDuBien, friseDuBien, MOIS_DE_LA_FRISE } from '@/gestion/fiche';

import { ETAT_SEPTEMBRE, LOCATION_JULIE, PAIEMENT_JULIE } from './gestion-exemples';

const AUJOURDHUI = '2026-09-14';

/** Une location du T2 Lices, dérivée de celle de Julie. */
function location(id: string, champs: Partial<LocationGeree>): LocationGeree {
  return { ...LOCATION_JULIE, id, ...champs };
}

function avec(
  locations: readonly LocationGeree[],
  paiements = ETAT_SEPTEMBRE.paiements,
): EtatGestion {
  return { ...ETAT_SEPTEMBRE, locations: [...locations], paiements: [...paiements] };
}

describe('etatDuBien', () => {
  it('loué : la location en cours ; un bien sans location, ou dont la location est finie, est vacant', () => {
    expect(etatDuBien(ETAT_SEPTEMBRE, 'bien-lices', AUJOURDHUI)).toEqual({
      statut: 'loue',
      locations: [LOCATION_JULIE],
    });
    expect(etatDuBien(ETAT_SEPTEMBRE, 'parking', AUJOURDHUI)).toEqual({
      statut: 'vacant',
      locations: [],
    });
    const partie = avec([location('partie', { fin: '2026-08-31' })]);
    expect(etatDuBien(partie, 'bien-lices', AUJOURDHUI).statut).toBe('vacant');
  });

  it('entrée à venir : la date de la première entrée', () => {
    const etat = avec([
      location('novembre', { debut: '2026-11-01' }),
      location('octobre', { debut: '2026-10-01' }),
    ]);
    expect(etatDuBien(etat, 'bien-lices', AUJOURDHUI)).toMatchObject({
      statut: 'a_venir',
      date: '2026-10-01',
      locations: [{ id: 'octobre' }, { id: 'novembre' }],
    });
  });

  it('départ prévu quand toutes les chambres ont une sortie : la dernière sortie', () => {
    const etat = avec([
      location('chambre-1', { debut: '2026-01-01', fin: '2027-03-14', libelle: 'Chambre 1' }),
      location('chambre-2', { debut: '2026-02-01', fin: '2027-06-30', libelle: 'Chambre 2' }),
      location('chambre-3', { debut: '2026-03-01', fin: '2027-05-01', libelle: 'Chambre 3' }),
    ]);
    expect(etatDuBien(etat, 'bien-lices', AUJOURDHUI)).toMatchObject({
      statut: 'depart_prevu',
      date: '2027-06-30',
    });
  });

  it('toujours loué : une chambre sans sortie, ou un locataire suivant déjà prévu', () => {
    const chambres = avec([
      location('chambre-1', { fin: '2027-03-14', libelle: 'Chambre 1' }),
      location('chambre-2', { libelle: 'Chambre 2' }),
    ]);
    expect(etatDuBien(chambres, 'bien-lices', AUJOURDHUI).statut).toBe('loue');
    const relais = avec([
      location('julie', { fin: '2026-12-31' }),
      location('suivant', { debut: '2027-01-01' }),
    ]);
    expect(etatDuBien(relais, 'bien-lices', AUJOURDHUI)).toMatchObject({
      statut: 'loue',
      locations: [{ id: 'julie' }, { id: 'suivant' }],
    });
  });
});

describe('friseDuBien', () => {
  it('douze mois jusqu’au mois en cours : en retard sans paiement, reçu quand il est payé', () => {
    const frise = friseDuBien(ETAT_SEPTEMBRE, 'bien-lices', AUJOURDHUI);
    expect(frise).toHaveLength(MOIS_DE_LA_FRISE);
    expect(frise.map((m) => m.periode)).toEqual([
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
    ]);
    expect(frise[0]).toMatchObject({ statut: 'en_retard' });
    expect(frise[11]).toMatchObject({
      statut: 'recu',
      lignes: [{ location: { id: 'location-julie' } }],
    });
    // Le loyer d'Antoine est celui d'un autre bien : il ne compte pas.
    expect(frise.every((m) => m.lignes.every((l) => l.location.bienId === 'bien-lices'))).toBe(
      true,
    );
  });

  it('vacant avant l’entrée ; deux chambres : le statut le plus urgent du mois', () => {
    const etat = avec(
      [
        location('chambre-1', { debut: '2026-08-01', libelle: 'Chambre 1' }),
        location('chambre-2', { debut: '2026-08-01', libelle: 'Chambre 2' }),
      ],
      [{ ...PAIEMENT_JULIE, locationId: 'chambre-1' }],
    );
    const frise = friseDuBien(etat, 'bien-lices', AUJOURDHUI);
    expect(frise[9]).toMatchObject({ periode: '2026-07', statut: 'vacant', lignes: [] });
    expect(frise[11]?.statut).toBe('en_retard');
    expect(frise[11]?.lignes).toHaveLength(2);
  });
});
