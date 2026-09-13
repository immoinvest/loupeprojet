/**
 * Arrondi décimal explicite. Le moteur calcule en flottant et n'arrondit
 * qu'aux frontières (assemblage des résultats), jamais au milieu d'un calcul.
 */
export function arrondir(valeur: number, decimales: number): number {
  const facteur = 10 ** decimales;
  const resultat = Math.round((valeur + Number.EPSILON) * facteur) / facteur;
  // Évite le « -0 » qui s'afficherait « -0 € ».
  return resultat === 0 ? 0 : resultat;
}

export function arrondirEuro(valeur: number): number {
  return arrondir(valeur, 0);
}

export function arrondirCentime(valeur: number): number {
  return arrondir(valeur, 2);
}

/** Taux en décimal arrondi à 4 décimales (0,0335 → 3,35 %). */
export function arrondirTaux(valeur: number): number {
  return arrondir(valeur, 4);
}

/** Convertit un taux décimal en pourcentage arrondi (0,2519 → 25,2). */
export function enPourcentage(taux: number, decimales = 1): number {
  return arrondir(taux * 100, decimales);
}
