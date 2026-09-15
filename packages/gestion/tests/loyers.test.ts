import { describe, expect, it } from 'vitest';

import { bornesPeriode, periodeSuivante } from '../src/dates';
import { loyerDuMois, montantAcceptable, suivreLoyer, type LoyerDu } from '../src/loyers';
import { location, paiement, tirage } from './exemples';

function du(l: Parameters<typeof loyerDuMois>[0], periode: string): LoyerDu {
  const resultat = loyerDuMois(l, periode);
  if (resultat === null) throw new Error(`Aucun loyer dû en ${periode}`);
  return resultat;
}

describe('loyerDuMois', () => {
  it('mois plein : loyer et charges entiers, dû le jour du bail', () => {
    expect(loyerDuMois(location('l1', { debut: '2026-10-01' }), '2026-10')).toEqual({
      locationId: 'l1',
      periode: '2026-10',
      debut: '2026-10-01',
      fin: '2026-10-31',
      echeance: '2026-10-05',
      loyerHorsCharges: 65_000,
      charges: 5_000,
      total: 70_000,
      apl: 0,
      partLocataire: 70_000,
      joursOccupes: 31,
      joursDuMois: 31,
    });
  });

  it('entrée le 12 : 20 jours sur 31, arrondis au centime, dû le jour de l’entrée', () => {
    const l = du(location('l1', { debut: '2026-10-12' }), '2026-10');
    // 65 000 × 20 ÷ 31 = 41 935,48 → 41 935 ; 5 000 × 20 ÷ 31 = 3 225,81 → 3 226.
    expect(l).toMatchObject({
      debut: '2026-10-12',
      echeance: '2026-10-12',
      loyerHorsCharges: 41_935,
      charges: 3_226,
      total: 45_161,
      joursOccupes: 20,
    });
  });

  it('entrée le 3 avec un loyer le 5 : la date due reste le 5', () => {
    expect(du(location('l1', { debut: '2026-10-03' }), '2026-10').echeance).toBe('2026-10-05');
  });

  it('sortie le 14 mars 2027 : 14 jours sur 31, rien en avril', () => {
    const l = location('l1', { debut: '2026-10-01', fin: '2027-03-14' });
    // 65 000 × 14 ÷ 31 = 29 354,84 → 29 355 ; 5 000 × 14 ÷ 31 = 2 258,06 → 2 258.
    expect(du(l, '2027-03')).toMatchObject({
      fin: '2027-03-14',
      echeance: '2027-03-05',
      loyerHorsCharges: 29_355,
      charges: 2_258,
      joursOccupes: 14,
    });
    expect(loyerDuMois(l, '2027-04')).toBeNull();
  });

  it('aucun loyer avant l’entrée', () => {
    expect(loyerDuMois(location('l1', { debut: '2026-10-01' }), '2026-09')).toBeNull();
  });

  it('cas limites : entrée et sortie le même mois, dernier jour, premier jour, loyer nul', () => {
    const court = location('l1', { debut: '2026-10-10', fin: '2026-10-20' });
    expect(du(court, '2026-10').joursOccupes).toBe(11);
    const dernierJour = du(location('l1', { debut: '2026-10-31' }), '2026-10');
    expect(dernierJour).toMatchObject({ joursOccupes: 1, echeance: '2026-10-31', total: 2_258 });
    const premierJour = du(location('l1', { debut: '2026-01-01', fin: '2026-03-01' }), '2026-03');
    expect(premierJour.joursOccupes).toBe(1);
    const prete = du(location('l1', { loyerHorsCharges: 0, charges: 0 }), '2026-10');
    expect(prete.total).toBe(0);
  });

  it('propriété : douze mois pleins valent douze loyers ; un prorata ne dépasse jamais le mois plein', () => {
    const tirer = tirage(20_260_914);
    for (let essai = 0; essai < 200; essai += 1) {
      const loyer = tirer(0, 300_000);
      const charges = tirer(0, 40_000);
      const jourEntree = tirer(1, 28);
      const l = location('l', {
        debut: `2026-01-${String(jourEntree).padStart(2, '0')}`,
        jourLoyer: tirer(1, 28),
        loyerHorsCharges: loyer,
        charges,
      });
      let periode = '2026-02';
      let somme = 0;
      for (let mois = 0; mois < 12; mois += 1) {
        somme += du(l, periode).total;
        periode = periodeSuivante(periode);
      }
      expect(somme).toBe(12 * (loyer + charges));
      const entree = du(l, '2026-01');
      expect(entree.total).toBeLessThanOrEqual(loyer + charges);
      expect(entree.joursOccupes).toBe(bornesPeriode('2026-01').jours - jourEntree + 1);
    }
  });
});

describe('suivreLoyer', () => {
  const l = location('l1', { debut: '2026-10-01' });
  const octobre = du(l, '2026-10');

  it('à venir avant l’entrée, attendu jusqu’au 9, en retard dès le 10 (5 jours de délai)', () => {
    expect(suivreLoyer(octobre, [], '2026-09-30').statut).toBe('a_venir');
    expect(suivreLoyer(octobre, [], '2026-10-01').statut).toBe('attendu');
    expect(suivreLoyer(octobre, [], '2026-10-09').statut).toBe('attendu');
    expect(suivreLoyer(octobre, [], '2026-10-10').statut).toBe('en_retard');
  });

  it('reçu dès que les paiements de la période couvrent le dû, quelle que soit leur date', () => {
    const payes = [paiement('p1', 'l1', '2026-10', 70_000, '2026-11-20')];
    expect(suivreLoyer(octobre, payes, '2026-12-01')).toEqual({
      statut: 'recu',
      recu: 70_000,
      resteDu: 0,
      paiements: payes,
    });
  });

  it('un paiement partiel rend le loyer « partiel » ; ceux d’un autre mois ou d’une autre location ne comptent pas', () => {
    const paiements = [
      paiement('p1', 'l1', '2026-10', 30_000),
      paiement('p2', 'l1', '2026-09', 70_000),
      paiement('p3', 'autre', '2026-10', 70_000),
    ];
    const suivi = suivreLoyer(octobre, paiements, '2026-10-06');
    expect(suivi.statut).toBe('partiel');
    expect(suivi.recu).toBe(30_000);
    expect(suivi.resteDu).toBe(40_000);
    expect(suivi.paiements.map((p) => p.id)).toEqual(['p1']);
  });

  it('partiel l’emporte sur le retard et sur « à venir » ; deux paiements qui couvrent le dû le rendent reçu', () => {
    const partiel = [paiement('p1', 'l1', '2026-10', 30_000, '2026-09-28')];
    expect(suivreLoyer(octobre, partiel, '2026-11-30').statut).toBe('partiel');
    expect(suivreLoyer(octobre, partiel, '2026-09-29').statut).toBe('partiel');
    const complet = [...partiel, paiement('p2', 'l1', '2026-10', 40_000, '2026-10-20')];
    expect(suivreLoyer(octobre, complet, '2026-10-21')).toMatchObject({
      statut: 'recu',
      recu: 70_000,
      resteDu: 0,
    });
  });
});

describe('montantAcceptable', () => {
  const octobre = du(location('l1', { debut: '2026-10-01' }), '2026-10');
  const dejaPaye = [paiement('p1', 'l1', '2026-10', 30_000)];

  it('au moins un centime, au plus ce qui reste dû', () => {
    expect(montantAcceptable(octobre, dejaPaye, 40_000)).toBe(true);
    expect(montantAcceptable(octobre, dejaPaye, 1)).toBe(true);
    expect(montantAcceptable(octobre, dejaPaye, 40_001)).toBe(false);
    expect(montantAcceptable(octobre, dejaPaye, 0)).toBe(false);
    expect(montantAcceptable(octobre, dejaPaye, -5)).toBe(false);
    expect(montantAcceptable(octobre, dejaPaye, 100.5)).toBe(false);
  });

  it('un loyer entièrement reçu n’accepte plus rien', () => {
    const complet = [...dejaPaye, paiement('p2', 'l1', '2026-10', 40_000)];
    expect(montantAcceptable(octobre, complet, 1)).toBe(false);
  });

  it('un loyer nul est reçu d’office', () => {
    const prete = du(location('l2', { loyerHorsCharges: 0, charges: 0 }), '2026-10');
    expect(suivreLoyer(prete, [], '2026-09-01').statut).toBe('recu');
  });
});
