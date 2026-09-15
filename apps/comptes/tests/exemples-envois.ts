import type { ContenuDocument } from '@loupe/gestion';

/** Une quittance de colocation avec aide au logement et deux paiements : couvre toutes les lignes du PDF. */
export const QUITTANCE: ContenuDocument = {
  type: 'quittance',
  numero: 'Q-202610-L1',
  emisLe: '2026-11-02',
  bailleur: { nom: 'Pierre Georgel', adresse: '3 rue Paradis, 13006 Marseille' },
  locataires: [
    { prenom: 'Julie', nom: 'Martin' },
    { prenom: 'Léa', nom: 'Bernard' },
  ],
  logement: { nom: 'T2 Lices', adresse: '12 rue des Lices', libelle: 'Chambre 2' },
  periode: '2026-10',
  debut: '2026-10-01',
  fin: '2026-10-31',
  loyerHorsCharges: 65_000,
  charges: 5_000,
  total: 70_000,
  apl: 20_000,
  paiements: [
    { montant: 30_000, date: '2026-10-06' },
    { montant: 40_050, date: '2026-10-20' },
  ],
  montantRecu: 70_000,
  dejaRecu: 0,
  resteDu: 0,
  mentions: ['pour_acquit', 'annule_recus'],
};
