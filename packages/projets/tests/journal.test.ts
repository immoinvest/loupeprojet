import { describe, expect, it } from 'vitest';

import {
  JOURNAL_VIDE,
  JournalSynchroSchema,
  noterEnregistrement,
  noterSuppression,
  sansCle,
} from '../src/journal';
import { DIX_HEURES, DIX_HEURES_UNE, journal } from './exemples';

describe('journal de synchronisation', () => {
  it('sans compte, rien n’est noté', () => {
    expect(noterEnregistrement(JOURNAL_VIDE, 'p1')).toBe(JOURNAL_VIDE);
    expect(noterSuppression(JOURNAL_VIDE, 'p1', DIX_HEURES)).toBe(JOURNAL_VIDE);
  });

  it('un enregistrement est noté une fois et annule une suppression en attente', () => {
    const avant = journal('u1', { aSupprimer: { p1: DIX_HEURES, p2: DIX_HEURES } });
    const apres = noterEnregistrement(noterEnregistrement(avant, 'p1'), 'p1');
    expect(apres.aEnvoyer).toEqual(['p1']);
    expect(apres.aSupprimer).toEqual({ p2: DIX_HEURES });
    expect(JournalSynchroSchema.parse(apres)).toEqual(apres);
  });

  it('une suppression retire l’envoi en attente et garde la dernière date', () => {
    const avant = journal('u1', { aEnvoyer: ['p1', 'p2'] });
    const apres = noterSuppression(noterSuppression(avant, 'p1', DIX_HEURES), 'p1', DIX_HEURES_UNE);
    expect(apres.aEnvoyer).toEqual(['p2']);
    expect(apres.aSupprimer).toEqual({ p1: DIX_HEURES_UNE });
  });

  it('sansCle ne modifie pas l’original', () => {
    const original = { a: '1', b: '2' };
    expect(sansCle(original, 'a')).toEqual({ b: '2' });
    expect(original).toEqual({ a: '1', b: '2' });
  });
});
