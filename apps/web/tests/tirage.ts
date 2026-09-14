/**
 * Tirages pseudo-aléatoires reproductibles pour les tests de propriétés (mulberry32, graine fixe) :
 * un cas en échec se rejoue à l'identique, sans dépendance de plus.
 */
export function tirage(graine: number): () => number {
  let etat = graine;
  return () => {
    etat = (etat + 0x6d2b79f5) | 0;
    let t = Math.imul(etat ^ (etat >>> 15), 1 | etat);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Un élément de la liste, tiré au hasard. */
export function auHasard<T>(hasard: () => number, liste: readonly T[]): T {
  const element = liste[Math.floor(hasard() * liste.length)];
  if (element === undefined) throw new Error('liste vide');
  return element;
}

/** Entre 0 et `max` éléments de la liste, tirés au hasard et mis bout à bout. */
export function assemblage(hasard: () => number, liste: readonly string[], max: number): string {
  const nombre = Math.floor(hasard() * (max + 1));
  return Array.from({ length: nombre }, () => auHasard(hasard, liste)).join('');
}
