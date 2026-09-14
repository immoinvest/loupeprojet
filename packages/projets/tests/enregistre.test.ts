import { projetExemple } from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import {
  dateDeModification,
  estExempleIntact,
  migrerEnregistre,
  ProjetEnregistreSchema,
  VisiteSchema,
} from '../src/enregistre';
import { DIX_HEURES_UNE, enregistre, exemple } from './exemples';

describe('migrerEnregistre', () => {
  it('laisse passer tel quel ce qui n’est pas un projet enregistré', () => {
    for (const brut of [null, 'texte', 12, [], { nom: 'sans projet' }]) {
      expect(migrerEnregistre(brut)).toBe(brut);
    }
  });

  it('migre le projet du moteur et garde le reste', () => {
    const brut = { ...enregistre('p1'), projet: { ...projetExemple, id: 'p1' } };
    const migre = migrerEnregistre(brut);
    expect(ProjetEnregistreSchema.parse(migre)).toMatchObject({ id: 'p1', nom: 'Projet p1' });
  });
});

describe('dateDeModification', () => {
  it('maintenant, ou une milliseconde après la précédente si l’horloge n’a pas avancé', () => {
    const maintenant = new Date('2026-09-14T10:00:00.000Z');
    expect(dateDeModification('2026-09-14T09:00:00.000Z', maintenant)).toBe(
      '2026-09-14T10:00:00.000Z',
    );
    expect(dateDeModification('2026-09-14T10:00:00.000Z', maintenant)).toBe(
      '2026-09-14T10:00:00.001Z',
    );
    expect(dateDeModification('pas une date', maintenant)).toBe('2026-09-14T10:00:00.000Z');
    expect(dateDeModification(DIX_HEURES_UNE) > DIX_HEURES_UNE).toBe(true);
  });
});

describe('estExempleIntact', () => {
  it('reconnaît l’exemple jamais touché', () => {
    expect(estExempleIntact(exemple())).toBe(true);
  });

  it('un nom, une date, une adresse ou une visite en font un vrai projet', () => {
    const adresse = {
      libelle: '12 rue des Lices 13005 Marseille',
      lat: 43.29,
      lon: 5.39,
      codeInsee: '13205',
      codeVoie: null,
      numero: 12,
    };
    const variantes = [
      enregistre('exemple'),
      { ...exemple(), modifieLe: DIX_HEURES_UNE },
      { ...exemple(), adresse },
      { ...exemple(), visite: VisiteSchema.parse({ faite: false }) },
    ];
    for (const p of variantes) expect(estExempleIntact(p)).toBe(false);
  });
});
