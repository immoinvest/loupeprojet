import { cleVente, type PointCarte, type RayonCarte } from './carte';
import type { VenteProcheAdresse } from './contrat';
import { filtrerVentes, SANS_FILTRE, TAILLE_PAGE, type FiltresVentes } from './ventes';

/**
 * La carte des ventes et le tableau des ventes partagent la vente sélectionnée, les filtres et le rayon.
 * Réducteur pur ; l'écran Estimation le tient et le passe aux deux.
 */

export type Affichage = 'carte' | 'tableau';

export interface EtatLiaison {
  /** Clé de la vente mise en avant (`cleVente`), des deux côtés. */
  readonly selection: string | null;
  /** Où amener la vente sélectionnée à la dernière demande « Voir dans le tableau » ou « Sur la carte ». */
  readonly afficher: Affichage | null;
  /** Compteur de demandes : la même vente peut être redemandée. */
  readonly demande: number;
  readonly filtres: FiltresVentes;
  /** Cercle cliqué sur la carte : seulement les ventes à cette distance au plus. */
  readonly rayon: RayonCarte | null;
}

export const ETAT_LIAISON_INITIAL: EtatLiaison = {
  selection: null,
  afficher: null,
  demande: 0,
  filtres: SANS_FILTRE,
  rayon: null,
};

export type ActionLiaison =
  | { readonly type: 'selectionner'; readonly cle: string | null }
  | { readonly type: 'voir'; readonly cle: string; readonly dans: Affichage }
  | { readonly type: 'filtres'; readonly filtres: FiltresVentes }
  /** Un deuxième clic sur le même rayon retire le filtre. */
  | { readonly type: 'rayon'; readonly rayon: RayonCarte }
  | { readonly type: 'reinitialiser' };

export function liaisonVentes(etat: EtatLiaison, action: ActionLiaison): EtatLiaison {
  switch (action.type) {
    case 'selectionner':
      return { ...etat, selection: action.cle, afficher: null };
    case 'voir':
      return { ...etat, selection: action.cle, afficher: action.dans, demande: etat.demande + 1 };
    case 'filtres':
      return { ...etat, filtres: action.filtres };
    case 'rayon':
      return { ...etat, rayon: etat.rayon === action.rayon ? null : action.rayon };
    case 'reinitialiser':
      return ETAT_LIAISON_INITIAL;
  }
}

/** Distance inconnue : exclue dès qu'un rayon est choisi. */
export function dansLeRayon(distanceMetres: number | null, rayon: RayonCarte | null): boolean {
  return rayon === null || (distanceMetres !== null && distanceMetres <= rayon);
}

export function filtresActifs(etat: EtatLiaison): boolean {
  return etat.rayon !== null || Object.values(etat.filtres).some((actif) => actif);
}

/** Les ventes du tableau qui passent les filtres et le rayon. */
export function ventesVisibles<V extends VenteProcheAdresse>(
  ventes: readonly V[],
  etat: EtatLiaison,
  piecesBien: number | undefined,
): V[] {
  return filtrerVentes(ventes, etat.filtres, piecesBien).filter((v) =>
    dansLeRayon(v.distanceMetres, etat.rayon),
  );
}

/**
 * Les pastilles des ventes que le tableau montre. Sans filtre, toutes ; avec un filtre, seulement celles rapprochées
 * d'une ligne visible (`ventes` : toutes les ventes du tableau, pour que « 2 dernières années » compte pareil).
 */
export function pointsVisibles(
  points: readonly PointCarte[],
  ventes: readonly VenteProcheAdresse[],
  etat: EtatLiaison,
  piecesBien: number | undefined,
): PointCarte[] {
  if (!filtresActifs(etat)) return [...points];
  const cles = new Set(ventesVisibles(ventes, etat, piecesBien).map(cleVente));
  return points.filter((p) => cles.has(p.cle));
}

/** Page du tableau (à partir de 1) où se trouve la vente ; `null` si elle n'y est pas. */
export function pageDeLaVente(
  affichees: readonly VenteProcheAdresse[],
  cle: string,
  taille = TAILLE_PAGE,
): number | null {
  const rang = affichees.findIndex((v) => cleVente(v) === cle);
  return rang === -1 ? null : Math.floor(rang / taille) + 1;
}
