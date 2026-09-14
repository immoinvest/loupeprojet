import { distanceMetres, type Point } from './geometrie';
import type { VenteDvf } from './ventes';

export type TypeLogement = 'appartement' | 'maison';

export type CodeGroupe =
  | 'meme_parcelle'
  | 'parcelles_voisines'
  | 'meme_cote'
  | 'en_face'
  | 'rayon_100'
  | 'rayon_200'
  | 'rayon_300';

/** Ordre d'affichage : du plus proche au plus large. */
export const GROUPES: readonly CodeGroupe[] = [
  'meme_parcelle',
  'parcelles_voisines',
  'meme_cote',
  'en_face',
  'rayon_100',
  'rayon_200',
  'rayon_300',
];

/** Ordre de choix du repère de prix : le groupe le plus précis qui compte assez de ventes comparables. */
export const ORDRE_REFERENCE: readonly CodeGroupe[] = [
  'meme_parcelle',
  'parcelles_voisines',
  'meme_cote',
  'rayon_100',
  'en_face',
  'rayon_200',
  'rayon_300',
];

/** En dessous de 5 ventes comparables, une médiane ne dit pas grand-chose. */
export const SEUIL_REFERENCE = 5;
/** Comparable : même type de logement, surface à ±40 % de celle du bien quand elle est connue. */
export const TOLERANCE_SURFACE = 0.4;
export const MAX_VENTES_PROCHES = 20;

const RAYONS: readonly (readonly [number, CodeGroupe])[] = [
  [100, 'rayon_100'],
  [200, 'rayon_200'],
  [300, 'rayon_300'],
];

export interface BienAdresse {
  readonly point: Point;
  readonly numero: number | null;
  readonly codeVoie: string | null;
  readonly idParcelle: string | null;
  readonly voisines: readonly string[];
  readonly type: TypeLogement;
  readonly surface?: number | undefined;
}

export interface StatistiquesPrix {
  readonly ventes: number;
  readonly medianeM2: number;
  readonly q1M2: number;
  readonly q3M2: number;
  readonly minM2: number;
  readonly maxM2: number;
}

export interface Groupe {
  readonly code: CodeGroupe;
  /** Toutes les ventes de logement du groupe. */
  readonly ventes: number;
  /** Celles qui ressemblent au bien (type, surface) : ce sont elles qui font les prix. */
  readonly comparables: number;
  /** Prix au m² actualisés (ramenés au dernier semestre connu). */
  readonly statistiques: StatistiquesPrix | null;
  readonly distanceMaxMetres: number | null;
}

export interface VenteProche {
  readonly date: string;
  readonly prix: number;
  readonly surface: number;
  /** Prix au m² de l'acte, à sa date. */
  readonly prixM2: number;
  /** Même prix ramené au dernier semestre connu par la tendance locale. */
  readonly prixM2Actualise: number;
  readonly coefficient: number;
  readonly pieces: number;
  readonly type: TypeLogement;
  readonly adresse: string | null;
  readonly distanceMetres: number | null;
  readonly groupes: readonly CodeGroupe[];
}

export interface Reference {
  readonly code: CodeGroupe;
  readonly rayonMetres: number;
  readonly statistiques: StatistiquesPrix;
}

export interface AnalyseAdresse {
  readonly ventesCommune: number;
  readonly groupes: readonly Groupe[];
  readonly reference: Reference | null;
  readonly ventesProches: readonly VenteProche[];
}

/** Coefficient d'actualisation d'une vente (selon sa date et sa commune) ; 1 quand la tendance est inconnue. */
export type Actualiser = (vente: VenteDvf) => number;

const SANS_ACTUALISATION: Actualiser = () => 1;

/** Valeur à un rang d'une liste ; un rang hors liste est une erreur de programmation. */
export function valeurAuRang(liste: readonly number[], rang: number): number {
  const valeur = liste[rang];
  if (valeur === undefined) throw new RangeError(`rang ${String(rang)} hors de la liste`);
  return valeur;
}

/** Quantile par interpolation linéaire (méthode 7 de Hyndman et Fan, celle de l'index DVF publié). */
export function quantile(tries: readonly number[], q: number): number {
  const position = (tries.length - 1) * q;
  const bas = Math.floor(position);
  const basse = valeurAuRang(tries, bas);
  return basse + (valeurAuRang(tries, Math.ceil(position)) - basse) * (position - bas);
}

export function statistiquesPrix(prixM2: readonly number[]): StatistiquesPrix | null {
  if (prixM2.length === 0) return null;
  const tries = [...prixM2].sort((a, b) => a - b);
  return {
    ventes: tries.length,
    medianeM2: Math.round(quantile(tries, 0.5)),
    q1M2: Math.round(quantile(tries, 0.25)),
    q3M2: Math.round(quantile(tries, 0.75)),
    minM2: Math.round(valeurAuRang(tries, 0)),
    maxM2: Math.round(valeurAuRang(tries, tries.length - 1)),
  };
}

/** Numérotation française : les numéros pairs d'un côté de la rue, les impairs de l'autre. */
export function groupesDe(
  vente: VenteDvf,
  bien: BienAdresse,
  distance: number | null,
): CodeGroupe[] {
  const groupes: CodeGroupe[] = [];
  if (bien.idParcelle !== null && vente.idParcelle === bien.idParcelle)
    groupes.push('meme_parcelle');
  if (vente.idParcelle !== null && bien.voisines.includes(vente.idParcelle)) {
    groupes.push('parcelles_voisines');
  }
  if (
    bien.codeVoie !== null &&
    vente.codeVoie === bien.codeVoie &&
    bien.numero !== null &&
    vente.numero !== null
  ) {
    groupes.push(vente.numero % 2 === bien.numero % 2 ? 'meme_cote' : 'en_face');
  }
  if (distance !== null) {
    for (const [rayon, code] of RAYONS) if (distance <= rayon) groupes.push(code);
  }
  return groupes;
}

export function estComparable(vente: VenteDvf, bien: BienAdresse): boolean {
  if (vente.type !== bien.type) return false;
  if (bien.surface === undefined) return true;
  return (
    vente.surface >= bien.surface * (1 - TOLERANCE_SURFACE) &&
    vente.surface <= bien.surface * (1 + TOLERANCE_SURFACE)
  );
}

export function adresseDe(vente: VenteDvf): string | null {
  if (vente.voie === null) return null;
  const numero = vente.numero === null ? '' : `${String(vente.numero)}${vente.suffixe ?? ''} `;
  return `${numero}${vente.voie}`;
}

interface VenteSituee {
  readonly vente: VenteDvf;
  readonly distance: number | null;
  readonly groupes: readonly CodeGroupe[];
  readonly comparable: boolean;
  readonly coefficient: number;
  readonly prixM2Actualise: number;
}

function groupe(code: CodeGroupe, situees: readonly VenteSituee[]): Groupe {
  const membres = situees.filter((s) => s.groupes.includes(code));
  const comparables = membres.filter((s) => s.comparable);
  const distances = comparables.flatMap((s) => (s.distance === null ? [] : [s.distance]));
  return {
    code,
    ventes: membres.length,
    comparables: comparables.length,
    statistiques: statistiquesPrix(comparables.map((s) => s.prixM2Actualise)),
    distanceMaxMetres: distances.length === 0 ? null : Math.round(Math.max(...distances)),
  };
}

/**
 * Analyse des ventes de la commune autour d'une adresse précise : même immeuble, parcelles voisines,
 * même côté de la rue, en face, cercles de 100 à 300 m. Les prix sont actualisés par `actualiser`
 * avant les statistiques. Pure, sans réseau, sans modèle de langage.
 */
export function analyserAdresse(
  ventes: readonly VenteDvf[],
  bien: BienAdresse,
  actualiser: Actualiser = SANS_ACTUALISATION,
): AnalyseAdresse {
  const situees: VenteSituee[] = ventes.map((vente) => {
    const distance =
      vente.lat === null || vente.lon === null
        ? null
        : distanceMetres(bien.point, { lat: vente.lat, lon: vente.lon });
    const coefficient = actualiser(vente);
    return {
      vente,
      distance,
      groupes: groupesDe(vente, bien, distance),
      comparable: estComparable(vente, bien),
      coefficient,
      prixM2Actualise: (vente.prix / vente.surface) * coefficient,
    };
  });
  const parCode = Object.fromEntries(
    GROUPES.map((code) => [code, groupe(code, situees)]),
  ) as Record<CodeGroupe, Groupe>;
  let reference: Reference | null = null;
  for (const code of ORDRE_REFERENCE) {
    const { statistiques, distanceMaxMetres } = parCode[code];
    if (statistiques !== null && statistiques.ventes >= SEUIL_REFERENCE) {
      reference = { code, rayonMetres: Math.max(10, distanceMaxMetres ?? 10), statistiques };
      break;
    }
  }
  const ventesProches = situees
    .filter((s) => s.comparable && s.groupes.length > 0)
    .sort(
      (a, b) => (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY),
    )
    .slice(0, MAX_VENTES_PROCHES)
    .map((s) => ({
      date: s.vente.date,
      prix: s.vente.prix,
      surface: s.vente.surface,
      prixM2: Math.round(s.vente.prix / s.vente.surface),
      prixM2Actualise: Math.round(s.prixM2Actualise),
      coefficient: Math.round(s.coefficient * 10_000) / 10_000,
      pieces: s.vente.pieces,
      type: s.vente.type,
      adresse: adresseDe(s.vente),
      distanceMetres: s.distance === null ? null : Math.round(s.distance),
      groupes: s.groupes,
    }));
  return {
    ventesCommune: ventes.length,
    groupes: GROUPES.map((code) => parCode[code]),
    reference,
    ventesProches,
  };
}
