/** Un libellé centré sous son repère, en pixels. */
export interface LibelleRepere {
  centre: number;
  largeur: number;
}

/**
 * Range des libellés sur des lignes pour qu'aucun ne chevauche son voisin.
 * Renvoie la ligne de chaque libellé (0 = sous la jauge), dans l'ordre reçu :
 * chaque libellé prend la première ligne où il laisse `ecart` pixels après le précédent.
 */
export function rangerLibelles(libelles: readonly LibelleRepere[], ecart = 8): number[] {
  const lignes = libelles.map(() => 0);
  const findeLigne: number[] = [];
  const ordre = libelles
    .map((l, i) => ({ ...l, i }))
    .sort((a, b) => a.centre - b.centre);
  for (const l of ordre) {
    const gauche = l.centre - l.largeur / 2;
    let ligne = findeLigne.findIndex((fin) => fin + ecart <= gauche);
    if (ligne === -1) ligne = findeLigne.length;
    findeLigne[ligne] = l.centre + l.largeur / 2;
    lignes[l.i] = ligne;
  }
  return lignes;
}
