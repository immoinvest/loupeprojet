import { describe, expect, it } from 'vitest';
import { contexteReel } from '../../src/commun/contexte.ts';

describe('contexteReel', () => {
  it("branche le vrai fetch, une pause réelle, l'horloge système et le journal standard", async () => {
    const contexte = contexteReel('data/dist');
    expect(contexte.recuperer).toBe(fetch);
    expect(contexte.dossierSortie).toBe('data/dist');
    expect(contexte.horloge()).toBeInstanceOf(Date);
    expect(typeof contexte.journal.info).toBe('function');
    const debut = Date.now();
    await contexte.pause(5);
    expect(Date.now() - debut).toBeGreaterThanOrEqual(4);
  });
});
