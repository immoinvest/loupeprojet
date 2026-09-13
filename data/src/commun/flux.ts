/** Encodages rencontrés dans les jeux publics : UTF-8 partout, sauf les CSV de l'ANIL (Windows-1252). */
export type Encodage = 'utf-8' | 'windows-1252';

/**
 * Décode un flux d'octets en flux de texte. Le décodeur travaille en continu :
 * un caractère multi-octets coupé entre deux morceaux est reconstitué.
 */
export async function* decoderTexte(
  octets: AsyncIterable<Uint8Array>,
  encodage: Encodage,
): AsyncGenerator<string> {
  const decodeur = new TextDecoder(encodage);
  for await (const morceau of octets) {
    const texte = decodeur.decode(morceau, { stream: true });
    if (texte.length > 0) {
      yield texte;
    }
  }
  const reste = decodeur.decode();
  if (reste.length > 0) {
    yield reste;
  }
}

/** Flux asynchrone construit à partir de morceaux déjà en mémoire (tests, petits fichiers). */
export function depuisMorceaux<T>(morceaux: Iterable<T>): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator](): AsyncGenerator<T> {
      for (const morceau of morceaux) {
        yield await Promise.resolve(morceau);
      }
    },
  };
}

/** Rassemble un flux asynchrone en tableau. */
export async function collecter<T>(flux: AsyncIterable<T>): Promise<T[]> {
  const resultat: T[] = [];
  for await (const element of flux) {
    resultat.push(element);
  }
  return resultat;
}
