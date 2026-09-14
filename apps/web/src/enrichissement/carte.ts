import type { ReponseAdresse, VenteCarte } from './contrat';

/**
 * Tuiles du Plan IGN, service WMTS de la Géoplateforme en web Mercator (`PM`), sans clé : service public
 * gratuit. Chaque tuile demandée révèle à l'IGN la zone affichée, et rien d'autre.
 */
export const URL_TUILES_IGN =
  'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';
export const ATTRIBUTION_IGN = '© IGN, Plan IGN (Géoplateforme)';
/** Niveau de zoom le plus fin publié pour le Plan IGN. */
export const ZOOM_MAX_IGN = 19;
/** Les cercles de l'analyse d'adresse, du plus petit au plus large. */
export const RAYONS_CARTE_METRES = [100, 200, 300] as const;

/** Place d'une vente par rapport au repère : sous le premier quart, entre les quarts, au-dessus du troisième. */
export type ClassePrix = 'bas' | 'milieu' | 'haut';

export interface ReperePrixCarte {
  readonly q1M2: number;
  readonly q3M2: number;
}

export interface PointCarte extends VenteCarte {
  readonly classe: ClassePrix;
}

export interface DonneesCarte {
  readonly points: readonly PointCarte[];
  readonly repere: ReperePrixCarte | null;
}

/** Les quartiles du repère de l'analyse, sinon ceux du cercle de 300 m ; `null` sans statistiques. */
export function repereCarte(analyse: ReponseAdresse): ReperePrixCarte | null {
  const statistiques =
    analyse.reference?.statistiques ??
    analyse.groupes.find((g) => g.code === 'rayon_300')?.statistiques ??
    null;
  return statistiques === null ? null : { q1M2: statistiques.q1M2, q3M2: statistiques.q3M2 };
}

export function classePrix(prixM2: number, repere: ReperePrixCarte | null): ClassePrix {
  if (repere === null) return 'milieu';
  if (prixM2 < repere.q1M2) return 'bas';
  return prixM2 > repere.q3M2 ? 'haut' : 'milieu';
}

/** Les points de la carte, classés par rapport au repère ; `null` sans vente géolocalisée ou avec un Worker d'avant la carte. */
export function donneesCarte(analyse: ReponseAdresse): DonneesCarte | null {
  const ventes = analyse.ventesCarte ?? [];
  if (ventes.length === 0) return null;
  const repere = repereCarte(analyse);
  return {
    repere,
    points: ventes.map((v) => ({ ...v, classe: classePrix(v.prixM2Corrige, repere) })),
  };
}
