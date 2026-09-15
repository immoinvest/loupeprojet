import type { Depense } from '@loupe/gestion';
import { describe, expect, it } from 'vitest';

import {
  lireDepense,
  saisieDepenseInitiale,
  saisieDepuisDepense,
  SANS_BIEN,
  texteDeCentimes,
  type SaisieDepense,
} from '@/gestion/argent/saisie-depense';
import {
  lirePret,
  periodeDepuisTexte,
  saisieDepuisPret,
  saisiePretVide,
  texteDePeriode,
  type SaisiePret,
} from '@/gestion/argent/saisie-pret';

const H = '2026-09-01T08:00:00.000Z';

describe('saisie d’une dépense', () => {
  const remplie: SaisieDepense = {
    ...saisieDepenseInitiale('2026-10-15', 'bien-lices'),
    montant: '840',
    categorie: 'taxe_fonciere',
    libelle: '  Taxe foncière 2026  ',
  };

  it('le formulaire vide : aujourd’hui, une seule fois, entretien, aucun bien par défaut', () => {
    expect(saisieDepenseInitiale('2026-10-15')).toEqual({
      montant: '',
      categorie: 'entretien',
      bienId: SANS_BIEN,
      date: '2026-10-15',
      libelle: '',
      recuperable: false,
      frequence: 'aucune',
      jusquAu: '',
    });
  });

  it('une dépense ponctuelle d’un bien : montant en centimes, libellé nettoyé', () => {
    expect(lireDepense(remplie)).toEqual({
      ok: true,
      depense: {
        bienId: 'bien-lices',
        categorie: 'taxe_fonciere',
        montant: 84_000,
        date: '2026-10-15',
        libelle: 'Taxe foncière 2026',
        recuperable: false,
      },
    });
  });

  it('commune, récupérable, qui revient, avec ou sans fin', () => {
    const recurrente = {
      ...remplie,
      bienId: SANS_BIEN,
      libelle: '',
      montant: '12,50',
      recuperable: true,
      frequence: 'mensuelle' as const,
    };
    expect(lireDepense(recurrente)).toEqual({
      ok: true,
      depense: {
        categorie: 'taxe_fonciere',
        montant: 1_250,
        date: '2026-10-15',
        recuperable: true,
        recurrence: { frequence: 'mensuelle' },
      },
    });
    const avecFin = lireDepense({ ...recurrente, jusquAu: '2027-06-30' });
    expect(avecFin.ok && avecFin.depense.recurrence).toEqual({
      frequence: 'mensuelle',
      jusquAu: '2027-06-30',
    });
  });

  it('erreurs dans l’ordre de l’écran ; une fin ignorée pour une dépense ponctuelle', () => {
    expect(
      lireDepense({
        ...remplie,
        montant: '0',
        date: '2026-02-30',
        libelle: 'x'.repeat(81),
        frequence: 'annuelle',
        jusquAu: '2026-01-01',
      }),
    ).toEqual({ ok: false, erreurs: ['montant', 'date', 'libelle', 'jusquAu'] });
    expect(lireDepense({ ...remplie, frequence: 'annuelle', jusquAu: '2026-10-14' })).toEqual({
      ok: false,
      erreurs: ['jusquAu'],
    });
    expect(lireDepense({ ...remplie, montant: 'beaucoup' })).toEqual({
      ok: false,
      erreurs: ['montant'],
    });
    expect(lireDepense({ ...remplie, frequence: 'annuelle', jusquAu: 'bientôt' })).toEqual({
      ok: false,
      erreurs: ['jusquAu'],
    });
    expect(lireDepense({ ...remplie, jusquAu: 'bientôt' }).ok).toBe(true);
  });

  it('modifier : le formulaire reprend la dépense enregistrée', () => {
    const depense: Depense = {
      id: 'd1',
      bienId: 'bien-lices',
      categorie: 'copropriete',
      montant: 27_050,
      date: '2026-10-01',
      libelle: 'Syndic',
      recuperable: true,
      recurrence: { frequence: 'trimestrielle', jusquAu: '2027-12-31' },
      creeLe: H,
      modifieLe: H,
    };
    expect(saisieDepuisDepense(depense)).toEqual({
      montant: '270,50',
      categorie: 'copropriete',
      bienId: 'bien-lices',
      date: '2026-10-01',
      libelle: 'Syndic',
      recuperable: true,
      frequence: 'trimestrielle',
      jusquAu: '2027-12-31',
    });
    const simple: Depense = {
      id: 'd2',
      categorie: 'autre',
      montant: 1_000,
      date: '2026-10-01',
      recuperable: false,
      creeLe: H,
      modifieLe: H,
    };
    expect(saisieDepuisDepense(simple)).toMatchObject({
      bienId: SANS_BIEN,
      libelle: '',
      frequence: 'aucune',
      jusquAu: '',
    });
    expect(texteDeCentimes(84_000)).toBe('840');
  });
});

describe('saisie du prêt', () => {
  const remplie: SaisiePret = {
    capital: '150 000 €',
    taux: '3,35 %',
    duree: '25',
    premiereEcheance: '11/2026',
    assurance: '31,25',
  };

  it('euros, pourcentage, années et mois deviennent le prêt', () => {
    expect(lirePret(remplie)).toEqual({
      ok: true,
      pret: {
        capital: 15_000_000,
        tauxAnnuel: 0.0335,
        dureeMois: 300,
        debut: '2026-11',
        assuranceMensuelle: 3_125,
      },
    });
    const autre = lirePret({
      ...remplie,
      duree: '17,5',
      assurance: '',
      premiereEcheance: '2027-01',
    });
    expect(autre.ok && autre.pret).toMatchObject({
      dureeMois: 210,
      assuranceMensuelle: 0,
      debut: '2027-01',
    });
  });

  it('chaque champ invalide est signalé, dans l’ordre de l’écran', () => {
    expect(
      lirePret({
        capital: '0',
        taux: '21',
        duree: '41',
        premiereEcheance: '13/2026',
        assurance: 'x',
      }),
    ).toEqual({
      ok: false,
      erreurs: ['capital', 'taux', 'duree', 'premiereEcheance', 'assurance'],
    });
    expect(lirePret({ ...remplie, capital: '5000000,01' })).toEqual({
      ok: false,
      erreurs: ['capital'],
    });
    expect(lirePret({ ...remplie, taux: 'trois' })).toEqual({ ok: false, erreurs: ['taux'] });
    expect(lirePret({ ...remplie, duree: '' })).toEqual({ ok: false, erreurs: ['duree'] });
    expect(lirePret({ ...remplie, premiereEcheance: 'novembre' })).toEqual({
      ok: false,
      erreurs: ['premiereEcheance'],
    });
    expect(lirePret({ ...remplie, assurance: '100000,01' })).toEqual({
      ok: false,
      erreurs: ['assurance'],
    });
  });

  it('mois de la première échéance : « 11/2026 », « 1-2027 », « 2026-11 » ; rien d’autre', () => {
    expect(periodeDepuisTexte(' 11/2026 ')).toBe('2026-11');
    expect(periodeDepuisTexte('1-2027')).toBe('2027-01');
    expect(periodeDepuisTexte('2026-11')).toBe('2026-11');
    expect(periodeDepuisTexte('0/2026')).toBeNull();
    expect(periodeDepuisTexte('2026-13')).toBeNull();
    expect(periodeDepuisTexte('')).toBeNull();
    expect(texteDePeriode('2026-11')).toBe('11/2026');
  });

  it('formulaire vide (mois en cours) et formulaire d’un prêt enregistré', () => {
    expect(saisiePretVide('2026-10')).toEqual({
      capital: '',
      taux: '',
      duree: '',
      premiereEcheance: '10/2026',
      assurance: '',
    });
    expect(
      saisieDepuisPret({
        capital: 15_000_000,
        tauxAnnuel: 0.0335,
        dureeMois: 210,
        debut: '2026-11',
        assuranceMensuelle: 3_125,
      }),
    ).toEqual({
      capital: '150000',
      taux: '3,35',
      duree: '17,5',
      premiereEcheance: '11/2026',
      assurance: '31,25',
    });
  });
});
