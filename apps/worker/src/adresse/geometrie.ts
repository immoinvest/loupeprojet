export interface Point {
  readonly lat: number;
  readonly lon: number;
}

/** Un contour de parcelle : suite de sommets, le dernier rejoignant le premier. */
export type Anneau = readonly Point[];

const RAYON_TERRE_M = 6_371_000;
const RADIAN = Math.PI / 180;

/** Distance à vol d'oiseau en mètres (formule de haversine). */
export function distanceMetres(a: Point, b: Point): number {
  const dLat = (b.lat - a.lat) * RADIAN;
  const dLon = (b.lon - a.lon) * RADIAN;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * RADIAN) * Math.cos(b.lat * RADIAN) * Math.sin(dLon / 2) ** 2;
  return 2 * RAYON_TERRE_M * Math.asin(Math.sqrt(h));
}

interface Plan {
  readonly x: number;
  readonly y: number;
}

/** Projection locale en mètres autour d'une origine : exacte à quelques centimètres près à l'échelle d'une rue. */
function projeter(p: Point, origine: Point): Plan {
  return {
    x: (p.lon - origine.lon) * RADIAN * RAYON_TERRE_M * Math.cos(origine.lat * RADIAN),
    y: (p.lat - origine.lat) * RADIAN * RAYON_TERRE_M,
  };
}

/** Distance en mètres d'un point au segment [a, b]. */
export function distancePointSegment(p: Point, a: Point, b: Point): number {
  const pa = projeter(a, p);
  const pb = projeter(b, p);
  const dx = pb.x - pa.x;
  const dy = pb.y - pa.y;
  const longueur2 = dx * dx + dy * dy;
  const t = longueur2 === 0 ? 0 : Math.max(0, Math.min(1, -(pa.x * dx + pa.y * dy) / longueur2));
  return Math.hypot(pa.x + t * dx, pa.y + t * dy);
}

function distancePointAnneau(p: Point, anneau: Anneau): number {
  let minimum = Number.POSITIVE_INFINITY;
  let precedent: Point | null = null;
  for (const courant of anneau) {
    if (precedent !== null)
      minimum = Math.min(minimum, distancePointSegment(p, precedent, courant));
    precedent = courant;
  }
  return minimum;
}

/**
 * Plus courte distance entre deux contours : chaque sommet de l'un contre les côtés de l'autre, dans les
 * deux sens. Deux parcelles mitoyennes sont à 0 m (au bruit de numérisation près).
 */
export function distanceAnneaux(a: Anneau, b: Anneau): number {
  let minimum = Number.POSITIVE_INFINITY;
  for (const p of a) minimum = Math.min(minimum, distancePointAnneau(p, b));
  for (const p of b) minimum = Math.min(minimum, distancePointAnneau(p, a));
  return minimum;
}
