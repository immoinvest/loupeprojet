import type { EtatBail, EtatGestion } from '@loupe/gestion';
import { describe, expect, it } from 'vitest';

import { actionsAFaire, cleAction } from '@/gestion/a-faire';
import { lienConformite, lienLettre, lienRevision } from '@/gestion/parcours';
import {
  actionsBail,
  alertesDuBien,
  derniereLettre,
  legalDuBien,
  propositionDe,
  revisionDeLaLocation,
} from '@/gestion/bail/vue';
import {
  choixClasse,
  choixOuiNon,
  lireConformite,
  lireReglages,
  trimestresProposes,
} from '@/gestion/bail/saisie';

import { REVISION_JULIE } from './bail-exemples';
import {
  BIEN_BAILLE,
  BIEN_LICES,
  ETAT_SEPTEMBRE,
  LOCATION_ANTOINE,
  LOCATION_JULIE,
} from './gestion-exemples';

const AUJOURDHUI = '2026-09-14';
const VIDE: EtatBail = { biens: [], revisions: [], lettres: [] };
const LICES_ANALYSE = { ...BIEN_LICES, codePostal: '13005', projet: { bien: { dpe: 'E' } } };

describe('legalDuBien et revisionDeLaLocation', () => {
  it('saisi par le bailleur, sinon repris de l’analyse, sinon inconnu', () => {
    const saisi = {
      bienId: 'bien-lices',
      dpeClasse: 'G' as const,
      dpeDate: '2016-01-01',
      zoneTendue: true,
      modifieLe: 'x',
    };
    expect(legalDuBien(LICES_ANALYSE, { ...VIDE, biens: [saisi] })).toEqual({
      dpeClasse: 'G',
      dpeDate: '2016-01-01',
      zoneTendue: true,
      provenance: 'saisie',
    });
    expect(legalDuBien(LICES_ANALYSE, VIDE)).toEqual({
      dpeClasse: 'E',
      dpeDate: null,
      zoneTendue: null,
      provenance: 'analyse',
    });
    expect(legalDuBien(BIEN_LICES, VIDE).provenance).toBe('aucune');
  });

  it('réglages enregistrés, sinon par défaut (anniversaire de l’entrée)', () => {
    expect(
      revisionDeLaLocation(LOCATION_JULIE, { ...VIDE, revisions: [REVISION_JULIE] }, AUJOURDHUI),
    ).toEqual({
      ...REVISION_JULIE,
      provenance: 'saisie',
    });
    expect(revisionDeLaLocation(LOCATION_JULIE, VIDE, AUJOURDHUI)).toEqual({
      locationId: 'location-julie',
      active: true,
      anniversaire: '2025-10-01',
      trimestre: '2025-T2',
      formeBail: 'classique',
      derniereRevision: null,
      modifieLe: LOCATION_JULIE.creeLe,
      provenance: 'par_defaut',
    });
  });

  it('propositionDe : DPE du bien (G gèle) ; bien introuvable : sans DPE', () => {
    const etat: EtatGestion = {
      ...ETAT_SEPTEMBRE,
      biens: [{ ...BIEN_LICES, projet: { bien: { dpe: 'G' } } }, BIEN_BAILLE],
    };
    expect(propositionDe(LOCATION_JULIE, etat, VIDE, AUJOURDHUI).statut).toBe('gelee');
    const orpheline = { ...LOCATION_JULIE, bienId: 'inconnu' };
    expect(propositionDe(orpheline, etat, VIDE, AUJOURDHUI)).toMatchObject({
      statut: 'proposee',
      nouveauLoyer: 65_749,
    });
  });
});

describe('alertes et actions de la vie du bail', () => {
  it('alertesDuBien : DPE de l’analyse et fin d’un bail mobilité enregistré', () => {
    const etat: EtatGestion = {
      ...ETAT_SEPTEMBRE,
      locations: [
        { ...LOCATION_JULIE, fin: '2026-09-30' },
        { ...LOCATION_JULIE, id: 'finie', fin: '2026-01-31' },
      ],
    };
    const bail: EtatBail = { ...VIDE, revisions: [{ ...REVISION_JULIE, formeBail: 'mobilite' }] };
    expect(
      alertesDuBien({ ...BIEN_LICES, projet: { bien: { dpe: 'G' } } }, etat, bail, AUJOURDHUI),
    ).toEqual([
      { code: 'location_interdite', classe: 'G', depuis: '2025-01-01' },
      {
        code: 'fin_bail_court',
        locationId: 'location-julie',
        forme: 'mobilite',
        fin: '2026-09-30',
      },
    ]);
  });

  it('actionsBail : alertes urgentes par nom de bien, puis révisions proposées ; À faire les met en dernier', () => {
    const etat: EtatGestion = {
      ...ETAT_SEPTEMBRE,
      biens: [{ ...BIEN_LICES, projet: { bien: { dpe: 'G' } } }, BIEN_BAILLE],
      locations: [LOCATION_JULIE, { ...LOCATION_ANTOINE, locataireId: 'inconnu' }],
    };
    const bail: EtatBail = {
      ...VIDE,
      biens: [
        {
          bienId: 'bien-baille',
          dpeClasse: 'D',
          dpeDate: '2016-05-01',
          zoneTendue: null,
          modifieLe: 'x',
        },
      ],
    };
    const actions = actionsBail(etat, bail, AUJOURDHUI);
    expect(
      actions.map((a) =>
        a.type === 'alerte' ? `${a.bien.nom} ${a.alerte.code}` : `${a.bien.nom} révision`,
      ),
    ).toEqual([
      'Studio Baille dpe_perime',
      'T2 Lices location_interdite',
      'Studio Baille révision',
    ]);
    const revision = actions[2];
    expect(revision?.type === 'revision' ? revision.locataire : 'autre').toBeUndefined();

    const toutes = actionsAFaire(etat, AUJOURDHUI, actions);
    expect(toutes.slice(-3).map(cleAction)).toEqual([
      'alerte-bien-baille-dpe_perime',
      'alerte-bien-lices-location_interdite',
      'revision-location-antoine',
    ]);
    expect(actionsAFaire(etat, AUJOURDHUI).map(cleAction)).not.toContain(
      'revision-location-antoine',
    );
    expect(
      cleAction({
        type: 'alerte',
        bien: BIEN_LICES,
        alerte: { code: 'fin_bail_court', locationId: 'l1', forme: 'etudiant', fin: '2026-09-30' },
      }),
    ).toBe('alerte-bien-lices-fin_bail_court-l1');
  });

  it('derniereLettre : la plus récente de la location', () => {
    const lettres = [
      { id: 'a', locationId: 'l1', numero: 'V-1', anniversaire: '2025-10-01', emisLe: 'x' },
      { id: 'b', locationId: 'l1', numero: 'V-2', anniversaire: '2026-10-01', emisLe: 'x' },
      { id: 'c', locationId: 'l2', numero: 'V-3', anniversaire: '2027-10-01', emisLe: 'x' },
    ];
    expect(derniereLettre({ ...VIDE, lettres }, 'l1')?.id).toBe('b');
    expect(derniereLettre(VIDE, 'l1')).toBeUndefined();
  });
});

describe('adresses de la vie du bail', () => {
  it('lettre avec retour, carte Conformité et carte Révision de la fiche', () => {
    expect(lienLettre('v/1', '/gerer/biens/b1')).toBe(
      '/gerer/lettres/v%2F1?retour=%2Fgerer%2Fbiens%2Fb1',
    );
    expect(lienConformite('b1')).toBe('/gerer/biens/b1#conformite');
    expect(lienRevision('b1', 'l1')).toBe('/gerer/biens/b1#revision-l1');
  });
});

describe('saisies de la vie du bail', () => {
  it('conformité : classe, date vide ou valide, zone ; date invalide refusée', () => {
    expect(choixClasse(null)).toBe('inconnue');
    expect(choixClasse('B')).toBe('B');
    expect([choixOuiNon(null), choixOuiNon(true), choixOuiNon(false)]).toEqual([
      'inconnue',
      'oui',
      'non',
    ]);
    expect(lireConformite({ classe: 'inconnue', date: ' ', zone: 'inconnue' })).toEqual({
      ok: true,
      saisie: { dpeClasse: null, dpeDate: null, zoneTendue: null },
    });
    expect(lireConformite({ classe: 'F', date: '2024-03-01', zone: 'oui' })).toEqual({
      ok: true,
      saisie: { dpeClasse: 'F', dpeDate: '2024-03-01', zoneTendue: true },
    });
    expect(lireConformite({ classe: 'F', date: '2024-02-30', zone: 'non' })).toEqual({ ok: false });
  });

  it('réglages : date anniversaire exigée ; trimestres du plus récent, l’actuel ajouté s’il est ancien', () => {
    expect(
      lireReglages({
        active: 'non',
        anniversaire: '2025-10-01',
        trimestre: '2025-T2',
        formeBail: 'etudiant',
      }),
    ).toEqual({
      ok: true,
      saisie: {
        active: false,
        anniversaire: '2025-10-01',
        trimestre: '2025-T2',
        formeBail: 'etudiant',
      },
    });
    expect(
      lireReglages({
        active: 'oui',
        anniversaire: '',
        trimestre: '2025-T2',
        formeBail: 'classique',
      }),
    ).toEqual({ ok: false });
    expect(trimestresProposes('2025-T2')[0]).toBe('2026-T2');
    expect(trimestresProposes('2025-T2')).not.toContain('2019-T1');
    expect(trimestresProposes('2019-T1').slice(0, 2)).toEqual(['2019-T1', '2026-T2']);
  });
});
