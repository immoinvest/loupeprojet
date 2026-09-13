import { describe, expect, it } from 'vitest';
import { collecter, decoderTexte, depuisMorceaux } from '../../src/commun/flux.ts';

describe('decoderTexte', () => {
  it('reconstitue un caractère UTF-8 coupé entre deux morceaux', async () => {
    const octets = Buffer.from('été', 'utf8');
    const morceaux = [octets.subarray(0, 1), octets.subarray(1, 3), octets.subarray(3)];
    const texte = await collecter(decoderTexte(depuisMorceaux(morceaux), 'utf-8'));
    expect(texte.join('')).toBe('été');
    // Le premier morceau (un octet sur deux) ne produit rien ; il complète le « é » du deuxième.
    expect(texte).toEqual(['ét', 'é']);
  });

  it('décode le Windows-1252 des fichiers ANIL', async () => {
    const octets = Buffer.from([0x4c, 0x61, 0x20, 0x42, 0xe2, 0x74, 0x69, 0x65]);
    const texte = await collecter(decoderTexte(depuisMorceaux([octets]), 'windows-1252'));
    expect(texte.join('')).toBe('La Bâtie');
  });

  it('ignore les morceaux vides et vide le décodeur à la fin', async () => {
    const morceaux = [new Uint8Array(0), Buffer.from([0x61, 0xc3])];
    const texte = await collecter(decoderTexte(depuisMorceaux(morceaux), 'utf-8'));
    expect(texte).toEqual(['a', '�']);
  });
});

describe('depuisMorceaux et collecter', () => {
  it('transforment une liste en flux asynchrone et inversement', async () => {
    expect(await collecter(depuisMorceaux([1, 2, 3]))).toEqual([1, 2, 3]);
    expect(await collecter(depuisMorceaux([]))).toEqual([]);
  });
});
