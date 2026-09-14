import type { ContenuDocument } from '@loupe/gestion';
import { describe, expect, it } from 'vitest';

import {
  declaration,
  faitLe,
  locatairesTitre,
  logementEnLettres,
  MENTIONS_DOCUMENT_TEXTES,
  numeroEnLettres,
  paiementEnLettres,
  periodeEnLettres,
  TITRES_DOCUMENT,
} from '@/textes/gerer-documents';

import { BAILLEUR } from './gestion-exemples';

/** Espaces insécables des montants ramenés à des espaces. */
const lisible = (texte: string): string => texte.replace(/\s/g, ' ');

const QUITTANCE: ContenuDocument = {
  type: 'quittance',
  numero: 'Q-202610-L1',
  emisLe: '2026-11-02',
  bailleur: BAILLEUR,
  locataires: [
    { prenom: 'Julie', nom: 'Martin' },
    { prenom: 'Léa', nom: 'Bernard' },
  ],
  logement: { nom: 'Coloc Rouet', adresse: '3 rue du Rouet, Marseille 6e', libelle: 'Chambre 2' },
  periode: '2026-10',
  debut: '2026-10-01',
  fin: '2026-10-31',
  loyerHorsCharges: 65_000,
  charges: 5_000,
  total: 70_000,
  paiements: [{ montant: 70_000, date: '2026-10-05' }],
  montantRecu: 70_000,
  dejaRecu: 0,
  resteDu: 0,
  mentions: ['pour_acquit'],
};

describe('textes des quittances et reçus', () => {
  it('titres, numéro, locataires au singulier ou au pluriel, mentions', () => {
    expect(TITRES_DOCUMENT).toEqual({ quittance: 'Quittance de loyer', recu: 'Reçu de paiement' });
    expect(numeroEnLettres('Q-202610-L1')).toBe('N° Q-202610-L1');
    expect(locatairesTitre(1)).toBe('Locataire');
    expect(locatairesTitre(2)).toBe('Locataires');
    expect(MENTIONS_DOCUMENT_TEXTES.pour_acquit).toBe('Pour acquit.');
    expect(MENTIONS_DOCUMENT_TEXTES.annule_recus).toMatch(/annule les reçus/);
  });

  it('période, logement avec ou sans chambre, paiement, date d’émission', () => {
    expect(periodeEnLettres('2026-10-12', '2026-10-31')).toBe(
      'du 12 octobre 2026 au 31 octobre 2026',
    );
    expect(logementEnLettres(QUITTANCE.logement)).toBe(
      'Coloc Rouet · Chambre 2, 3 rue du Rouet, Marseille 6e',
    );
    expect(logementEnLettres({ nom: 'T2 Lices', adresse: '12 rue des Lices' })).toBe(
      'T2 Lices, 12 rue des Lices',
    );
    expect(lisible(paiementEnLettres({ montant: 30_000, date: '2026-10-06' }))).toBe(
      '300 € le 6 octobre 2026',
    );
    expect(faitLe('2026-11-01')).toBe('Fait le 1er novembre 2026.');
  });

  it('déclaration : la quittance donne quittance, le reçu ne vaut pas quittance', () => {
    expect(lisible(declaration(QUITTANCE))).toBe(
      'Pierre Georgel, bailleur du logement désigné ci-dessus, déclare avoir reçu de Julie Martin et Léa Bernard la somme de 700 € au titre du loyer et des charges de la période du 1er octobre 2026 au 31 octobre 2026, et en donne quittance, sous réserve de tous ses droits.',
    );
    const recu: ContenuDocument = {
      ...QUITTANCE,
      type: 'recu',
      locataires: [{ prenom: 'Julie', nom: 'Martin' }],
      montantRecu: 30_000,
      resteDu: 40_000,
      mentions: [],
    };
    expect(lisible(declaration(recu))).toBe(
      'Pierre Georgel, bailleur du logement désigné ci-dessus, déclare avoir reçu de Julie Martin la somme de 300 €, en paiement partiel du loyer et des charges de la période du 1er octobre 2026 au 31 octobre 2026. Ce reçu ne vaut pas quittance.',
    );
  });
});
