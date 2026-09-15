import type { ContextePreavis } from '@loupe/gestion';
import { describe, expect, it } from 'vitest';

import {
  congeRecalcule,
  lireColocataire,
  lireConge,
  lireRestitution,
  saisieCongeInitiale,
  saisieColocataireInitiale,
  saisieRestitutionInitiale,
  SANS_SORTANT,
} from '@/gestion/fin-bail/saisie';

const AUJOURDHUI = '2026-09-14';
const VIDE_NUE: ContextePreavis = {
  type: 'nue',
  formeBail: 'classique',
  zoneTendue: false,
  reduit: false,
};

describe('formulaire du congé', () => {
  it('ouvert aujourd’hui, sortie au bout du préavis ; recalculée quand le motif change', () => {
    const saisie = saisieCongeInitiale(VIDE_NUE, AUJOURDHUI);
    expect(saisie).toEqual({ recuLe: AUJOURDHUI, fin: '2026-12-14', reduit: false });
    expect(congeRecalcule({ ...saisie, reduit: true }, VIDE_NUE).fin).toBe('2026-10-14');
    expect(congeRecalcule({ ...saisie, recuLe: '2026-09-31' }, VIDE_NUE).fin).toBe('2026-12-14');
    expect(saisieCongeInitiale({ ...VIDE_NUE, type: 'meublee' }, AUJOURDHUI).fin).toBe(
      '2026-10-14',
    );
  });

  it('lecture : dates valides, fin après la réception', () => {
    const saisie = { recuLe: '2026-09-05', fin: '2026-12-05', reduit: false };
    expect(lireConge(saisie)).toEqual({ ok: true, conge: saisie });
    expect(lireConge({ ...saisie, recuLe: 'hier' })).toEqual({
      ok: false,
      erreurs: ['recuLe', 'fin'],
    });
    expect(lireConge({ ...saisie, fin: '2026-09-04' })).toEqual({ ok: false, erreurs: ['fin'] });
    expect(lireConge({ ...saisie, fin: '2026-02-30' })).toEqual({ ok: false, erreurs: ['fin'] });
  });
});

describe('formulaire de la restitution', () => {
  it('clés remises à la sortie, ou aujourd’hui si la sortie est à venir', () => {
    expect(saisieRestitutionInitiale('2026-08-31', AUJOURDHUI)).toEqual({
      clesLe: '2026-08-31',
      conforme: true,
      retenues: [{ motif: '', montant: '' }],
    });
    expect(saisieRestitutionInitiale('2026-12-05', AUJOURDHUI).clesLe).toBe(AUJOURDHUI);
  });

  it('état des lieux conforme : aucune retenue envoyée ; sinon au moins une, complète', () => {
    const conforme = saisieRestitutionInitiale('2026-08-31', AUJOURDHUI);
    expect(lireRestitution(conforme)).toEqual({
      ok: true,
      restitution: { clesLe: '2026-08-31', conforme: true, retenues: [] },
    });
    expect(lireRestitution({ ...conforme, clesLe: 'demain' })).toEqual({
      ok: false,
      erreurs: ['clesLe'],
    });

    const avecRetenues = { ...conforme, conforme: false };
    expect(lireRestitution(avecRetenues)).toEqual({ ok: false, erreurs: ['retenues'] });
    expect(
      lireRestitution({ ...avecRetenues, retenues: [{ motif: 'Peinture', montant: 'beaucoup' }] }),
    ).toEqual({ ok: false, erreurs: ['retenues'] });
    expect(lireRestitution({ ...avecRetenues, retenues: [{ motif: '', montant: '120' }] })).toEqual(
      { ok: false, erreurs: ['retenues'] },
    );
    expect(
      lireRestitution({
        ...avecRetenues,
        retenues: [
          { motif: ' Peinture ', montant: '120' },
          { motif: '', montant: '' },
        ],
      }),
    ).toEqual({
      ok: true,
      restitution: {
        clesLe: '2026-08-31',
        conforme: false,
        retenues: [{ motif: 'Peinture', montant: 12_000 }],
      },
    });
    const trop = Array.from({ length: 21 }, () => ({ motif: 'Travaux', montant: '10' }));
    expect(lireRestitution({ ...avecRetenues, retenues: trop })).toEqual({
      ok: false,
      erreurs: ['retenues'],
    });
  });
});

describe('formulaire du changement de colocataire', () => {
  const initiale = saisieColocataireInitiale(AUJOURDHUI);

  it('ouvert sur aujourd’hui, personne ne part ni n’arrive', () => {
    expect(initiale).toEqual({
      sortantId: SANS_SORTANT,
      dateDepart: AUJOURDHUI,
      arrivant: '',
      email: '',
      dateArrivee: AUJOURDHUI,
    });
    expect(lireColocataire(initiale)).toEqual({ ok: false, erreurs: ['sortantId'] });
  });

  it('un départ, une arrivée, ou les deux ; l’e-mail est facultatif', () => {
    const depart = { ...initiale, sortantId: 'locataire-julie' };
    expect(lireColocataire(depart)).toEqual({
      ok: true,
      changement: { depart: { locataireId: 'locataire-julie', date: AUJOURDHUI } },
    });
    const arrivee = { ...initiale, arrivant: 'Hugo Petit', email: ' hugo@exemple.fr ' };
    expect(lireColocataire(arrivee)).toEqual({
      ok: true,
      changement: {
        arrivee: {
          locataire: { prenom: 'Hugo', nom: 'Petit', email: 'hugo@exemple.fr' },
          date: AUJOURDHUI,
        },
      },
    });
    const remplacement = { ...depart, arrivant: 'Hugo Petit', dateArrivee: '2026-09-15' };
    expect(lireColocataire(remplacement)).toEqual({
      ok: true,
      changement: {
        depart: { locataireId: 'locataire-julie', date: AUJOURDHUI },
        arrivee: { locataire: { prenom: 'Hugo', nom: 'Petit' }, date: '2026-09-15' },
      },
    });
  });

  it('refus : nom incomplet, dates invalides', () => {
    expect(lireColocataire({ ...initiale, arrivant: 'Hugo' })).toEqual({
      ok: false,
      erreurs: ['arrivant'],
    });
    expect(
      lireColocataire({ ...initiale, sortantId: 'locataire-julie', dateDepart: 'hier' }),
    ).toEqual({ ok: false, erreurs: ['dateDepart'] });
    expect(
      lireColocataire({ ...initiale, arrivant: 'Hugo Petit', dateArrivee: '2026-13-01' }),
    ).toEqual({ ok: false, erreurs: ['dateArrivee'] });
  });
});
