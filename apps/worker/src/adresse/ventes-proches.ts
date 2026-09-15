import type { CodeGroupe, TypeLogement, VenteSituee } from './analyse';
import { cleBanVente } from './dpe-ventes';
import type { VenteDvf } from './ventes';

/**
 * Plafond des ventes comparables renvoyées, les plus proches d'abord : le navigateur les trie, les filtre et les
 * pagine. Au-delà, `ventesProchesTronquees` le dit (« les 300 plus proches sur 1 240 »).
 */
export const MAX_VENTES_PROCHES = 300;

export interface VenteProche {
  readonly date: string;
  readonly prix: number;
  readonly surface: number;
  /** Prix au m² de l'acte, à sa date. */
  readonly prixM2: number;
  /** Même prix ramené au dernier semestre connu par la tendance locale. */
  readonly prixM2Actualise: number;
  readonly coefficient: number;
  /** (surface du bien ÷ surface de la vente) ^ pente de la commune ; 1 sans surface du bien ou sans pente. */
  readonly correctionSurface: number;
  /** Prix au m² actualisé et ramené à la surface du bien. */
  readonly prixM2Corrige: number;
  readonly pieces: number;
  readonly type: TypeLogement;
  readonly adresse: string | null;
  readonly distanceMetres: number | null;
  readonly groupes: readonly CodeGroupe[];
  /** Surface Carrez de l'acte, la plus fiable pour un appartement. */
  readonly carrez: number | null;
  /** Parcelle cadastrale de la vente. */
  readonly parcelle: string | null;
  /** Clé BAN de l'adresse de la vente, pour retrouver son DPE ; `null` sans voie, numéro ou commune. */
  readonly cleBan: string | null;
  /** Dépendances, terrain et lots : `null` dans les CSV publiés avant le 15/09/2026. */
  readonly dependances: number | null;
  readonly terrain: number | null;
  readonly lots: number | null;
}

export interface VentesProches {
  readonly ventesProches: readonly VenteProche[];
  /** Comparables avant le plafond. */
  readonly ventesProchesTotal: number;
  readonly ventesProchesTronquees: boolean;
}

export function adresseDe(vente: VenteDvf): string | null {
  if (vente.voie === null) return null;
  const numero = vente.numero === null ? '' : `${String(vente.numero)}${vente.suffixe ?? ''} `;
  return `${numero}${vente.voie}`;
}

function venteProcheDe(s: VenteSituee, codeInseeBien: string): VenteProche {
  return {
    date: s.vente.date,
    prix: s.vente.prix,
    surface: s.vente.surface,
    prixM2: Math.round(s.vente.prix / s.vente.surface),
    prixM2Actualise: Math.round(s.prixM2Actualise),
    coefficient: Math.round(s.coefficient * 10_000) / 10_000,
    correctionSurface: Math.round(s.correctionSurface * 10_000) / 10_000,
    prixM2Corrige: Math.round(s.prixM2Corrige),
    pieces: s.vente.pieces,
    type: s.vente.type,
    adresse: adresseDe(s.vente),
    distanceMetres: s.distance === null ? null : Math.round(s.distance),
    groupes: s.groupes,
    carrez: s.vente.carrez,
    parcelle: s.vente.idParcelle,
    cleBan: cleBanVente(s.vente, codeInseeBien),
    dependances: s.vente.dependances,
    terrain: s.vente.terrain,
    lots: s.vente.lots,
  };
}

/**
 * Les ventes comparables, des plus proches aux plus lointaines (sans coordonnées à la fin), plafonnées.
 * `codeInseeBien` : commune des ventes qui n'en portent pas (celles de la commune du bien). Pure.
 */
export function ventesProchesDe(
  comparables: readonly VenteSituee[],
  codeInseeBien: string,
): VentesProches {
  const triees = [...comparables].sort(
    (a, b) => (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY),
  );
  return {
    ventesProches: triees.slice(0, MAX_VENTES_PROCHES).map((s) => venteProcheDe(s, codeInseeBien)),
    ventesProchesTotal: triees.length,
    ventesProchesTronquees: triees.length > MAX_VENTES_PROCHES,
  };
}
