import {
  contenuLettreRevision,
  propositionRevision,
  type LettreRevisionComplete,
  type PropositionProposee,
  type RevisionLocation,
} from '@loupe/gestion';

import { BAILLEUR, LOCATION_JULIE } from './gestion-exemples';

/** Données de test de la vie du bail : la révision de Julie au 1er octobre 2026 (cas de la spec G4-1). */

export const REVISION_JULIE: RevisionLocation = {
  locationId: 'location-julie',
  active: true,
  anniversaire: '2025-10-01',
  trimestre: '2025-T2',
  formeBail: 'classique',
  derniereRevision: null,
  modifieLe: '2026-09-01T08:00:00.000Z',
};

export function propositionJulie(): PropositionProposee {
  const p = propositionRevision({
    location: LOCATION_JULIE,
    paiements: [],
    revision: REVISION_JULIE,
    classeDpe: 'D',
    aujourdhui: '2026-09-14',
  });
  if (p.statut !== 'proposee') throw new Error('proposition attendue');
  return p;
}

export function lettreJulie(): LettreRevisionComplete {
  const contenu = contenuLettreRevision({
    locationId: 'location-julie',
    bailleur: BAILLEUR,
    locataires: [{ prenom: 'Julie', nom: 'Martin' }],
    logement: { nom: 'T2 Lices', adresse: '12 rue des Lices, Marseille 5e' },
    proposition: propositionJulie(),
    emisLe: '2026-09-14',
  });
  return {
    id: 'lettre-julie',
    locationId: 'location-julie',
    numero: contenu.numero,
    anniversaire: '2026-10-01',
    emisLe: '2026-09-14T09:00:00.000Z',
    contenu,
  };
}
