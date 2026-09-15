/** Plusieurs ventes au même point (le même immeuble) : une pastille chiffrée qui s'ouvre en éventail. */

export interface GroupePoints<P> {
  /** `lat,lon` : les coordonnées du Worker sont déjà arrondies au millionième de degré. */
  readonly cle: string;
  readonly lat: number;
  readonly lon: number;
  readonly points: readonly P[];
}

/** Regroupe les points aux coordonnées identiques, dans l'ordre de leur première apparition. */
export function grouperPoints<P extends { readonly lat: number; readonly lon: number }>(
  points: readonly P[],
): GroupePoints<P>[] {
  const groupes = new Map<string, { lat: number; lon: number; points: P[] }>();
  for (const point of points) {
    const cle = `${String(point.lat)},${String(point.lon)}`;
    const groupe = groupes.get(cle);
    if (groupe === undefined) groupes.set(cle, { lat: point.lat, lon: point.lon, points: [point] });
    else groupe.points.push(point);
  }
  return [...groupes].map(([cle, groupe]) => ({ cle, ...groupe }));
}

export interface Decalage {
  readonly x: number;
  readonly y: number;
}

/** Écart minimal entre deux pastilles de l'éventail, en pixels (pastilles de 14 px). */
export const ECART_EVENTAIL_PX = 22;
export const RAYON_EVENTAIL_MIN_PX = 26;

/**
 * Décalages en pixels de `n` pastilles réparties en cercle autour du point, la première en haut ; le rayon grandit
 * avec le nombre pour garder l'écart minimal.
 */
export function eventail(n: number): Decalage[] {
  const rayon = Math.max(RAYON_EVENTAIL_MIN_PX, (n * ECART_EVENTAIL_PX) / (2 * Math.PI));
  return Array.from({ length: n }, (_, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return { x: rayon * Math.cos(angle), y: rayon * Math.sin(angle) };
  });
}
