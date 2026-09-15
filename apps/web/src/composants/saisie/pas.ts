/** Le pas d'un compteur selon sa valeur et le sens du clic (+1 ou −1). */
export type PasCompteur = (valeur: number, sens: 1 | -1) => number;

export interface BornesCompteur {
  readonly min: number;
  readonly max: number;
  /** Pas fixe, ou selon la valeur (défaut 1). */
  readonly pas?: number | PasCompteur;
  /** Valeur prise au premier clic quand le compteur est vide (défaut : `min`). */
  readonly depart?: number;
}

/** Pas de 1 jusqu'au seuil, puis `grand` : 18, 19, 20, 30, 40… et 40, 30, 20, 19… */
export function pasAdaptatif(seuil: number, grand: number): PasCompteur {
  return (valeur, sens) => ((sens === 1 ? valeur >= seuil : valeur > seuil) ? grand : 1);
}

/** Un entier écrit tel quel (« 3 », « 12 ») ; tout autre texte, vide compris : `null`. */
export function lireEntier(texte: string): number | null {
  return /^\s*\d+\s*$/.test(texte) ? Number(texte) : null;
}

/** La valeur après un clic sur − (sens −1) ou + (sens +1), bornée ; vide : la valeur de départ. */
export function valeurApresPas(texte: string, sens: 1 | -1, bornes: BornesCompteur): string {
  const { min, max, pas = 1, depart = min } = bornes;
  const borner = (n: number): string => String(Math.min(max, Math.max(min, n)));
  const n = lireEntier(texte);
  if (n === null) return borner(depart);
  return borner(n + sens * (typeof pas === 'number' ? pas : pas(n, sens)));
}

/** Les boutons à désactiver : − à la borne basse, + à la borne haute ; jamais pour un compteur vide. */
export function bornesAtteintes(
  texte: string,
  min: number,
  max: number,
): { readonly moins: boolean; readonly plus: boolean } {
  const n = lireEntier(texte);
  return n === null ? { moins: false, plus: false } : { moins: n <= min, plus: n >= max };
}
