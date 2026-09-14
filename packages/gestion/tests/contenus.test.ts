import { describe, expect, it } from 'vitest';

import {
  contenuQuittance,
  contenuRecu,
  type EntreesDocument,
  type ResultatContenu,
} from '../src/contenus';
import { ContenuDocumentSchema, type ContenuDocument } from '../src/documents';
import type { Paiement } from '../src/schemas';
import { bien, locataire, location, paiement } from './exemples';

const BAILLEUR = { nom: 'Pierre Georgel', adresse: '3 rue Paradis, 13006 Marseille' };

function entrees(
  paiements: readonly Paiement[],
  options: Partial<EntreesDocument> = {},
): EntreesDocument {
  return {
    bailleur: BAILLEUR,
    bien: bien('bien-lices', 'T2 Lices'),
    locataire: locataire('locataire-julie', 'Julie', 'Martin'),
    location: location('l1', { debut: '2026-10-01' }),
    paiements,
    emisLe: '2026-11-02',
    ...options,
  };
}

/** Le contenu d'un résultat accepté, validé par son schéma (un document émis doit toujours le passer). */
function contenu(resultat: ResultatContenu): ContenuDocument {
  if (!resultat.ok) throw new Error(`refus inattendu : ${resultat.refus}`);
  return ContenuDocumentSchema.parse(resultat.contenu);
}

describe('contenuQuittance', () => {
  it('terme entièrement payé en une fois : loyer et charges distingués, « pour acquit »', () => {
    const q = contenu(
      contenuQuittance(entrees([paiement('p1', 'l1', '2026-10', 70_000)]), '2026-10'),
    );
    expect(q).toEqual({
      type: 'quittance',
      numero: 'Q-202610-L1',
      emisLe: '2026-11-02',
      bailleur: BAILLEUR,
      locataire: { prenom: 'Julie', nom: 'Martin' },
      logement: { nom: 'T2 Lices', adresse: 'T2 Lices, Marseille' },
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
    });
  });

  it('payé en deux fois : paiements dans l’ordre des dates, reçus précédents annulés', () => {
    const q = contenu(
      contenuQuittance(
        entrees([
          paiement('p2', 'l1', '2026-10', 40_000, '2026-10-20'),
          paiement('p1', 'l1', '2026-10', 30_000, '2026-10-06'),
          paiement('autre', 'l2', '2026-10', 70_000),
        ]),
        '2026-10',
      ),
    );
    expect(q.paiements).toEqual([
      { montant: 30_000, date: '2026-10-06' },
      { montant: 40_000, date: '2026-10-20' },
    ]);
    expect(q.montantRecu).toBe(70_000);
    expect(q.mentions).toEqual(['pour_acquit', 'annule_recus']);
  });

  it('entrée le 12 : période et montants au prorata', () => {
    const e = entrees([paiement('p1', 'l1', '2026-10', 45_161, '2026-10-12')], {
      location: location('l1', { debut: '2026-10-12' }),
    });
    expect(contenu(contenuQuittance(e, '2026-10'))).toMatchObject({
      debut: '2026-10-12',
      fin: '2026-10-31',
      loyerHorsCharges: 41_935,
      charges: 3_226,
      total: 45_161,
    });
  });

  it('refus : identité du bailleur absente, terme hors location, loyer pas entièrement reçu', () => {
    const paye = [paiement('p1', 'l1', '2026-10', 70_000)];
    expect(contenuQuittance(entrees(paye, { bailleur: null }), '2026-10')).toEqual({
      ok: false,
      refus: 'BAILLEUR_MANQUANT',
    });
    expect(contenuQuittance(entrees(paye), '2026-09')).toEqual({
      ok: false,
      refus: 'HORS_LOCATION',
    });
    expect(contenuQuittance(entrees([paiement('p1', 'l1', '2026-10', 69_999)]), '2026-10')).toEqual(
      { ok: false, refus: 'LOYER_NON_REGLE' },
    );
    expect(contenuQuittance(entrees([]), '2026-10')).toEqual({
      ok: false,
      refus: 'LOYER_NON_REGLE',
    });
  });
});

describe('contenuRecu', () => {
  const partiels = [
    paiement('p1', 'l1', '2026-10', 30_000, '2026-10-06'),
    paiement('p2', 'l1', '2026-10', 10_000, '2026-10-12'),
  ];

  it('premier paiement partiel : montant reçu, reste dû, ni « pour acquit » ni reçus annulés', () => {
    expect(contenu(contenuRecu(entrees(partiels), 'p1'))).toMatchObject({
      type: 'recu',
      numero: 'R-202610-L1-P1',
      total: 70_000,
      paiements: [{ montant: 30_000, date: '2026-10-06' }],
      montantRecu: 30_000,
      dejaRecu: 0,
      resteDu: 40_000,
      mentions: [],
    });
  });

  it('second paiement partiel : ce qui était déjà reçu est indiqué', () => {
    expect(contenu(contenuRecu(entrees(partiels), 'p2'))).toMatchObject({
      montantRecu: 10_000,
      dejaRecu: 30_000,
      resteDu: 30_000,
    });
  });

  it('le reçu d’un paiement partiel reste possible une fois le terme soldé ; celui qui solde est refusé', () => {
    const solde = [...partiels, paiement('p3', 'l1', '2026-10', 30_000, '2026-10-25')];
    expect(contenuRecu(entrees(solde), 'p1').ok).toBe(true);
    expect(contenuRecu(entrees(solde), 'p3')).toEqual({ ok: false, refus: 'LOYER_REGLE' });
  });

  it('à date égale, la création puis l’identifiant départagent les paiements', () => {
    const memeJour: Paiement[] = [
      { ...paiement('b', 'l1', '2026-10', 10_000, '2026-10-06'), creeLe: '2026-10-06T10:00:00Z' },
      { ...paiement('a', 'l1', '2026-10', 20_000, '2026-10-06'), creeLe: '2026-10-06T10:00:00Z' },
      { ...paiement('c', 'l1', '2026-10', 5_000, '2026-10-06'), creeLe: '2026-10-06T09:00:00Z' },
    ];
    expect(contenu(contenuRecu(entrees(memeJour), 'c')).dejaRecu).toBe(0);
    expect(contenu(contenuRecu(entrees(memeJour), 'a')).dejaRecu).toBe(5_000);
    expect(contenu(contenuRecu(entrees(memeJour), 'b')).dejaRecu).toBe(25_000);
  });

  it('refus : bailleur absent, paiement inconnu ou d’une autre location, terme hors location', () => {
    expect(contenuRecu(entrees(partiels, { bailleur: null }), 'p1')).toEqual({
      ok: false,
      refus: 'BAILLEUR_MANQUANT',
    });
    expect(contenuRecu(entrees(partiels), 'inconnu')).toEqual({ ok: false, refus: 'INTROUVABLE' });
    expect(contenuRecu(entrees([paiement('x', 'l2', '2026-10', 10_000)]), 'x')).toEqual({
      ok: false,
      refus: 'INTROUVABLE',
    });
    expect(contenuRecu(entrees([paiement('avant', 'l1', '2026-09', 10_000)]), 'avant')).toEqual({
      ok: false,
      refus: 'HORS_LOCATION',
    });
  });
});
