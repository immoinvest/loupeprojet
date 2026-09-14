import {
  PREFERENCES_PAR_DEFAUT,
  type BienGere,
  type CreationLocation,
  type EtatGestion,
  type Locataire,
  type LocationGeree,
  type Paiement,
} from '@loupe/gestion';

/** Données de test de Gérer : les biens de la maquette, septembre 2026. */

export const HORODATAGE = '2026-09-01T08:00:00.000Z';

export const BIEN_LICES: BienGere = {
  id: 'bien-lices',
  nom: 'T2 Lices',
  adresse: '12 rue des Lices, Marseille 5e',
  type: 'appartement',
  surface: 38,
  meuble: true,
  creeLe: HORODATAGE,
  modifieLe: HORODATAGE,
};

export const BIEN_BAILLE: BienGere = {
  ...BIEN_LICES,
  id: 'bien-baille',
  nom: 'Studio Baille',
  adresse: '8 boulevard Baille, Marseille 6e',
  type: 'studio',
};

export const JULIE: Locataire = {
  id: 'locataire-julie',
  prenom: 'Julie',
  nom: 'Martin',
  email: 'julie.martin@exemple.fr',
  creeLe: HORODATAGE,
};

export const ANTOINE: Locataire = {
  id: 'locataire-antoine',
  prenom: 'Antoine',
  nom: 'Dupont',
  creeLe: HORODATAGE,
};

export const LOCATION_JULIE: LocationGeree = {
  id: 'location-julie',
  bienId: 'bien-lices',
  locataireId: 'locataire-julie',
  type: 'meublee',
  debut: '2025-10-01',
  jourLoyer: 5,
  loyerHorsCharges: 65_000,
  charges: 5_000,
  depot: 130_000,
  creeLe: HORODATAGE,
};

export const LOCATION_ANTOINE: LocationGeree = {
  ...LOCATION_JULIE,
  id: 'location-antoine',
  bienId: 'bien-baille',
  locataireId: 'locataire-antoine',
  type: 'nue',
  jourLoyer: 3,
  loyerHorsCharges: 40_000,
  charges: 3_000,
  depot: 40_000,
};

export const PAIEMENT_JULIE: Paiement = {
  id: 'paiement-julie',
  locationId: 'location-julie',
  periode: '2026-09',
  montant: 70_000,
  date: '2026-09-05',
  source: 'manuel',
  creeLe: HORODATAGE,
};

/** Au 14 septembre 2026 : Julie a payé, Antoine est en retard (dû le 3). */
export const ETAT_SEPTEMBRE: EtatGestion = {
  biens: [BIEN_LICES, BIEN_BAILLE],
  locataires: [JULIE, ANTOINE],
  locations: [LOCATION_JULIE, LOCATION_ANTOINE],
  paiements: [PAIEMENT_JULIE],
  bailleur: null,
  documents: [],
  preferences: PREFERENCES_PAR_DEFAUT,
};

export const CREATION_LOUEE: CreationLocation = {
  bien: {
    nom: 'Coloc Rouet',
    adresse: '3 rue du Rouet, Marseille 6e',
    type: 'appartement',
    meuble: true,
  },
  locataire: { prenom: 'Léa', nom: 'Bernard', email: 'lea.bernard@exemple.fr' },
  location: {
    type: 'meublee',
    debut: '2026-09-01',
    jourLoyer: 1,
    loyerHorsCharges: 49_000,
    charges: 4_000,
    depot: 98_000,
  },
};

export const CREATION_VACANTE: CreationLocation = {
  bien: { nom: 'Parking Prado', adresse: '8 avenue du Prado', type: 'parking', meuble: false },
  locataire: null,
  location: null,
};

/** Un stockage dont chaque accès échoue (navigation privée stricte, quota dépassé). */
export const STOCKAGE_EN_PANNE: Storage = {
  length: 0,
  clear: () => undefined,
  key: () => null,
  removeItem: () => undefined,
  getItem: () => {
    throw new Error('stockage refusé');
  },
  setItem: () => {
    throw new Error('quota dépassé');
  },
};
