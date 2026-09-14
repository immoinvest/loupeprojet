import { describe, expect, it } from 'vitest';

import { chevauche, FinLocationSchema, NouvelleOccupationSchema, refusFin } from '../src/baux';
import { location, paiement } from './exemples';

describe('refusFin', () => {
  const l = location('l1', { debut: '2026-10-01' });

  it('une sortie avant l’entrée est refusée ; le jour de l’entrée est accepté', () => {
    expect(refusFin(l, '2026-09-30', [])).toBe('FIN_AVANT_ENTREE');
    expect(refusFin(l, '2026-10-01', [])).toBeNull();
  });

  it('un loyer déjà reçu pour un mois après la sortie bloque ; celui du mois de sortie non', () => {
    const paiements = [
      paiement('p-mars', 'l1', '2027-03', 70_000),
      paiement('p-avril', 'l1', '2027-04', 70_000),
      paiement('autre', 'l2', '2027-06', 70_000),
    ];
    expect(refusFin(l, '2027-03-14', paiements)).toBe('PAIEMENTS_APRES_SORTIE');
    expect(refusFin(l, '2027-04-14', paiements)).toBeNull();
  });
});

describe('chevauche', () => {
  it('aucune location : rien ne chevauche', () => {
    expect(chevauche([], { debut: '2026-10-01' })).toBe(false);
  });

  it('une location sans fin occupe le bien pour toujours', () => {
    expect(chevauche([{ debut: '2025-10-01' }], { debut: '2030-01-01' })).toBe(true);
  });

  it('une location terminée la veille ne chevauche pas ; le même jour, si (bornes comprises)', () => {
    const terminee = [{ debut: '2025-10-01', fin: '2026-08-31' }];
    expect(chevauche(terminee, { debut: '2026-09-01' })).toBe(false);
    expect(chevauche(terminee, { debut: '2026-08-31' })).toBe(true);
  });

  it('une nouvelle location qui finit avant la suivante ne chevauche pas', () => {
    const future = [{ debut: '2027-01-01' }];
    expect(chevauche(future, { debut: '2026-01-01', fin: '2026-12-31' })).toBe(false);
    expect(chevauche(future, { debut: '2026-01-01', fin: '2027-01-01' })).toBe(true);
    expect(chevauche(future, { debut: '2026-01-01' })).toBe(true);
  });

  it('location à la chambre : deux chambres aux mêmes dates ne se chevauchent pas ; la même chambre, si', () => {
    const chambre1 = [{ debut: '2026-09-01', libelle: 'Chambre 1' }];
    expect(chevauche(chambre1, { debut: '2026-09-01', libelle: 'Chambre 2' })).toBe(false);
    expect(chevauche(chambre1, { debut: '2026-10-01', libelle: 'chambre 1' })).toBe(true);
  });

  it('sans libellé, seules les autres locations sans libellé comptent (ADR-G13)', () => {
    expect(
      chevauche([{ debut: '2026-09-01', libelle: 'Chambre 1' }], { debut: '2026-10-01' }),
    ).toBe(false);
    expect(
      chevauche([{ debut: '2026-09-01' }], { debut: '2026-10-01', libelle: 'Chambre 1' }),
    ).toBe(false);
    expect(chevauche([{ debut: '2026-09-01' }], { debut: '2026-10-01' })).toBe(true);
  });
});

describe('schémas des baux', () => {
  it('fin de location : un vrai jour', () => {
    expect(FinLocationSchema.safeParse({ fin: '2027-03-14' }).success).toBe(true);
    expect(FinLocationSchema.safeParse({ fin: '2027-02-30' }).success).toBe(false);
  });

  it('louer un bien vacant : locataire et location, sortie jamais avant l’entrée', () => {
    const occupation = {
      locataire: { prenom: 'Léa', nom: 'Bernard' },
      location: {
        type: 'meublee',
        debut: '2026-11-01',
        jourLoyer: 5,
        loyerHorsCharges: 49_000,
        charges: 4_000,
        depot: 98_000,
      },
    };
    expect(NouvelleOccupationSchema.safeParse(occupation).success).toBe(true);
    expect(
      NouvelleOccupationSchema.safeParse({
        ...occupation,
        location: { ...occupation.location, fin: '2026-10-31' },
      }).success,
    ).toBe(false);
  });

  it('colocation : dix colocataires au plus, chacun avec prénom et nom', () => {
    const occupation = {
      locataire: { prenom: 'Léa', nom: 'Bernard' },
      location: {
        libelle: 'Chambre 2',
        type: 'meublee',
        debut: '2026-11-01',
        jourLoyer: 5,
        loyerHorsCharges: 49_000,
        charges: 4_000,
        depot: 98_000,
      },
    };
    const hugo = { prenom: 'Hugo', nom: 'Petit' };
    const avec = (colocataires: object[]): boolean =>
      NouvelleOccupationSchema.safeParse({ ...occupation, colocataires }).success;
    expect(avec(Array.from({ length: 10 }, () => hugo))).toBe(true);
    expect(avec(Array.from({ length: 11 }, () => hugo))).toBe(false);
    expect(avec([{ prenom: 'Hugo', nom: ' ' }])).toBe(false);
  });
});
