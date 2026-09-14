import { z } from 'zod';

import type { Dependances } from '../dependances';
import { messageDe } from '../erreurs';
import { distanceAnneaux, type Anneau, type Point } from './geometrie';

/** API Carto de l'IGN, module cadastre : parcelles intersectant une géométrie GeoJSON. */
export const URL_CADASTRE = 'https://apicarto.ign.fr/api/cadastre/parcelle';
/** Une parcelle est voisine si son contour passe à moins de 3 m de celui du bien. */
export const TOLERANCE_VOISINAGE_M = 3;
/** Marge autour de la parcelle du bien pour trouver les candidates (environ 12 à 17 m). */
export const MARGE_DEGRES = 0.00015;
const DELAI_CADASTRE_MS = 8000;

const PositionSchema = z.tuple([z.number(), z.number()], z.number());
const GeometrieSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('Polygon'), coordinates: z.array(z.array(PositionSchema)) }),
  z.object({
    type: z.literal('MultiPolygon'),
    coordinates: z.array(z.array(z.array(PositionSchema))),
  }),
]);
type Geometrie = z.infer<typeof GeometrieSchema>;

const ReponseCadastreSchema = z.object({
  features: z.array(
    z.object({ geometry: GeometrieSchema, properties: z.object({ idu: z.string().min(1) }) }),
  ),
});

export interface Parcelle {
  readonly idu: string;
  readonly anneaux: readonly Anneau[];
}

export interface Voisinage {
  readonly idParcelle: string | null;
  readonly voisines: readonly string[];
}

/** Contours extérieurs d'un polygone ou d'un multipolygone GeoJSON (trous ignorés). */
export function anneauxDe(geometrie: Geometrie): Anneau[] {
  const polygones = geometrie.type === 'Polygon' ? [geometrie.coordinates] : geometrie.coordinates;
  return polygones.map((polygone) =>
    polygone.slice(0, 1).flatMap((anneau) => anneau.map(([lon, lat]) => ({ lat, lon }))),
  );
}

/** Rectangle GeoJSON englobant les contours, élargi d'une marge en degrés ; `null` sans aucun sommet. */
export function boiteAutour(anneaux: readonly Anneau[], marge: number): Geometrie | null {
  const points = anneaux.flat();
  if (points.length === 0) return null;
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const [sud, nord] = [Math.min(...lats) - marge, Math.max(...lats) + marge];
  const [ouest, est] = [Math.min(...lons) - marge, Math.max(...lons) + marge];
  return {
    type: 'Polygon',
    coordinates: [
      [
        [ouest, sud],
        [est, sud],
        [est, nord],
        [ouest, nord],
        [ouest, sud],
      ],
    ],
  };
}

export function distanceParcelles(a: Parcelle, b: Parcelle): number {
  let minimum = Number.POSITIVE_INFINITY;
  for (const anneauA of a.anneaux) {
    for (const anneauB of b.anneaux) minimum = Math.min(minimum, distanceAnneaux(anneauA, anneauB));
  }
  return minimum;
}

async function interroger(deps: Dependances, geometrie: unknown): Promise<Parcelle[] | null> {
  const url = new URL(URL_CADASTRE);
  url.searchParams.set('geom', JSON.stringify(geometrie));
  let reponse: Response;
  try {
    reponse = await deps.fetcher(url, {
      signal: AbortSignal.timeout(DELAI_CADASTRE_MS),
      headers: { accept: 'application/json' },
    });
  } catch (erreur) {
    deps.journal.erreur('cadastre.injoignable', { raison: messageDe(erreur) });
    return null;
  }
  if (!reponse.ok) {
    deps.journal.erreur('cadastre.erreur', { statutAmont: reponse.status });
    return null;
  }
  let corps: unknown;
  try {
    corps = await reponse.json();
  } catch (erreur) {
    deps.journal.erreur('cadastre.invalide', { raison: messageDe(erreur) });
    return null;
  }
  const lecture = ReponseCadastreSchema.safeParse(corps);
  if (!lecture.success) {
    deps.journal.erreur('cadastre.invalide', { raison: 'réponse hors contrat' });
    return null;
  }
  return lecture.data.features.map((f) => ({
    idu: f.properties.idu,
    anneaux: anneauxDe(f.geometry),
  }));
}

/**
 * Parcelle cadastrale du point, puis parcelles dont le contour passe à moins de 3 m du sien.
 * `null` si le cadastre ne répond pas : l'analyse se fait alors sans ces deux groupes.
 */
export async function voisinageDe(deps: Dependances, point: Point): Promise<Voisinage | null> {
  const auPoint = await interroger(deps, { type: 'Point', coordinates: [point.lon, point.lat] });
  if (auPoint === null) return null;
  const [parcelle] = auPoint;
  if (parcelle === undefined) return { idParcelle: null, voisines: [] };
  const boite = boiteAutour(parcelle.anneaux, MARGE_DEGRES);
  if (boite === null) return { idParcelle: parcelle.idu, voisines: [] };
  const alentour = await interroger(deps, boite);
  if (alentour === null) return null;
  const voisines = alentour
    .filter(
      (p) => p.idu !== parcelle.idu && distanceParcelles(p, parcelle) <= TOLERANCE_VOISINAGE_M,
    )
    .map((p) => p.idu);
  return { idParcelle: parcelle.idu, voisines: [...new Set(voisines)].sort() };
}
