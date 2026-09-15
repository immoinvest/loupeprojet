import { describe, expect, it } from 'vitest';

import {
  cleRegularisation,
  cleRestitution,
  ContenuDecompteSchema,
  contenuRegularisation,
  contenuRestitution,
  DecompteCompletSchema,
  DecompteSchema,
  numeroDecompte,
} from '../src/decomptes';
import {
  ColocataireChangeSchema,
  CongeEnregistreSchema,
  ETAT_FIN_BAIL_VIDE,
  EtatFinBailSchema,
} from '../src/etat-fin-bail';
import { regularisationDeLAnnee, type DecompteCharges } from '../src/regularisation';
import { location } from './exemples';

const IDENTITES = {
  bailleur: { nom: 'Camille Roux', adresse: '3 rue Paradis, 13006 Marseille' },
  locataires: [{ prenom: 'Julie', nom: 'Martin' }],
  logement: { nom: 'T2 Lices', adresse: '12 rue des Lices, Marseille' },
  emisLe: '2027-04-02',
};

const LOCATION = { ...location('loc-3f9a2c1b-99', { fin: '2027-03-31' }), depot: 65_000 };

describe('décomptes figés (ADR-G39)', () => {
  it('clés et numéros', () => {
    expect(cleRestitution('l1')).toBe('restitution:l1');
    expect(cleRegularisation('l1', 2026)).toBe('regularisation:l1:2026');
    expect(numeroDecompte('restitution', '2027-03', LOCATION.id)).toBe('D-202703-LOC3F9A2');
    expect(numeroDecompte('regularisation', '2026', LOCATION.id)).toBe('C-2026-LOC3F9A2');
  });

  it('restitution : retenues, montant rendu jamais négatif, sortie reprise des clés sans date de fin', () => {
    const retenues = [{ motif: 'Peinture', montant: 12_000 }];
    const avecRetenues = contenuRestitution(IDENTITES, LOCATION, {
      clesLe: '2027-03-31',
      conforme: false,
      retenues,
      dateLimite: '2027-05-31',
    });
    expect(avecRetenues).toMatchObject({
      type: 'restitution',
      numero: 'D-202703-LOC3F9A2',
      entree: '2025-10-01',
      sortie: '2027-03-31',
      depot: 65_000,
      totalRetenues: 12_000,
      aRendre: 53_000,
    });
    const sansFin = { ...location('l1'), depot: 10_000 };
    const tout = contenuRestitution(IDENTITES, sansFin, {
      clesLe: '2027-03-15',
      conforme: false,
      retenues: [{ motif: 'Serrure', montant: 10_000 }],
      dateLimite: '2027-05-15',
    });
    expect(tout).toMatchObject({ sortie: '2027-03-15', aRendre: 0 });
    expect(ContenuDecompteSchema.safeParse(tout).success).toBe(true);
    const complet = {
      id: 'd1',
      type: 'restitution',
      locationId: 'l1',
      numero: tout.numero,
      emisLe: '2027-04-02T08:00:00.000Z',
      contenu: tout,
    };
    expect(DecompteCompletSchema.safeParse(complet).success).toBe(true);
    expect(DecompteSchema.parse(complet)).not.toHaveProperty('contenu');
    expect(ContenuDecompteSchema.safeParse({ ...tout, type: 'quittance' }).success).toBe(false);
  });

  it('régularisation : le décompte proposé, figé avec son échéance', () => {
    const l = location('l1');
    const proposition = regularisationDeLAnnee({
      location: l,
      locationsDuBien: [l],
      depenses: [
        {
          bienId: 'bien-lices',
          categorie: 'copropriete',
          montant: 4_500,
          date: '2026-01-10',
          recuperable: true,
          recurrence: { frequence: 'mensuelle' },
        },
      ],
      annee: 2026,
      mode: 'provision',
    }) as DecompteCharges;
    const contenu = contenuRegularisation(IDENTITES, 'l1', proposition, '2027-03');
    expect(contenu).toMatchObject({
      type: 'regularisation',
      numero: 'C-2026-L1',
      provisions: 60_000,
      totalCharges: 54_000,
      solde: -6_000,
      aPartirDe: '2027-03',
    });
  });

  it('état et réponses de l’API', () => {
    expect(EtatFinBailSchema.parse(ETAT_FIN_BAIL_VIDE)).toEqual(ETAT_FIN_BAIL_VIDE);
    const conge = {
      locationId: 'l1',
      recuLe: '2026-09-05',
      fin: '2026-12-05',
      reduit: false,
      modifieLe: '2026-09-05T08:00:00.000Z',
    };
    const loc = location('l1', { fin: '2026-12-05' });
    expect(CongeEnregistreSchema.safeParse({ conge, location: loc }).success).toBe(true);
    const change = { location: loc, locataire: null, mouvements: [] };
    expect(ColocataireChangeSchema.safeParse(change).success).toBe(true);
  });
});
