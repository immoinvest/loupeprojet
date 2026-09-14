import { describe, expect, it } from 'vitest';

import {
  idDe,
  lireReponse,
  MAX_CHANGEMENTS,
  RequeteSynchroSchema,
  TAILLE_MAX_PROJET,
  type Changement,
} from '../src/contrat';
import { DIX_HEURES, enregistre } from './exemples';

function enregistrer(id: string): Changement {
  return { type: 'enregistrer', projet: enregistre(id) };
}

describe('requête de synchronisation', () => {
  it('accepte des enregistrements et des suppressions datés', () => {
    const lu = RequeteSynchroSchema.parse({
      depuis: 3,
      changements: [enregistrer('p1'), { type: 'supprimer', id: 'p2', le: DIX_HEURES }],
    });
    expect(lu.changements.map(idDe)).toEqual(['p1', 'p2']);
  });

  it('refuse trop de changements, deux changements du même projet, un curseur négatif', () => {
    const trop = Array.from({ length: MAX_CHANGEMENTS + 1 }, (_, i) =>
      enregistrer(`p${String(i)}`),
    );
    expect(RequeteSynchroSchema.safeParse({ depuis: 0, changements: trop }).success).toBe(false);
    expect(
      RequeteSynchroSchema.safeParse({
        depuis: 0,
        changements: [enregistrer('p1'), { type: 'supprimer', id: 'p1', le: DIX_HEURES }],
      }).success,
    ).toBe(false);
    expect(RequeteSynchroSchema.safeParse({ depuis: -1, changements: [] }).success).toBe(false);
  });

  it('refuse un projet invalide, mal daté, à l’identifiant trop long ou trop gros', () => {
    const noteLongue = { etat: 'ok', note: 'x'.repeat(300) };
    const reponses = Object.fromEntries(
      Array.from({ length: Math.ceil(TAILLE_MAX_PROJET / 300) }, (_, i) => [
        `q${String(i)}`,
        noteLongue,
      ]),
    );
    const invalides = [
      { ...enregistre('p1'), statut: 'inconnu' },
      { ...enregistre('p1'), modifieLe: '14/09/2026' },
      enregistre('x'.repeat(65)),
      { ...enregistre('p1'), visite: { faite: true, reponses } },
    ];
    for (const projet of invalides) {
      const r = RequeteSynchroSchema.safeParse({
        depuis: 0,
        changements: [{ type: 'enregistrer', projet }],
      });
      expect(r.success).toBe(false);
    }
  });
});

describe('lireReponse', () => {
  it('rend null pour une enveloppe invalide', () => {
    expect(lireReponse(undefined)).toBeNull();
    expect(lireReponse({ curseur: 1, suite: false, ids: [], refuses: [] })).toBeNull();
  });

  it('écarte un projet illisible sans bloquer les autres', () => {
    const r = lireReponse({
      curseur: 4,
      suite: true,
      ids: ['p1', 'p2'],
      refuses: ['p3'],
      projets: [enregistre('p1'), { id: 'p2' }],
    });
    expect(r).toEqual({
      curseur: 4,
      suite: true,
      ids: ['p1', 'p2'],
      refuses: ['p3'],
      projets: [enregistre('p1')],
    });
  });
});
