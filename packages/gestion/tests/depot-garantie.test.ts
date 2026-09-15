import { describe, expect, it } from 'vitest';

import {
  dateLimiteRestitution,
  depotMaximum,
  depotTropEleve,
  majorationRetard,
  refusRestitution,
  RenduDepotSchema,
  RestitutionSaisieSchema,
  RestitutionSchema,
  suiviDepot,
  totalRetenues,
  type Restitution,
} from '../src/depot-garantie';
import { location } from './exemples';

const TRAVAUX = { motif: 'Peinture de la chambre', montant: 12_000 };

/** Julie, 650 € hors charges, dépôt 650 €, sortie le 31 mars 2027. */
const SORTIE = { ...location('l1', { fin: '2027-03-31' }), depot: 65_000 };

function restitution(surcharges: Partial<Restitution> = {}): Restitution {
  return {
    locationId: 'l1',
    clesLe: '2027-03-31',
    conforme: false,
    retenues: [TRAVAUX],
    depot: 65_000,
    aRendre: 53_000,
    dateLimite: '2027-05-31',
    decompteId: 'd1',
    rendueLe: null,
    modifieLe: '2027-04-02T08:00:00.000Z',
    ...surcharges,
  };
}

describe('dépôt maximal (art. 22, 25-6, 25-13)', () => {
  it('650 € de loyer : 650 € en vide, 1 300 € en meublé, rien en bail mobilité', () => {
    expect(depotMaximum('nue', 'classique', 65_000)).toBe(65_000);
    expect(depotMaximum('meublee', 'classique', 65_000)).toBe(130_000);
    expect(depotMaximum('meublee', 'mobilite', 65_000)).toBe(0);
  });

  it('1 300 € saisis en vide : trop élevé ; 650 € : accepté', () => {
    expect(depotTropEleve('nue', 'classique', 65_000, 130_000)).toBe(true);
    expect(depotTropEleve('nue', 'classique', 65_000, 65_000)).toBe(false);
    expect(depotTropEleve('meublee', 'mobilite', 65_000, 1)).toBe(true);
  });
});

describe('restitution', () => {
  it('schémas : conforme sans retenue, retenues sinon', () => {
    const base = { clesLe: '2027-03-31', conforme: true, retenues: [] };
    expect(RestitutionSaisieSchema.safeParse(base).success).toBe(true);
    expect(RestitutionSaisieSchema.safeParse({ ...base, retenues: [TRAVAUX] }).success).toBe(false);
    expect(RestitutionSaisieSchema.safeParse({ ...base, conforme: false }).success).toBe(false);
    const avecRetenue = { ...base, conforme: false, retenues: [TRAVAUX] };
    expect(RestitutionSaisieSchema.safeParse(avecRetenue).success).toBe(true);
    expect(RestitutionSchema.safeParse(restitution()).success).toBe(true);
    expect(RenduDepotSchema.safeParse({ rendueLe: '2027-04-15' }).success).toBe(true);
    expect(totalRetenues([TRAVAUX, { montant: 3_000 }])).toBe(15_000);
  });

  it('date limite : 30 avril (conforme), 31 mai (retenues)', () => {
    expect(dateLimiteRestitution('2027-03-31', true)).toBe('2027-04-30');
    expect(dateLimiteRestitution('2027-03-31', false)).toBe('2027-05-31');
  });

  it('refus : sortie inconnue, clés remises demain ou avant l’entrée, retenues au-delà du dépôt', () => {
    const saisie = { clesLe: '2027-03-31', conforme: false, retenues: [TRAVAUX] };
    const aujourdhui = '2027-04-02';
    expect(refusRestitution(location('l1'), saisie, aujourdhui)).toBe('LOCATION_EN_COURS');
    expect(refusRestitution(SORTIE, { ...saisie, clesLe: '2027-04-03' }, aujourdhui)).toBe(
      'DATE_INVALIDE',
    );
    expect(refusRestitution(SORTIE, { ...saisie, clesLe: '2025-09-30' }, aujourdhui)).toBe(
      'DATE_INVALIDE',
    );
    const trop = { ...saisie, retenues: [{ motif: 'Travaux', montant: 65_001 }] };
    expect(refusRestitution(SORTIE, trop, aujourdhui)).toBe('RETENUES_TROP_ELEVEES');
    expect(refusRestitution(SORTIE, saisie, aujourdhui)).toBeNull();
  });
});

describe('majoration de retard (10 % du loyer par mois commencé)', () => {
  it('le jour limite : rien ; le lendemain : un mois commencé ; un mois plus tard et un jour : deux', () => {
    expect(majorationRetard(65_000, '2027-05-31', '2027-05-31')).toEqual({
      moisCommences: 0,
      montant: 0,
    });
    expect(majorationRetard(65_000, '2027-05-31', '2027-06-01')).toEqual({
      moisCommences: 1,
      montant: 6_500,
    });
    expect(majorationRetard(65_000, '2027-05-31', '2027-06-30')).toEqual({
      moisCommences: 1,
      montant: 6_500,
    });
    expect(majorationRetard(65_000, '2027-05-31', '2027-07-01')).toEqual({
      moisCommences: 2,
      montant: 13_000,
    });
  });
});

describe('suivi du dépôt', () => {
  it('sans dépôt ; locataire encore là ; préavis pas fini', () => {
    expect(suiviDepot({ ...SORTIE, depot: 0 }, undefined, '2027-04-10').statut).toBe('sans_depot');
    expect(suiviDepot(location('l1'), undefined, '2027-04-10')).toMatchObject({
      statut: 'en_cours',
      dateLimite: null,
    });
    expect(suiviDepot(SORTIE, undefined, '2027-03-31').statut).toBe('en_cours');
  });

  it('sortie passée sans restitution : limite supposée au 30 avril, rappel dès le 23, retard le 1er mai', () => {
    expect(suiviDepot(SORTIE, undefined, '2027-04-10')).toEqual({
      statut: 'a_rendre',
      dateLimite: '2027-04-30',
      supposee: true,
      aRendre: 65_000,
      rappel: false,
      enRetard: false,
      majoration: { moisCommences: 0, montant: 0 },
    });
    expect(suiviDepot(SORTIE, undefined, '2027-04-23')).toMatchObject({
      rappel: true,
      enRetard: false,
    });
    expect(suiviDepot(SORTIE, undefined, '2027-05-01')).toMatchObject({
      enRetard: true,
      majoration: { moisCommences: 1, montant: 6_500 },
    });
  });

  it('retenues enregistrées : limite 31 mai, 530 € à rendre ; rendu en retard ou à temps', () => {
    expect(suiviDepot(SORTIE, restitution(), '2027-06-01')).toMatchObject({
      statut: 'a_rendre',
      supposee: false,
      aRendre: 53_000,
      majoration: { moisCommences: 1, montant: 6_500 },
    });
    expect(suiviDepot(SORTIE, restitution({ rendueLe: '2027-06-01' }), '2027-09-01')).toEqual({
      statut: 'rendu',
      dateLimite: '2027-05-31',
      supposee: false,
      aRendre: 53_000,
      rappel: false,
      enRetard: false,
      majoration: { moisCommences: 1, montant: 6_500 },
    });
    const aTemps = suiviDepot(SORTIE, restitution({ rendueLe: '2027-05-20' }), '2027-09-01');
    expect(aTemps.majoration.montant).toBe(0);
  });

  it('retenues égales au dépôt : rien de majoré ; clés rendues pendant le préavis : à rendre', () => {
    const tout = restitution({ aRendre: 0 });
    expect(suiviDepot(SORTIE, tout, '2027-08-01').majoration.montant).toBe(0);
    const enPreavis = { ...location('l1', { fin: '2027-04-30' }), depot: 65_000 };
    const tot = restitution({ clesLe: '2027-04-10', dateLimite: '2027-06-10' });
    expect(suiviDepot(enPreavis, tot, '2027-04-12').statut).toBe('a_rendre');
  });
});
