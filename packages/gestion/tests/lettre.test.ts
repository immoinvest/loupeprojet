import { describe, expect, it } from 'vitest';

import { propositionRevision, type PropositionProposee } from '../src/bail';
import {
  cleLettre,
  ContenuLettreRevisionSchema,
  contenuLettreRevision,
  EtatBailSchema,
  numeroLettre,
} from '../src/lettre';
import { location } from './exemples';

function proposee(): PropositionProposee {
  const p = propositionRevision({
    location: location('3f9a2c1b-7d04'),
    paiements: [],
    revision: {
      active: true,
      anniversaire: '2025-10-01',
      trimestre: '2025-T2',
      formeBail: 'classique',
      derniereRevision: null,
    },
    classeDpe: 'D',
    aujourdhui: '2026-09-01',
  });
  if (p.statut !== 'proposee') throw new Error('proposition attendue');
  return p;
}

describe('lettre de révision', () => {
  it('clé par location et anniversaire ; numéro V-mois d’effet-location', () => {
    expect(cleLettre('l1', '2026-10-01')).toBe('revision:l1:2026-10-01');
    expect(numeroLettre('2026-10', '3f9a2c1b-7d04')).toBe('V-202610-3F9A2C1B');
  });

  it('contenu figé : parties, logement, loyers, indices, effet', () => {
    const contenu = contenuLettreRevision({
      locationId: '3f9a2c1b-7d04',
      bailleur: { nom: 'Pierre Georgel', adresse: '3 rue Paradis, 13006 Marseille' },
      locataires: [{ prenom: 'Julie', nom: 'Martin' }],
      logement: { nom: 'T2 Lices', adresse: '12 rue des Lices', libelle: 'Chambre 2' },
      proposition: proposee(),
      emisLe: '2026-09-01',
    });
    expect(contenu).toEqual({
      numero: 'V-202610-3F9A2C1B',
      emisLe: '2026-09-01',
      bailleur: { nom: 'Pierre Georgel', adresse: '3 rue Paradis, 13006 Marseille' },
      locataires: [{ prenom: 'Julie', nom: 'Martin' }],
      logement: { nom: 'T2 Lices', adresse: '12 rue des Lices', libelle: 'Chambre 2' },
      anniversaire: '2026-10-01',
      aPartirDe: '2026-10',
      loyerActuel: 65_000,
      nouveauLoyer: 65_749,
      charges: 5_000,
      indiceAncien: { trimestre: '2025-T2', valeur: 14_668 },
      indiceNouveau: { trimestre: '2026-T2', valeur: 14_837, publieLe: '2026-07-10' },
      variationPourcent: 1.15,
    });
    expect(ContenuLettreRevisionSchema.safeParse({ ...contenu, locataires: [] }).success).toBe(
      false,
    );
  });

  it('état du bail vide valide ; trimestre mal formé refusé', () => {
    expect(EtatBailSchema.parse({ biens: [], revisions: [], lettres: [] })).toEqual({
      biens: [],
      revisions: [],
      lettres: [],
    });
    const revision = {
      locationId: 'l1',
      active: true,
      anniversaire: '2025-10-01',
      trimestre: '2025-T5',
      formeBail: 'classique',
      derniereRevision: null,
      modifieLe: 'x',
    };
    expect(
      EtatBailSchema.safeParse({ biens: [], revisions: [revision], lettres: [] }).success,
    ).toBe(false);
  });
});
