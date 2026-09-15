/** Vitesse de lecture d'un texte informatif à l'écran, en mots par minute. */
const MOTS_PAR_MINUTE = 230;

/** Les mots du texte d'un guide, sans les lignes d'import ni les balises des composants MDX. */
export function motsDuCorps(corps: string): string[] {
  const texte = corps.replace(/^import\s.*$/gm, ' ').replace(/<[^>]*>/g, ' ');
  return texte.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? [];
}

export function nombreDeMots(corps: string): number {
  return motsDuCorps(corps).length;
}

/** Temps de lecture affiché, en minutes entières (une au moins). */
export function tempsDeLecture(corps: string): number {
  return Math.max(1, Math.ceil(nombreDeMots(corps) / MOTS_PAR_MINUTE));
}
