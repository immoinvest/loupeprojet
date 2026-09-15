import { describe, expect, it } from 'vitest';

import { versBase64Url } from '@/stockage/base64url';
import { compresserJson, decompresserJson } from '@/stockage/compression';

/** Des octets bruts compressés, pour fabriquer un contenu qui n'est pas du JSON UTF-8. */
async function deflate(octets: Uint8Array): Promise<string> {
  const flux = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(octets);
      c.close();
    },
  }).pipeThrough(
    new CompressionStream('deflate-raw') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>,
  );
  const tampon = await new Response(flux).arrayBuffer();
  return versBase64Url(new Uint8Array(tampon));
}

describe('compresserJson / decompresserJson', () => {
  it('retrouve la valeur, accents compris, et compresse un texte répétitif', async () => {
    const valeur = {
      nom: 'Étude · n°1',
      lignes: Array.from({ length: 200 }, () => 'loyer charges'),
    };
    const texte = await compresserJson(valeur);
    expect(texte).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(texte.length).toBeLessThan(JSON.stringify(valeur).length / 10);
    expect(await decompresserJson(texte)).toEqual({ ok: true, valeur });
  });

  it('refuse sans exception : base64 abîmé, deflate invalide, JSON ou UTF-8 invalide, texte tronqué', async () => {
    expect(await decompresserJson('%%%')).toEqual({ ok: false });
    expect(await decompresserJson(versBase64Url(new Uint8Array([255, 255, 255, 255])))).toEqual({
      ok: false,
    });
    expect(await decompresserJson(await deflate(new TextEncoder().encode('pas du json')))).toEqual({
      ok: false,
    });
    expect(await decompresserJson(await deflate(new Uint8Array([0xff, 0xfe])))).toEqual({
      ok: false,
    });
    const complet = await compresserJson({ nom: 'Projet', valeurs: [1, 2, 3, 4, 5, 6, 7, 8] });
    expect((await decompresserJson(complet.slice(0, 6))).ok).toBe(false);
  });

  it('s’arrête au-delà du plafond : un petit fragment ne peut pas remplir la mémoire', async () => {
    const texte = await compresserJson('a'.repeat(50_000));
    expect(texte.length).toBeLessThan(1_000);
    expect(await decompresserJson(texte, 10_000)).toEqual({ ok: false });
    expect((await decompresserJson(texte)).ok).toBe(true);
  });
});
