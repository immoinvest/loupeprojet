/** Position d'un élément dans une bande qui défile horizontalement, en px. */
export interface PositionDansBande {
  readonly debut: number;
  readonly largeur: number;
}

/** État de la bande : position de défilement et largeur visible, en px. */
export interface EtatBande {
  readonly defilement: number;
  readonly largeurVisible: number;
}

/** Marge laissée à côté de l'élément ramené en vue : la largeur des marges de la bande. */
const MARGE_PX = 16;

/**
 * Position de défilement qui montre l'élément en entier (l'onglet actif dans la bande des
 * volets). Ne bouge pas s'il est déjà visible ; plus large que la bande, on montre son début.
 */
export function defilementPourVoir(
  element: PositionDansBande,
  bande: EtatBande,
  marge: number = MARGE_PX,
): number {
  const debut = Math.max(0, element.debut - marge);
  const fin = element.debut + element.largeur + marge;
  if (fin - debut > bande.largeurVisible || debut < bande.defilement) return debut;
  if (fin > bande.defilement + bande.largeurVisible) return fin - bande.largeurVisible;
  return bande.defilement;
}
