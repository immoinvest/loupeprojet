import type { ReponseAdresse, VenteCarte, VenteProcheAdresse } from './contrat';

const BASE_WMTS = 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0';

/**
 * Tuiles d'une couche WMTS de la Géoplateforme en web Mercator (`PM`), sans clé : service public gratuit.
 * Chaque tuile demandée révèle à l'IGN la zone affichée, et rien d'autre.
 */
export function urlTuilesIgn(
  couche: string,
  style: string,
  format: 'image/png' | 'image/jpeg',
): string {
  return `${BASE_WMTS}&LAYER=${couche}&STYLE=${encodeURIComponent(style)}&TILEMATRIXSET=PM&FORMAT=${format}&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}`;
}

export const URL_TUILES_IGN = urlTuilesIgn(
  'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2',
  'normal',
  'image/png',
);
export const ATTRIBUTION_IGN = '© IGN, Plan IGN (Géoplateforme)';
/** Niveau de zoom le plus fin publié pour le Plan IGN ; la carte ne va pas au-delà, quel que soit le fond. */
export const ZOOM_MAX_IGN = 19;
/** Les cercles de l'analyse d'adresse, du plus petit au plus large. */
export const RAYONS_CARTE_METRES = [100, 200, 300] as const;
export type RayonCarte = (typeof RAYONS_CARTE_METRES)[number];

export interface CoucheTuiles {
  readonly url: string;
  readonly attribution: string;
}

export const FONDS_CARTE = ['plan', 'photo'] as const;
export type FondCarte = (typeof FONDS_CARTE)[number];

/** Les fonds proposés : Plan IGN (défaut) et photographies aériennes, vérifiés sur la Géoplateforme le 15/09/2026. */
export const COUCHES_FOND: Readonly<Record<FondCarte, CoucheTuiles>> = {
  plan: { url: URL_TUILES_IGN, attribution: ATTRIBUTION_IGN },
  photo: {
    url: urlTuilesIgn('ORTHOIMAGERY.ORTHOPHOTOS', 'normal', 'image/jpeg'),
    attribution: '© IGN, photographies aériennes (Géoplateforme)',
  },
};

/** Les parcelles cadastrales, par-dessus le fond choisi. */
export const COUCHE_PARCELLES: CoucheTuiles = {
  url: urlTuilesIgn('CADASTRALPARCELS.PARCELLAIRE_EXPRESS', 'PCI vecteur', 'image/png'),
  attribution: '© IGN, Parcellaire Express (Géoplateforme)',
};

/** Place d'une vente par rapport au repère : sous le premier quart, entre les quarts, au-dessus du troisième. */
export type ClassePrix = 'bas' | 'milieu' | 'haut';

export interface ReperePrixCarte {
  readonly q1M2: number;
  readonly q3M2: number;
}

export interface PointCarte extends VenteCarte {
  readonly classe: ClassePrix;
  /** Clé partagée avec la ligne du tableau des ventes (`cleVente`). */
  readonly cle: string;
  /** La même vente dans le tableau (DPE, Carrez, dépendances…) ; `null` quand elle n'y figure pas. */
  readonly vente: VenteProcheAdresse | null;
}

export interface DonneesCarte {
  readonly points: readonly PointCarte[];
  readonly repere: ReperePrixCarte | null;
}

/**
 * Identifie une vente dans les deux listes du Worker (`ventesCarte` et `ventesProches`), bâties sur les mêmes ventes
 * avec les mêmes arrondis : date, prix, surface et distance au mètre.
 */
export function cleVente(v: {
  readonly date: string;
  readonly prix: number;
  readonly surface: number;
  readonly distanceMetres: number | null;
}): string {
  return [v.date, String(v.prix), String(v.surface), String(v.distanceMetres ?? '')].join('|');
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

/**
 * Les points de la carte, classés par rapport au repère et rapprochés de leur ligne du tableau ;
 * `null` sans vente géolocalisée ou avec un Worker d'avant la carte.
 */
export function donneesCarte(analyse: ReponseAdresse): DonneesCarte | null {
  const ventes = analyse.ventesCarte ?? [];
  if (ventes.length === 0) return null;
  const repere = repereCarte(analyse);
  const parCle = new Map<string, VenteProcheAdresse>();
  for (const vente of analyse.ventesProches) {
    const cle = cleVente(vente);
    if (!parCle.has(cle)) parCle.set(cle, vente);
  }
  return {
    repere,
    points: ventes.map((v) => {
      const cle = cleVente(v);
      return {
        ...v,
        classe: classePrix(v.prixM2Corrige, repere),
        cle,
        vente: parCle.get(cle) ?? null,
      };
    }),
  };
}
