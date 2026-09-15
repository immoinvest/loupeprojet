import type { Depense, EtatBail, EtatFinBail, LocationGeree, Regularisation } from '@loupe/gestion';
import { describe, expect, it } from 'vitest';

import {
  actionsFinBail,
  anneesProposees,
  cleActionFinBail,
  congeDe,
  contextePreavis,
  depotAuDessusDuMaximum,
  depotDe,
  locationsASolder,
  modeChargesDe,
  preavisDe,
  presentsDuMois,
  propositionCharges,
  regularisationsDe,
  restitutionDe,
  statutDe,
} from '@/gestion/fin-bail/vue';

import { ANTOINE, BIEN_LICES, ETAT_SEPTEMBRE, JULIE, LOCATION_JULIE } from './gestion-exemples';

const AUJOURDHUI = '2026-09-14';
const H = '2026-09-14T09:00:00.000Z';

const VIDE: EtatFinBail = {
  conges: [],
  charges: [],
  restitutions: [],
  regularisations: [],
  mouvements: [],
  decomptes: [],
};

const BAIL_VIDE: EtatBail = { biens: [], revisions: [], lettres: [] };

const CONGE = {
  locationId: LOCATION_JULIE.id,
  recuLe: '2026-09-05',
  fin: '2026-10-05',
  reduit: false,
  modifieLe: H,
};

/** Julie est partie le 20 août 2026 : le dépôt est à rendre avant le 20 septembre. */
const TERMINEE: LocationGeree = { ...LOCATION_JULIE, fin: '2026-08-20' };

const COPRO: Depense = {
  id: 'depense-copro',
  bienId: 'bien-lices',
  categorie: 'copropriete',
  montant: 4_500,
  date: '2025-01-10',
  recuperable: true,
  recurrence: { frequence: 'mensuelle' },
  creeLe: H,
  modifieLe: H,
};

describe('congé, statut et préavis', () => {
  it('le congé d’une location, et le statut qui en découle', () => {
    const etat = { ...VIDE, conges: [CONGE] };
    expect(congeDe(etat, LOCATION_JULIE.id)).toEqual(CONGE);
    expect(congeDe(VIDE, LOCATION_JULIE.id)).toBeUndefined();
    const enPreavis = { ...LOCATION_JULIE, fin: '2026-10-05' };
    expect(statutDe(enPreavis, etat, AUJOURDHUI)).toBe('preavis');
    expect(statutDe(enPreavis, VIDE, AUJOURDHUI)).toBe('active');
    expect(statutDe(LOCATION_JULIE, null, AUJOURDHUI)).toBe('active');
    expect(statutDe(TERMINEE, etat, AUJOURDHUI)).toBe('terminee');
  });

  it('le préavis suit le type, la forme du bail et la zone tendue de B1 ; sans elles, trois mois', () => {
    const nue = { ...LOCATION_JULIE, type: 'nue' as const };
    expect(contextePreavis(nue, BIEN_LICES, null, false, AUJOURDHUI)).toEqual({
      type: 'nue',
      formeBail: 'classique',
      zoneTendue: null,
      reduit: false,
    });
    expect(preavisDe(contextePreavis(nue, BIEN_LICES, null, false, AUJOURDHUI))).toEqual({
      mois: 3,
      raison: 'zone_inconnue',
    });
    expect(contextePreavis(nue, undefined, BAIL_VIDE, true, AUJOURDHUI).zoneTendue).toBeNull();

    const bail: EtatBail = {
      ...BAIL_VIDE,
      biens: [
        {
          bienId: BIEN_LICES.id,
          dpeClasse: 'D',
          dpeDate: null,
          zoneTendue: true,
          modifieLe: H,
        },
      ],
    };
    const contexte = contextePreavis(nue, BIEN_LICES, bail, false, AUJOURDHUI);
    expect(contexte.zoneTendue).toBe(true);
    expect(preavisDe(contexte)).toEqual({ mois: 1, raison: 'zone_tendue' });
  });
});

describe('dépôt de garantie', () => {
  it('à rendre après la sortie, avec sa date limite ; la restitution enregistrée fait foi', () => {
    expect(depotDe(LOCATION_JULIE, VIDE, AUJOURDHUI).statut).toBe('en_cours');
    expect(depotDe(TERMINEE, null, AUJOURDHUI)).toMatchObject({
      statut: 'a_rendre',
      dateLimite: '2026-09-20',
      supposee: true,
      rappel: true,
    });
    const restitution = {
      locationId: TERMINEE.id,
      clesLe: '2026-08-20',
      conforme: false,
      retenues: [{ motif: 'Peinture', montant: 12_000 }],
      depot: 130_000,
      aRendre: 118_000,
      dateLimite: '2026-10-20',
      decompteId: 'd1',
      rendueLe: null,
      modifieLe: H,
    };
    const etat = { ...VIDE, restitutions: [restitution] };
    expect(restitutionDe(etat, TERMINEE.id)).toEqual(restitution);
    expect(depotDe(TERMINEE, etat, AUJOURDHUI)).toMatchObject({
      aRendre: 118_000,
      dateLimite: '2026-10-20',
      supposee: false,
      rappel: false,
    });
  });

  it('un dépôt au-dessus du maximum légal est signalé, jamais corrigé', () => {
    // Meublé : 1 300 € pour 650 € de loyer, c'est le maximum.
    expect(depotAuDessusDuMaximum(LOCATION_JULIE, null, AUJOURDHUI)).toBe(false);
    const trop = { ...LOCATION_JULIE, type: 'nue' as const };
    expect(depotAuDessusDuMaximum(trop, null, AUJOURDHUI)).toBe(true);
    const bail: EtatBail = {
      ...BAIL_VIDE,
      revisions: [
        {
          locationId: LOCATION_JULIE.id,
          active: true,
          anniversaire: '2025-10-01',
          trimestre: '2025-T2',
          formeBail: 'mobilite',
          derniereRevision: null,
          modifieLe: H,
        },
      ],
    };
    // Bail mobilité : aucun dépôt permis.
    expect(depotAuDessusDuMaximum(LOCATION_JULIE, bail, AUJOURDHUI)).toBe(true);
  });
});

describe('charges', () => {
  it('provisions par défaut, forfait enregistré ; années proposées et décompte', () => {
    expect(modeChargesDe(VIDE, LOCATION_JULIE.id)).toBe('provision');
    const forfait = {
      ...VIDE,
      charges: [{ locationId: LOCATION_JULIE.id, mode: 'forfait' as const, modifieLe: H }],
    };
    expect(modeChargesDe(forfait, LOCATION_JULIE.id)).toBe('forfait');
    expect(anneesProposees(LOCATION_JULIE, VIDE, AUJOURDHUI)).toEqual([2025]);

    // 3 mois de provisions (150 €) contre 92 jours de charges récupérables (136,11 €).
    const proposition = propositionCharges(LOCATION_JULIE, ETAT_SEPTEMBRE, VIDE, [COPRO], 2025);
    expect(proposition).toMatchObject({ statut: 'proposee', provisions: 15_000, solde: -1_389 });
    expect(propositionCharges(LOCATION_JULIE, ETAT_SEPTEMBRE, forfait, [COPRO], 2025)).toEqual({
      statut: 'forfait',
    });
  });

  it('une année déjà régularisée n’est plus proposée', () => {
    const regularisation: Regularisation = {
      id: 'r1',
      locationId: LOCATION_JULIE.id,
      annee: 2025,
      solde: -1_389,
      aPartirDe: '2026-09',
      decompteId: 'd1',
      regleeLe: null,
      creeLe: H,
    };
    const etat = { ...VIDE, regularisations: [regularisation] };
    expect(regularisationsDe(etat, LOCATION_JULIE.id)).toEqual([regularisation]);
    expect(anneesProposees(LOCATION_JULIE, etat, AUJOURDHUI)).toEqual([]);
  });
});

describe('colocataires présents', () => {
  it('les présents d’un mois suivent les mouvements ; sans données, tout le bail', () => {
    const bail = { ...LOCATION_JULIE, colocataireIds: [ANTOINE.id] };
    const etat: EtatFinBail = {
      ...VIDE,
      mouvements: [
        {
          id: 'm1',
          locationId: bail.id,
          locataireId: JULIE.id,
          sens: 'depart',
          date: '2026-09-10',
          creeLe: H,
        },
      ],
    };
    expect(presentsDuMois(bail, ETAT_SEPTEMBRE, etat, '2026-09')).toEqual([JULIE, ANTOINE]);
    expect(presentsDuMois(bail, ETAT_SEPTEMBRE, etat, '2026-10')).toEqual([ANTOINE]);
    expect(presentsDuMois(bail, ETAT_SEPTEMBRE, null, '2026-10')).toEqual([JULIE, ANTOINE]);
  });
});

describe('À faire et locations à solder', () => {
  const donnees = { ...ETAT_SEPTEMBRE, locations: [TERMINEE] };

  it('dépôts à rendre, puis charges à valider, puis charges à régler', () => {
    const reglee: Regularisation = {
      id: 'r2',
      locationId: TERMINEE.id,
      annee: 2025,
      solde: 4_000,
      aPartirDe: '2026-09',
      decompteId: 'd2',
      regleeLe: null,
      creeLe: H,
    };
    const actions = actionsFinBail(donnees, { ...VIDE, regularisations: [reglee] }, [], AUJOURDHUI);
    expect(actions.map((a) => a.type)).toEqual(['depot', 'charges_a_regler']);
    expect(actions.map(cleActionFinBail)).toEqual(['depot-location-julie', 'regler-r2']);

    const avecCharges = actionsFinBail(donnees, VIDE, [COPRO], AUJOURDHUI);
    expect(avecCharges.map((a) => a.type)).toEqual(['depot', 'regularisation']);
    expect(avecCharges.map(cleActionFinBail)).toEqual([
      'depot-location-julie',
      'charges-location-julie-2025',
    ]);
    const [, charges] = avecCharges;
    expect(charges).toMatchObject({ annee: 2025, solde: -1_389, locataire: JULIE });
  });

  it('rien à faire quand tout est réglé ; locations à solder sur la fiche du bien', () => {
    expect(actionsFinBail(ETAT_SEPTEMBRE, VIDE, [], AUJOURDHUI)).toEqual([]);
    expect(locationsASolder(donnees, VIDE, BIEN_LICES.id, AUJOURDHUI)).toEqual([TERMINEE]);
    expect(locationsASolder(ETAT_SEPTEMBRE, VIDE, BIEN_LICES.id, AUJOURDHUI)).toEqual([]);

    // Dépôt rendu et aucune année à régulariser : plus rien à solder.
    const soldee: EtatFinBail = {
      ...VIDE,
      restitutions: [
        {
          locationId: TERMINEE.id,
          clesLe: '2026-08-20',
          conforme: true,
          retenues: [],
          depot: 130_000,
          aRendre: 130_000,
          dateLimite: '2026-09-20',
          decompteId: 'd1',
          rendueLe: '2026-09-01',
          modifieLe: H,
        },
      ],
      regularisations: [
        {
          id: 'r3',
          locationId: TERMINEE.id,
          annee: 2025,
          solde: -1_389,
          aPartirDe: '2026-09',
          decompteId: 'd3',
          regleeLe: '2026-09-02',
          creeLe: H,
        },
      ],
    };
    expect(locationsASolder(donnees, soldee, BIEN_LICES.id, AUJOURDHUI)).toEqual([]);
    expect(actionsFinBail(donnees, soldee, [], AUJOURDHUI)).toEqual([]);
  });
});
