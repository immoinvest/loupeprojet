import { describe, expect, it } from 'vitest';

import {
  alleger,
  DemandePartageSchema,
  DemandeSuppressionPartageSchema,
  DUREE_PARTAGE_JOURS,
  expirationDepuis,
  ID_PARTAGE,
  PartageCreeSchema,
  PartageLuSchema,
} from '../src/partage';
import { DIX_HEURES, enregistre } from './exemples';

const VISITE = {
  faite: true,
  date: DIX_HEURES,
  reponses: { DOC_TITRE_PLAN: { etat: 'ok' as const, note: 'privé' } },
};

describe('contrat des liens de partage courts', () => {
  it('allège le projet : la visite ne part jamais, le reste suit, l’original est intact', () => {
    const adresse = {
      libelle: '10 rue Paradis',
      lat: 43.29,
      lon: 5.38,
      codeInsee: '13206',
      codeVoie: null,
      numero: 10,
    };
    const complet = enregistre('p1', { visite: VISITE, adresse });
    const leger = alleger(complet);
    expect(leger).not.toHaveProperty('visite');
    expect(leger.adresse).toEqual(adresse);
    expect(leger.projet).toBe(complet.projet);
    expect(complet.visite).toEqual(VISITE);
    expect(alleger(enregistre('p2'))).toEqual(enregistre('p2'));
  });

  it('expire 90 jours après l’instant donné', () => {
    expect(DUREE_PARTAGE_JOURS).toBe(90);
    expect(expirationDepuis(Date.parse(DIX_HEURES))).toBe('2026-12-13T10:00:00.000Z');
  });

  it('identifiant : 8 caractères base62, rien d’autre', () => {
    expect(ID_PARTAGE.test('7fK2qA9x')).toBe(true);
    for (const id of ['7fK2qA9', '7fK2qA9xy', '7fK2qA9-', '../../x', '']) {
      expect(ID_PARTAGE.test(id)).toBe(false);
    }
  });

  it('valide la demande (projet migré puis validé), la création, la lecture et la suppression', () => {
    expect(DemandePartageSchema.safeParse({ projet: enregistre('p1') }).success).toBe(true);
    expect(DemandePartageSchema.safeParse({ projet: { id: 'x' } }).success).toBe(false);
    expect(DemandePartageSchema.safeParse(null).success).toBe(false);
    expect(
      PartageCreeSchema.safeParse({ id: '7fK2qA9x', jeton: 'j', expireLe: DIX_HEURES }).success,
    ).toBe(true);
    expect(
      PartageCreeSchema.safeParse({ id: 'court', jeton: 'j', expireLe: DIX_HEURES }).success,
    ).toBe(false);
    expect(
      PartageLuSchema.safeParse({ projet: enregistre('p1'), expireLe: DIX_HEURES }).success,
    ).toBe(true);
    expect(DemandeSuppressionPartageSchema.safeParse({ jeton: '' }).success).toBe(false);
    expect(DemandeSuppressionPartageSchema.safeParse({ jeton: 'x'.repeat(129) }).success).toBe(
      false,
    );
    expect(DemandeSuppressionPartageSchema.safeParse({ jeton: 'abc' }).success).toBe(true);
  });
});
