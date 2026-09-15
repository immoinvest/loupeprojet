import { depuisBase64Url, versBase64Url, type LectureJson } from './base64url';

/**
 * JSON compressé (deflate brut, `CompressionStream` natif) puis base64url, pour les fragments d'URL
 * longs : lien de partage de repli (`#z=`) et transfert des projets (`#d=`). La lecture s'arrête
 * au-delà de `TAILLE_MAX_DECOMPRESSEE` : un fragment piégé ne peut pas remplir la mémoire.
 */

export const TAILLE_MAX_DECOMPRESSEE = 2_000_000;

const FORMAT = 'deflate-raw';

async function lireTout(flux: ReadableStream<Uint8Array>, plafond: number): Promise<Uint8Array> {
  const lecteur = flux.getReader();
  const morceaux: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    total += value.length;
    if (total > plafond) {
      await lecteur.cancel();
      throw new RangeError('trop gros une fois décompressé');
    }
    morceaux.push(value);
  }
  const octets = new Uint8Array(total);
  let position = 0;
  for (const morceau of morceaux) {
    octets.set(morceau, position);
    position += morceau.length;
  }
  return octets;
}

function flux(octets: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controleur) {
      controleur.enqueue(octets);
      controleur.close();
    },
  });
}

/** Valeur JSON → texte compressé sûr pour une URL. */
export async function compresserJson(valeur: unknown): Promise<string> {
  const octets = new TextEncoder().encode(JSON.stringify(valeur));
  const compresse = flux(octets).pipeThrough(
    new CompressionStream(FORMAT) as unknown as ReadableWritablePair<Uint8Array, Uint8Array>,
  );
  return versBase64Url(await lireTout(compresse, Number.POSITIVE_INFINITY));
}

/** Texte compressé → valeur JSON ; jamais d'exception (base64, deflate, UTF-8 ou JSON invalide, trop gros). */
export async function decompresserJson(
  texte: string,
  plafond = TAILLE_MAX_DECOMPRESSEE,
): Promise<LectureJson> {
  try {
    const decompresse = flux(depuisBase64Url(texte)).pipeThrough(
      new DecompressionStream(FORMAT) as unknown as ReadableWritablePair<Uint8Array, Uint8Array>,
    );
    const json = new TextDecoder('utf-8', { fatal: true }).decode(
      await lireTout(decompresse, plafond),
    );
    return { ok: true, valeur: JSON.parse(json) as unknown };
  } catch {
    return { ok: false };
  }
}
