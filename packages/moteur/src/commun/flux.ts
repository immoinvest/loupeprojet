/** Somme d'une série de montants. */
export function sommer(valeurs: readonly number[]): number {
  return valeurs.reduce((acc, v) => acc + v, 0);
}

/**
 * Valeur actuelle nette d'une série de flux annuels : `flux[0]` est à l'instant 0,
 * `flux[t]` à la fin de l'année t.
 */
export function van(flux: readonly number[], taux: number): number {
  return flux.reduce((acc, montant, t) => acc + montant / (1 + taux) ** t, 0);
}
