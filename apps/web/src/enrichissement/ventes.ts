import type { VenteProcheAdresse } from './contrat';

/**
 * Tri, filtres et pages du tableau des ventes comparables, dans le navigateur (le Worker en renvoie jusqu'à 300).
 * Fonctions pures : la même liste et les mêmes réglages donnent toujours le même tableau.
 */

export const CLES_TRI = [
  'date',
  'surface',
  'pieces',
  'prix',
  'prixM2',
  'prixAujourdhui',
  'distance',
  'dpe',
] as const;
export type CleTri = (typeof CLES_TRI)[number];
export type SensTri = 'croissant' | 'decroissant';

export interface Tri {
  readonly cle: CleTri;
  readonly sens: SensTri;
}

/** Du plus près au plus loin : l'ordre du Worker. */
export const TRI_DEFAUT: Tri = { cle: 'distance', sens: 'croissant' };
export const TAILLE_PAGE = 20;
/** « 2 dernières années » : 730 jours avant la vente la plus récente de la liste. */
export const JOURS_RECENTES = 730;

const RANG_DPE: Readonly<Record<NonNullable<VenteProcheAdresse['dpe']>['etiquetteDpe'], number>> = {
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  E: 4,
  F: 5,
  G: 6,
};

/** Prix au m² comparable au bien : actualisé et ramené à sa surface quand le Worker le donne. */
export function prixAujourdhui(v: VenteProcheAdresse): number {
  return v.prixM2Corrige ?? v.prixM2Actualise ?? v.prixM2;
}

/** Valeur d'une colonne pour le tri ; `null` quand elle est inconnue (DVF écrit 0 pièce quand il ne sait pas). */
export function valeurDeTri(v: VenteProcheAdresse, cle: CleTri): number | string | null {
  switch (cle) {
    case 'date':
      return v.date;
    case 'surface':
      return v.surface;
    case 'pieces':
      return v.pieces > 0 ? v.pieces : null;
    case 'prix':
      return v.prix;
    case 'prixM2':
      return v.prixM2;
    case 'prixAujourdhui':
      return prixAujourdhui(v);
    case 'distance':
      return v.distanceMetres;
    case 'dpe':
      return v.dpe == null ? null : RANG_DPE[v.dpe.etiquetteDpe];
  }
}

function ordre(a: number | string, b: number | string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/** Tri stable ; les valeurs inconnues restent à la fin, dans les deux sens. */
export function trierVentes<V extends VenteProcheAdresse>(ventes: readonly V[], tri: Tri): V[] {
  const signe = tri.sens === 'croissant' ? 1 : -1;
  return ventes
    .map((vente, rang) => ({ vente, rang, valeur: valeurDeTri(vente, tri.cle) }))
    .sort((a, b) => {
      if (a.valeur === null || b.valeur === null) {
        return Number(a.valeur === null) - Number(b.valeur === null) || a.rang - b.rang;
      }
      return signe * ordre(a.valeur, b.valeur) || a.rang - b.rang;
    })
    .map((x) => x.vente);
}

/** Un clic sur la colonne déjà triée inverse le sens ; sur une autre, trie par ordre croissant. */
export function triSuivant(tri: Tri, cle: CleTri): Tri {
  if (tri.cle !== cle) return { cle, sens: 'croissant' };
  return { cle, sens: tri.sens === 'croissant' ? 'decroissant' : 'croissant' };
}

export interface FiltresVentes {
  readonly memeImmeuble: boolean;
  readonly recentes: boolean;
  readonly memesPieces: boolean;
  /** DPE F ou G : les passoires, peu à peu interdites à la location. */
  readonly passoires: boolean;
}

export const SANS_FILTRE: FiltresVentes = {
  memeImmeuble: false,
  recentes: false,
  memesPieces: false,
  passoires: false,
};

/** `2025-03-01` moins 730 jours. */
export function dateMoinsJours(dateIso: string, jours: number): string {
  return new Date(Date.parse(`${dateIso}T00:00:00Z`) - jours * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** Les filtres se cumulent. `piecesBien` : nombre de pièces du bien, pour « même nombre de pièces ». */
export function filtrerVentes<V extends VenteProcheAdresse>(
  ventes: readonly V[],
  filtres: FiltresVentes,
  piecesBien: number | undefined,
): V[] {
  const plusRecente = ventes.reduce((max, v) => (v.date > max ? v.date : max), '');
  const limite = plusRecente === '' ? '' : dateMoinsJours(plusRecente, JOURS_RECENTES);
  const passoire = (v: V): boolean => v.dpe?.etiquetteDpe === 'F' || v.dpe?.etiquetteDpe === 'G';
  return ventes.filter(
    (v) =>
      (!filtres.memeImmeuble || v.groupes.includes('meme_parcelle')) &&
      (!filtres.recentes || v.date >= limite) &&
      (!filtres.memesPieces || v.pieces === piecesBien) &&
      (!filtres.passoires || passoire(v)),
  );
}

export interface PageVentes<V> {
  readonly lignes: readonly V[];
  /** Page affichée, ramenée entre 1 et le nombre de pages. */
  readonly page: number;
  /** Au moins 1, même pour une liste vide. */
  readonly pages: number;
}

export function pageDe<V>(liste: readonly V[], page: number, taille = TAILLE_PAGE): PageVentes<V> {
  const pages = Math.max(1, Math.ceil(liste.length / taille));
  const courante = Math.min(Math.max(1, Math.floor(page)), pages);
  return { lignes: liste.slice((courante - 1) * taille, courante * taille), page: courante, pages };
}
