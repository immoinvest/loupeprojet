import { ErreurResolution } from './erreurs';

export interface OptionsResolution {
  /** Demi-largeur maximale de l'intervalle final (défaut 1e-9). */
  readonly tolerance?: number;
  /** Garde-fou (défaut 200 itérations : suffisant pour un intervalle de 1e6 à 1e-9). */
  readonly maxIterations?: number;
}

const TOLERANCE_DEFAUT = 1e-9;
const MAX_ITERATIONS_DEFAUT = 200;

/**
 * Trouve une racine de `f` sur [a, b] par bissection.
 * Sert au TAEG, au TRI, au point mort et aux prix cibles.
 * Lève `ErreurResolution` si `f(a)` et `f(b)` sont de même signe.
 */
export function resoudreParBissection(
  f: (x: number) => number,
  a: number,
  b: number,
  options: OptionsResolution = {},
): number {
  const tolerance = options.tolerance ?? TOLERANCE_DEFAUT;
  const maxIterations = options.maxIterations ?? MAX_ITERATIONS_DEFAUT;
  let bas = a;
  let haut = b;
  let fBas = f(bas);
  const fHaut = f(haut);
  if (fBas === 0) return bas;
  if (fHaut === 0) return haut;
  if (Math.sign(fBas) === Math.sign(fHaut)) {
    throw new ErreurResolution(`Pas de changement de signe sur [${String(a)}, ${String(b)}]`);
  }
  let milieu = (bas + haut) / 2;
  for (let i = 0; i < maxIterations; i += 1) {
    milieu = (bas + haut) / 2;
    const fMilieu = f(milieu);
    if (fMilieu === 0 || (haut - bas) / 2 < tolerance) return milieu;
    if (Math.sign(fMilieu) === Math.sign(fBas)) {
      bas = milieu;
      fBas = fMilieu;
    } else {
      haut = milieu;
    }
  }
  return milieu;
}

/** Variante qui rend `null` quand il n'y a pas de racine encadrée (cas légitime : TRI, prix cible). */
export function resoudreOuNull(
  f: (x: number) => number,
  a: number,
  b: number,
  options: OptionsResolution = {},
): number | null {
  try {
    return resoudreParBissection(f, a, b, options);
  } catch (erreur) {
    if (erreur instanceof ErreurResolution) return null;
    throw erreur;
  }
}
