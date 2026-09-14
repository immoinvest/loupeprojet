import { describe, expect, it } from 'vitest';

import { decoderJson, depuisBase64Url, encoderJson, versBase64Url } from '@/stockage/base64url';

describe('base64url', () => {
  it('encode des octets sans « + », « / » ni « = », et les relit', () => {
    const octets = Uint8Array.from([0xfb, 0xff, 0xbf, 0x00, 0x01, 0x02]);
    const texte = versBase64Url(octets);
    expect(texte).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(texte).toBe('-_-_AAEC');
    expect([...depuisBase64Url(texte)]).toEqual([...octets]);
    // Toutes les longueurs de complément (0, 1, 2 caractères « = » retirés).
    for (const n of [1, 2, 3, 4, 5]) {
      const brut = Uint8Array.from({ length: n }, (_, i) => i * 37);
      expect([...depuisBase64Url(versBase64Url(brut))]).toEqual([...brut]);
    }
  });

  it('encode une valeur JSON en UTF-8 et la relit, accents et émojis compris', () => {
    const valeur = { nom: 'Crédit Agricole d’Île-de-France 🏦', taux: 0.033, liste: [1, null] };
    const texte = encoderJson(valeur);
    expect(texte).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decoderJson(texte)).toEqual(valeur);
  });

  it('lève sur un texte qui n’est ni du base64url, ni de l’UTF-8, ni du JSON', () => {
    expect(() => depuisBase64Url('%%%')).toThrow();
    // « _w » = l'octet 0xFF seul : pas de l'UTF-8.
    expect(() => decoderJson('_w')).toThrow();
    // « YWJj » = « abc » : pas du JSON.
    expect(() => decoderJson('YWJj')).toThrow();
  });
});
