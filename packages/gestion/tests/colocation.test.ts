import { describe, expect, it } from 'vitest';

import {
  ChangementColocataireSchema,
  finSolidarite,
  locatairesDuMois,
  locatairesLe,
  presences,
  refusChangementColocataire,
  type MouvementColocation,
} from '../src/colocation';
import { location } from './exemples';

const CREE = '2027-03-01T08:00:00.000Z';

function mouvement(
  id: string,
  locataireId: string,
  sens: MouvementColocation['sens'],
  date: string,
  locationId = 'l1',
): MouvementColocation {
  return { id, locationId, locataireId, sens, date, creeLe: CREE };
}

/** Julie, Léa et Hugo : Julie part le 10 mars 2027, Hugo arrive le 11. */
const BAIL = location('l1', { locataireId: 'julie', colocataireIds: ['lea', 'hugo'] });
const MOUVEMENTS = [
  mouvement('m1', 'julie', 'depart', '2027-03-10'),
  mouvement('m2', 'hugo', 'arrivee', '2027-03-11'),
  mouvement('m3', 'lea', 'depart', '2026-01-01', 'autre-location'),
];
const LEA = { prenom: 'Léa', nom: 'Bernard' };

describe('présents d’un bail unique', () => {
  it('le locataire en titre d’abord, arrivée à l’entrée sauf mouvement, mouvements des autres baux ignorés', () => {
    expect(presences(BAIL, MOUVEMENTS)).toEqual([
      { locataireId: 'julie', arrivee: '2025-10-01', depart: '2027-03-10' },
      { locataireId: 'lea', arrivee: '2025-10-01' },
      { locataireId: 'hugo', arrivee: '2027-03-11' },
    ]);
  });

  it('quittance de mars : Julie, Léa et Hugo ; d’avril : Léa et Hugo ; de février : Julie et Léa', () => {
    expect(locatairesDuMois(BAIL, MOUVEMENTS, '2027-03')).toEqual(['julie', 'lea', 'hugo']);
    expect(locatairesDuMois(BAIL, MOUVEMENTS, '2027-04')).toEqual(['lea', 'hugo']);
    expect(locatairesDuMois(BAIL, MOUVEMENTS, '2027-02')).toEqual(['julie', 'lea']);
  });

  it('présents un jour donné', () => {
    expect(locatairesLe(BAIL, MOUVEMENTS, '2027-03-10')).toEqual(['julie', 'lea']);
    expect(locatairesLe(BAIL, MOUVEMENTS, '2027-03-11')).toEqual(['lea', 'hugo']);
  });
});

describe('changement de colocataire', () => {
  const avantDepart = [mouvement('m2', 'hugo', 'arrivee', '2027-03-11')];

  it('schéma : un départ ou une arrivée', () => {
    expect(ChangementColocataireSchema.safeParse({}).success).toBe(false);
    const depart = { depart: { locataireId: 'julie', date: '2027-03-10' } };
    expect(ChangementColocataireSchema.safeParse(depart).success).toBe(true);
    const arrivee = { arrivee: { locataire: LEA, date: '2027-03-11' } };
    expect(ChangementColocataireSchema.safeParse(arrivee).success).toBe(true);
  });

  it('refus : dates hors du bail, inconnu du bail, déjà parti, départ avant l’arrivée', () => {
    const avant = { depart: { locataireId: 'julie', date: '2025-09-30' } };
    expect(refusChangementColocataire(BAIL, avantDepart, avant)).toBe('HORS_LOCATION');
    const termine = { ...BAIL, fin: '2027-06-30' };
    const apres = { depart: { locataireId: 'julie', date: '2027-07-01' } };
    expect(refusChangementColocataire(termine, avantDepart, apres)).toBe('HORS_LOCATION');
    const inconnu = { depart: { locataireId: 'marc', date: '2027-03-10' } };
    expect(refusChangementColocataire(BAIL, avantDepart, inconnu)).toBe('PAS_DANS_LE_BAIL');
    const deux = { depart: { locataireId: 'julie', date: '2027-04-10' } };
    expect(refusChangementColocataire(BAIL, MOUVEMENTS, deux)).toBe('DEJA_PARTI');
    const hugo = { depart: { locataireId: 'hugo', date: '2027-03-01' } };
    expect(refusChangementColocataire(BAIL, avantDepart, hugo)).toBe('HORS_LOCATION');
  });

  it('le dernier locataire ne part pas sans remplaçant ; l’arrivée reste dans le bail et sous 10 colocataires', () => {
    const seule = location('l1', { locataireId: 'julie' });
    const depart = { depart: { locataireId: 'julie', date: '2027-03-10' } };
    expect(refusChangementColocataire(seule, [], depart)).toBe('DERNIER_LOCATAIRE');
    const remplace = { ...depart, arrivee: { locataire: LEA, date: '2027-03-11' } };
    expect(refusChangementColocataire(seule, [], remplace)).toBeNull();
    const tard = { arrivee: { locataire: LEA, date: '2025-01-01' } };
    expect(refusChangementColocataire(seule, [], tard)).toBe('HORS_LOCATION');
    const pleine = location('l1', {
      locataireId: 'julie',
      colocataireIds: Array.from({ length: 10 }, (_, i) => `c${String(i)}`),
    });
    expect(refusChangementColocataire(pleine, [], remplace)).toBe('LIMITE_ATTEINTE');
    expect(refusChangementColocataire(BAIL, avantDepart, depart)).toBeNull();
  });

  it('fin de solidarité (art. 8-1 VI) : arrivée du remplaçant, au plus tard six mois après le départ', () => {
    expect(finSolidarite('2027-03-10', null)).toBe('2027-09-10');
    expect(finSolidarite('2027-03-10', '2027-03-11')).toBe('2027-03-11');
    expect(finSolidarite('2027-03-10', '2027-03-01')).toBe('2027-03-10');
    expect(finSolidarite('2027-03-10', '2027-12-01')).toBe('2027-09-10');
  });
});
