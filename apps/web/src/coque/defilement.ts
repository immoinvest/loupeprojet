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

/** Position d'un champ par rapport au haut visible du contenu, et sa hauteur, en px. */
export interface PositionChamp {
  readonly haut: number;
  readonly hauteur: number;
}

/** Le contenu qui défile verticalement : position de défilement et hauteur visible, en px. */
export interface EtatContenu {
  readonly defilement: number;
  readonly hauteurVisible: number;
}

/**
 * Position de défilement qui centre un champ dans la partie du contenu que les éléments collés
 * (en-tête du projet, synthèse) laissent visible. `masque` : hauteur qu'ils couvrent en haut,
 * jamais plus de la moitié de l'écran. Un champ plus haut que la zone s'aligne sous le masque.
 */
export function defilementPourCentrer(
  champ: PositionChamp,
  contenu: EtatContenu,
  masque: number,
): number {
  const couvert = Math.min(Math.max(0, masque), contenu.hauteurVisible / 2);
  const zone = contenu.hauteurVisible - couvert;
  const marge = champ.hauteur >= zone ? 0 : (zone - champ.hauteur) / 2;
  return Math.max(0, Math.round(contenu.defilement + champ.haut - couvert - marge));
}

/** Type de navigation de React Router. */
export type TypeNavigation = 'POP' | 'PUSH' | 'REPLACE';

/**
 * Position du contenu en arrivant sur un volet : celle où on l'avait laissé quand on y revient par
 * l'historique (bouton précédent, « Revenir à … »), le haut sinon.
 */
export function positionAuRetour(
  navigation: TypeNavigation,
  memorisee: number | undefined,
): number {
  return navigation === 'POP' ? (memorisee ?? 0) : 0;
}
