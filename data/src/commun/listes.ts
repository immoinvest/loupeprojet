/**
 * Accès à un élément dont on sait qu'il existe. Avec `noUncheckedIndexedAccess`, l'indexation
 * rend `T | undefined` ; cette fonction rend `T` et échoue franchement si l'index est hors liste.
 */
export function elementA<T>(liste: readonly T[], index: number): T {
  const element = liste[index];
  if (element === undefined) {
    throw new RangeError(
      `index ${String(index)} hors de la liste (${String(liste.length)} éléments)`,
    );
  }
  return element;
}
