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

/** Copie d'un objet dont les clés sont triées : les fichiers publiés restent stables d'une génération à l'autre. */
export function objetTrie<T>(entrees: Readonly<Record<string, T>>): Record<string, T> {
  const resultat: Record<string, T> = {};
  for (const [cle, valeur] of Object.entries(entrees).sort(([a], [b]) => a.localeCompare(b))) {
    resultat[cle] = valeur;
  }
  return resultat;
}
