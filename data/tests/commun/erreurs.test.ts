import { describe, expect, it } from 'vitest';
import { messageDe } from '../../src/commun/erreurs.ts';

describe('messageDe', () => {
  it('rend le message d’une Error et la forme texte de toute autre valeur', () => {
    expect(messageDe(new RangeError('hors bornes'))).toBe('hors bornes');
    expect(messageDe('panne')).toBe('panne');
    expect(messageDe(42)).toBe('42');
  });
});
