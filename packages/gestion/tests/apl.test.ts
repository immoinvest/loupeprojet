import { describe, expect, it } from 'vitest';

import {
  contenuQuittance,
  contenuRecu,
  type EntreesDocument,
  type ResultatContenu,
} from '../src/contenus';
import { ContenuDocumentSchema, type ContenuDocument } from '../src/documents';
import { loyerDuMois } from '../src/loyers';
import { APL_QUITTANCE } from '../src/regles';
import { NouvelleLocationSchema } from '../src/schemas';
import { bien, locataire, location, paiement } from './exemples';

/*
 * APL versée au bailleur (tiers payant) : il la déduit du loyer demandé au locataire (CAF, « Rappel
 * sur le tiers payant ») ; le loyer du mois garde son total, la quittance distingue les deux parts.
 */

const BAILLEUR = { nom: 'Pierre Georgel', adresse: '3 rue Paradis, 13006 Marseille' };

function entrees(options: Partial<EntreesDocument> = {}): EntreesDocument {
  return {
    bailleur: BAILLEUR,
    bien: bien('bien-lices', 'T2 Lices'),
    locataires: [locataire('locataire-julie', 'Julie', 'Martin')],
    location: location('l1', { debut: '2026-10-01', apl: 18_000 }),
    paiements: [paiement('p1', 'l1', '2026-10', 70_000)],
    emisLe: '2026-11-02',
    ...options,
  };
}

function contenu(resultat: ResultatContenu): ContenuDocument {
  if (!resultat.ok) throw new Error(`refus inattendu : ${resultat.refus}`);
  return ContenuDocumentSchema.parse(resultat.contenu);
}

describe('APL versée au bailleur', () => {
  it('le loyer du mois garde son total ; le locataire paie le total moins l’aide', () => {
    expect(
      loyerDuMois(location('l1', { debut: '2026-10-01', apl: 18_000 }), '2026-10'),
    ).toMatchObject({ total: 70_000, apl: 18_000, partLocataire: 52_000 });
  });

  it('prorata : l’aide suit les jours occupés et, arrondie, ne dépasse jamais le total', () => {
    // Entrée le 12 octobre, 20 jours sur 31 : 18 000 × 20 ÷ 31 = 11 612,90 → 11 613.
    const entree = loyerDuMois(location('l1', { debut: '2026-10-12', apl: 18_000 }), '2026-10');
    expect(entree).toMatchObject({ total: 45_161, apl: 11_613, partLocataire: 33_548 });
    // 7 jours sur 28 : 1 + 1 centime de loyer s'arrondissent à 0, 2 centimes d'aide à 1 → ramenés à 0.
    const minuscule = location('l2', {
      debut: '2027-02-22',
      loyerHorsCharges: 1,
      charges: 1,
      apl: 2,
    });
    expect(loyerDuMois(minuscule, '2027-02')).toMatchObject({
      total: 0,
      apl: 0,
      partLocataire: 0,
    });
  });

  it('la quittance et le reçu portent l’aide ; sans aide, le contenu reste celui de G1b', () => {
    expect(contenu(contenuQuittance(entrees(), '2026-10'))).toMatchObject({
      total: 70_000,
      apl: 18_000,
      montantRecu: 70_000,
    });
    const recu = contenu(
      contenuRecu(entrees({ paiements: [paiement('p1', 'l1', '2026-10', 52_000)] }), 'p1'),
    );
    expect(recu).toMatchObject({ type: 'recu', apl: 18_000, resteDu: 18_000 });
    const sansAide = contenu(
      contenuQuittance(entrees({ location: location('l1', { debut: '2026-10-01' }) }), '2026-10'),
    );
    expect(sansAide).not.toHaveProperty('apl');
  });

  it('saisie : aide facultative, jamais au-dessus du loyer charges comprises ; mention à confirmer', () => {
    const saisie = {
      type: 'meublee',
      debut: '2026-10-01',
      jourLoyer: 5,
      loyerHorsCharges: 65_000,
      charges: 5_000,
      depot: 130_000,
    } as const;
    expect(NouvelleLocationSchema.safeParse(saisie).success).toBe(true);
    expect(NouvelleLocationSchema.safeParse({ ...saisie, apl: 70_000 }).success).toBe(true);
    const trop = NouvelleLocationSchema.safeParse({ ...saisie, apl: 70_001 });
    expect(trop.error?.issues[0]?.path).toEqual(['apl']);
    expect(APL_QUITTANCE.aConfirmer).toBe(true);
  });
});
