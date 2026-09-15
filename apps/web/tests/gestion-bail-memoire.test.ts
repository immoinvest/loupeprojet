import type { EtatGestion } from '@loupe/gestion';
import { describe, expect, it } from 'vitest';

import {
  clientBailIndisponible,
  clientBailMemoire,
  codeDepuisGestion,
  ETAT_BAIL_VIDE,
} from '@/gestion/bail/memoire';
import { clientGestionMemoire } from '@/gestion/memoire';

import { lettreJulie, REVISION_JULIE } from './bail-exemples';
import { BAILLEUR, BIEN_LICES, ETAT_SEPTEMBRE, LOCATION_JULIE } from './gestion-exemples';

const MAINTENANT = '2026-09-14T09:00:00.000Z';
const AVEC_BAILLEUR: EtatGestion = { ...ETAT_SEPTEMBRE, bailleur: BAILLEUR };
const LEGAL = { dpeClasse: 'D' as const, dpeDate: '2024-03-01', zoneTendue: true };
const REGLAGES = {
  active: true,
  anniversaire: '2025-10-01',
  trimestre: '2025-T2',
  formeBail: 'classique' as const,
};

describe('clientBailMemoire : DPE et réglages', () => {
  it('sans client de gestion : enregistre ; invalide refusé ; remplace l’existant', async () => {
    const client = clientBailMemoire();
    expect(await client.etat()).toEqual({ ok: true, valeur: ETAT_BAIL_VIDE });
    expect(await client.enregistrerBien('b1', { ...LEGAL, dpeClasse: 'H' } as never)).toEqual({
      ok: false,
      code: 'invalide',
    });
    await client.enregistrerBien('b1', LEGAL);
    expect(await client.enregistrerBien('b1', { ...LEGAL, zoneTendue: false })).toEqual({
      ok: true,
      valeur: { bienId: 'b1', ...LEGAL, zoneTendue: false, modifieLe: MAINTENANT },
    });
    expect(client.donnees().biens).toHaveLength(1);
    expect(await client.enregistrerRevision('l1', { ...REGLAGES, trimestre: '2025-T9' })).toEqual({
      ok: false,
      code: 'invalide',
    });
    expect(await client.enregistrerRevision('l1', REGLAGES)).toEqual({
      ok: true,
      valeur: { locationId: 'l1', ...REGLAGES, derniereRevision: null, modifieLe: MAINTENANT },
    });
    expect(client.appels).toEqual([
      'etat',
      'enregistrerBien',
      'enregistrerBien',
      'enregistrerBien',
      'enregistrerRevision',
      'enregistrerRevision',
    ]);
  });

  it('avec la gestion : bien ou location inconnus refusés ; gestion en panne : accepté comme sans gestion', async () => {
    const gestion = clientGestionMemoire({ etat: AVEC_BAILLEUR });
    const client = clientBailMemoire({ gestion });
    expect(await client.enregistrerBien('inconnu', LEGAL)).toEqual({
      ok: false,
      code: 'introuvable',
    });
    expect((await client.enregistrerBien(BIEN_LICES.id, LEGAL)).ok).toBe(true);
    expect(await client.enregistrerRevision('inconnue', REGLAGES)).toEqual({
      ok: false,
      code: 'introuvable',
    });
    expect((await client.enregistrerRevision(LOCATION_JULIE.id, REGLAGES)).ok).toBe(true);

    const enPanne = clientBailMemoire({
      gestion: clientGestionMemoire({ erreurs: { etat: 'reseau' } }),
    });
    expect((await enPanne.enregistrerBien('b1', LEGAL)).ok).toBe(true);
  });

  it('une erreur forcée sur une action', async () => {
    const client = clientBailMemoire({ erreurs: { etat: 'indisponible' } });
    expect(await client.etat()).toEqual({ ok: false, code: 'indisponible' });
  });
});

describe('clientBailMemoire : appliquer la révision', () => {
  it('écrit le changement dans la gestion, émet la lettre, garde la dernière révision ; une seconde fois : la même lettre', async () => {
    const gestion = clientGestionMemoire({ etat: AVEC_BAILLEUR, maintenant: MAINTENANT });
    const client = clientBailMemoire({ gestion, maintenant: MAINTENANT });
    const r = await client.appliquerRevision(LOCATION_JULIE.id, '2026-10-01');
    if (!r.ok) throw new Error(r.code);
    expect(r.valeur.lettre.contenu).toMatchObject({
      nouveauLoyer: 65_749,
      aPartirDe: '2026-10',
      locataires: [{ prenom: 'Julie', nom: 'Martin' }],
      logement: { nom: 'T2 Lices', adresse: BIEN_LICES.adresse },
    });
    expect(r.valeur.revision).toEqual({
      locationId: LOCATION_JULIE.id,
      active: true,
      anniversaire: '2025-10-01',
      trimestre: '2026-T2',
      formeBail: 'classique',
      derniereRevision: '2026-10-01',
      modifieLe: MAINTENANT,
    });
    expect(r.valeur.location.changements).toEqual([
      { aPartirDe: '2026-10', loyerHorsCharges: 65_749, charges: 5_000, apl: 0 },
    ]);
    expect(gestion.appels).toContain('modifierLocation');
    expect(client.donnees().lettres).toEqual([
      {
        id: 'lettre-1',
        locationId: LOCATION_JULIE.id,
        numero: r.valeur.lettre.numero,
        anniversaire: '2026-10-01',
        emisLe: MAINTENANT,
      },
    ]);

    const encore = await client.appliquerRevision(LOCATION_JULIE.id, '2026-10-01');
    expect(encore.ok && encore.valeur.lettre.id).toBe('lettre-1');
    expect(await client.lettre('lettre-1')).toEqual({ ok: true, valeur: r.valeur.lettre });
    expect(await client.lettre('inconnue')).toEqual({ ok: false, code: 'introuvable' });

    // Les réglages changés gardent la dernière révision appliquée.
    const reglages = await client.enregistrerRevision(LOCATION_JULIE.id, REGLAGES);
    expect(reglages.ok && reglages.valeur.derniereRevision).toBe('2026-10-01');
  });

  it('chambre et colocataire sur la lettre ; lettres fournies au départ', async () => {
    const location = {
      ...LOCATION_JULIE,
      libelle: 'Chambre 2',
      colocataireIds: ['locataire-antoine'],
    };
    const gestion = clientGestionMemoire({ etat: { ...AVEC_BAILLEUR, locations: [location] } });
    const client = clientBailMemoire({
      gestion,
      lettres: [lettreJulie()],
      etat: { ...ETAT_BAIL_VIDE, revisions: [{ ...REVISION_JULIE, anniversaire: '2025-10-02' }] },
    });
    const r = await client.appliquerRevision(location.id, '2026-10-02');
    expect(r.ok && r.valeur.lettre.contenu.logement.libelle).toBe('Chambre 2');
    expect(r.ok && r.valeur.lettre.contenu.locataires.map((l) => l.prenom)).toEqual([
      'Julie',
      'Antoine',
    ]);
    expect((await client.lettre('lettre-julie')).ok).toBe(true);
    // La lettre fournie vaut pour l'anniversaire du 1er octobre.
    const deja = await client.appliquerRevision(location.id, '2026-10-01');
    expect(deja.ok && deja.valeur.lettre.id).toBe('lettre-julie');
  });

  it('refus : sans gestion, gestion en panne, location ou bien inconnus, anniversaire faux, gel, bailleur, hors location, écriture refusée', async () => {
    expect(await clientBailMemoire().appliquerRevision('l', '2026-10-01')).toEqual({
      ok: false,
      code: 'introuvable',
    });
    const panne = clientBailMemoire({
      gestion: clientGestionMemoire({ erreurs: { etat: 'reseau' } }),
    });
    expect(await panne.appliquerRevision('l', '2026-10-01')).toEqual({
      ok: false,
      code: 'introuvable',
    });

    const client = clientBailMemoire({ gestion: clientGestionMemoire({ etat: AVEC_BAILLEUR }) });
    expect(await client.appliquerRevision('inconnue', '2026-10-01')).toEqual({
      ok: false,
      code: 'introuvable',
    });
    const orpheline = clientBailMemoire({
      gestion: clientGestionMemoire({ etat: { ...AVEC_BAILLEUR, biens: [] } }),
    });
    expect(await orpheline.appliquerRevision(LOCATION_JULIE.id, '2026-10-01')).toEqual({
      ok: false,
      code: 'introuvable',
    });
    expect(await client.appliquerRevision(LOCATION_JULIE.id, '2027-10-01')).toEqual({
      ok: false,
      code: 'revision_impossible',
    });

    const gelee = clientBailMemoire({
      gestion: clientGestionMemoire({ etat: AVEC_BAILLEUR }),
      etat: {
        ...ETAT_BAIL_VIDE,
        biens: [
          {
            bienId: BIEN_LICES.id,
            dpeClasse: 'F',
            dpeDate: null,
            zoneTendue: null,
            modifieLe: 'x',
          },
        ],
      },
    });
    expect(await gelee.appliquerRevision(LOCATION_JULIE.id, '2026-10-01')).toEqual({
      ok: false,
      code: 'revision_impossible',
    });

    const sansBailleur = clientBailMemoire({
      gestion: clientGestionMemoire({ etat: ETAT_SEPTEMBRE }),
    });
    expect(await sansBailleur.appliquerRevision(LOCATION_JULIE.id, '2026-10-01')).toEqual({
      ok: false,
      code: 'bailleur_manquant',
    });

    const courte = { ...LOCATION_JULIE, debut: '2025-10-10', fin: '2026-10-20' };
    const hors = clientBailMemoire({
      gestion: clientGestionMemoire({ etat: { ...AVEC_BAILLEUR, locations: [courte] } }),
      maintenant: '2026-09-20T09:00:00.000Z',
    });
    expect(await hors.appliquerRevision(courte.id, '2026-10-10')).toEqual({
      ok: false,
      code: 'hors_location',
    });

    const refusee = clientBailMemoire({
      gestion: clientGestionMemoire({
        etat: AVEC_BAILLEUR,
        erreurs: { modifierLocation: 'periode_payee' },
      }),
    });
    expect(await refusee.appliquerRevision(LOCATION_JULIE.id, '2026-10-01')).toEqual({
      ok: false,
      code: 'periode_payee',
    });
  });

  it('codes de la gestion ; client indisponible', async () => {
    expect(codeDepuisGestion('limite')).toBe('limite');
    expect(codeDepuisGestion('invalide')).toBe('inconnue');
    const indisponible = { ok: false, code: 'indisponible' };
    expect(await clientBailIndisponible.etat()).toEqual(indisponible);
    expect(await clientBailIndisponible.enregistrerBien('b', LEGAL)).toEqual(indisponible);
    expect(await clientBailIndisponible.enregistrerRevision('l', REGLAGES)).toEqual(indisponible);
    expect(await clientBailIndisponible.appliquerRevision('l', '2026-10-01')).toEqual(indisponible);
    expect(await clientBailIndisponible.lettre('x')).toEqual(indisponible);
  });
});
