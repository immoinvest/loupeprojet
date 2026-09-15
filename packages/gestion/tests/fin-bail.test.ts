import { describe, expect, it } from 'vitest';

import {
  ajouterMoisAuJour,
  CongeSaisieSchema,
  CongeSchema,
  finDePreavis,
  motifReduitUtile,
  preavisLocataire,
  refusConge,
  statutLocation,
  type ContextePreavis,
} from '../src/fin-bail';
import { PREAVIS_LOCATAIRE } from '../src/regles-fin-bail';
import { location, paiement } from './exemples';

const VIDE: ContextePreavis = {
  type: 'nue',
  formeBail: 'classique',
  zoneTendue: false,
  reduit: false,
};

describe('ajouterMoisAuJour (Service-public F32360 : même quantième, sinon fin de mois)', () => {
  it('congé reçu le 5 septembre : 5 octobre à un mois, 5 décembre à trois mois', () => {
    expect(ajouterMoisAuJour('2026-09-05', 1)).toBe('2026-10-05');
    expect(ajouterMoisAuJour('2026-09-05', 3)).toBe('2026-12-05');
  });

  it('30 ou 31 janvier + 1 mois : dernier jour de février, 29 en année bissextile', () => {
    expect(ajouterMoisAuJour('2027-01-31', 1)).toBe('2027-02-28');
    expect(ajouterMoisAuJour('2028-01-30', 1)).toBe('2028-02-29');
  });

  it('passe l’année, recule d’un mois', () => {
    expect(ajouterMoisAuJour('2026-11-30', 2)).toBe('2027-01-30');
    expect(ajouterMoisAuJour('2026-12-31', 6)).toBe('2027-06-30');
    expect(ajouterMoisAuJour('2026-03-31', -1)).toBe('2026-02-28');
  });
});

describe('préavis du locataire (art. 15 I, art. 25-8, titre I ter)', () => {
  it('location vide : 3 mois ; zone tendue ou motif réduit : 1 mois ; zone inconnue : 3 mois, dit', () => {
    expect(preavisLocataire(VIDE)).toEqual({ mois: 3, raison: 'nue' });
    expect(preavisLocataire({ ...VIDE, zoneTendue: true })).toEqual({
      mois: 1,
      raison: 'zone_tendue',
    });
    expect(preavisLocataire({ ...VIDE, reduit: true })).toEqual({
      mois: 1,
      raison: 'motif_reduit',
    });
    expect(preavisLocataire({ ...VIDE, zoneTendue: null })).toEqual({
      mois: 3,
      raison: 'zone_inconnue',
    });
  });

  it('meublé, bail étudiant : 1 mois ; bail mobilité : 1 mois, à confirmer', () => {
    expect(preavisLocataire({ ...VIDE, type: 'meublee' })).toEqual({ mois: 1, raison: 'meublee' });
    expect(preavisLocataire({ ...VIDE, formeBail: 'etudiant' })).toEqual({
      mois: 1,
      raison: 'meublee',
    });
    expect(preavisLocataire({ ...VIDE, type: 'meublee', formeBail: 'mobilite' })).toEqual({
      mois: 1,
      raison: 'mobilite',
    });
    expect(PREAVIS_LOCATAIRE.mobiliteAConfirmer).toBe(true);
  });

  it('le motif réduit ne compte qu’en location vide hors zone tendue', () => {
    expect(motifReduitUtile(VIDE)).toBe(true);
    expect(motifReduitUtile({ ...VIDE, zoneTendue: null })).toBe(true);
    expect(motifReduitUtile({ ...VIDE, zoneTendue: true })).toBe(false);
    expect(motifReduitUtile({ ...VIDE, type: 'meublee' })).toBe(false);
  });

  it('date de fin : reçu le 5 septembre 2026 → 5 décembre (vide), 5 octobre (zone tendue)', () => {
    expect(finDePreavis('2026-09-05', VIDE)).toBe('2026-12-05');
    expect(finDePreavis('2026-09-05', { ...VIDE, zoneTendue: true })).toBe('2026-10-05');
  });
});

describe('congé', () => {
  const saisie = { recuLe: '2026-09-05', fin: '2026-12-05', reduit: false };

  it('schémas : la fin ne précède jamais la réception', () => {
    expect(CongeSaisieSchema.safeParse(saisie).success).toBe(true);
    expect(CongeSaisieSchema.safeParse({ ...saisie, fin: '2026-09-04' }).success).toBe(false);
    const enregistre = { ...saisie, locationId: 'l1', modifieLe: '2026-09-05T08:00:00.000Z' };
    expect(CongeSchema.safeParse(enregistre).success).toBe(true);
    expect(CongeSchema.safeParse({ ...enregistre, fin: '2026-09-01' }).success).toBe(false);
  });

  it('refus : reçu demain, reçu avant l’entrée, loyers déjà reçus après la sortie ; sinon accepté', () => {
    const l = location('l1');
    const aujourdhui = '2026-09-10';
    expect(refusConge(l, { ...saisie, recuLe: '2026-09-11' }, [], aujourdhui)).toBe(
      'DATE_INVALIDE',
    );
    expect(refusConge(l, { ...saisie, recuLe: '2025-09-01' }, [], aujourdhui)).toBe(
      'CONGE_INVALIDE',
    );
    const janvier = paiement('p1', 'l1', '2027-01', 70_000, '2026-09-05');
    expect(refusConge(l, saisie, [janvier], aujourdhui)).toBe('PAIEMENTS_APRES_SORTIE');
    expect(refusConge(l, saisie, [], aujourdhui)).toBeNull();
  });

  it('statut : à venir, active, préavis (congé et sortie à venir), terminée ; jamais stocké', () => {
    const debut = '2025-10-01';
    expect(statutLocation({ debut, fin: '2026-09-01' }, true, '2026-09-10')).toBe('terminee');
    expect(statutLocation({ debut: '2026-10-01' }, false, '2026-09-10')).toBe('a_venir');
    expect(statutLocation({ debut, fin: '2026-12-05' }, true, '2026-09-10')).toBe('preavis');
    expect(statutLocation({ debut, fin: '2026-12-05' }, false, '2026-09-10')).toBe('active');
    expect(statutLocation({ debut }, true, '2026-09-10')).toBe('active');
    expect(statutLocation({ debut, fin: '2026-09-10' }, true, '2026-09-10')).toBe('preavis');
  });
});
