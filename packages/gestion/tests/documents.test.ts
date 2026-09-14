import { describe, expect, it } from 'vitest';

import {
  cleDocument,
  DemandeDocumentSchema,
  DocumentSchema,
  IdentiteBailleurSchema,
  numeroDocument,
} from '../src/documents';

describe('cleDocument', () => {
  it('une quittance par terme, un reçu par paiement', () => {
    expect(cleDocument({ type: 'quittance', locationId: 'l1', periode: '2026-10' })).toBe(
      'quittance:l1:2026-10',
    );
    expect(cleDocument({ type: 'recu', paiementId: 'p1' })).toBe('recu:p1');
  });
});

describe('numeroDocument', () => {
  it('quittance : Q, le mois et les 8 premiers caractères de la location, en majuscules', () => {
    expect(numeroDocument('quittance', '2026-10', '3f9a2c1b-77aa-4e5d-9b1c-0a1b2c3d4e5f')).toBe(
      'Q-202610-3F9A2C1B',
    );
  });

  it('reçu : R, puis les 6 premiers caractères du paiement ; les tirets sont ignorés', () => {
    expect(numeroDocument('recu', '2026-10', 'loc-1', '7d-04e1ff-12')).toBe('R-202610-LOC1-7D04E1');
    expect(numeroDocument('recu', '2026-10', 'loc-1')).toBe('R-202610-LOC1-');
  });

  it('deux termes ou deux locations donnent deux numéros ; le même terme, le même numéro', () => {
    const octobre = numeroDocument('quittance', '2026-10', 'location-a');
    expect(numeroDocument('quittance', '2026-11', 'location-a')).not.toBe(octobre);
    expect(numeroDocument('quittance', '2026-10', 'bail-b')).not.toBe(octobre);
    expect(numeroDocument('quittance', '2026-10', 'location-a')).toBe(octobre);
  });
});

describe('schémas des documents', () => {
  it('identité du bailleur : espaces retirés, ni vide ni trop longue', () => {
    expect(IdentiteBailleurSchema.parse({ nom: '  Pierre Georgel ', adresse: '3 rue X' })).toEqual({
      nom: 'Pierre Georgel',
      adresse: '3 rue X',
    });
    expect(IdentiteBailleurSchema.safeParse({ nom: ' ', adresse: '3 rue X' }).success).toBe(false);
    expect(
      IdentiteBailleurSchema.safeParse({ nom: 'x'.repeat(121), adresse: '3 rue X' }).success,
    ).toBe(false);
  });

  it('demande : une quittance ou un reçu, rien d’autre', () => {
    expect(
      DemandeDocumentSchema.safeParse({ type: 'quittance', locationId: 'l1', periode: '2026-10' })
        .success,
    ).toBe(true);
    expect(DemandeDocumentSchema.safeParse({ type: 'recu', paiementId: 'p1' }).success).toBe(true);
    expect(DemandeDocumentSchema.safeParse({ type: 'avis', locationId: 'l1' }).success).toBe(false);
    expect(
      DemandeDocumentSchema.safeParse({ type: 'quittance', locationId: 'l1', periode: '2026-13' })
        .success,
    ).toBe(false);
  });

  it('document listé : le paiement est facultatif', () => {
    const base = {
      id: 'd1',
      type: 'quittance',
      numero: 'Q-202610-L1',
      locationId: 'l1',
      periode: '2026-10',
      emisLe: '2026-11-02T08:00:00.000Z',
    };
    expect(DocumentSchema.parse(base)).toEqual(base);
    expect(DocumentSchema.parse({ ...base, type: 'recu', paiementId: 'p1' }).paiementId).toBe('p1');
  });
});
