/**
 * L'option active d'une liste de suggestions après une touche : Flèche bas et Flèche haut bouclent,
 * `-1` = aucune option active. `null` pour une touche qui ne déplace pas l'option active.
 */
export function indexActifApres(touche: string, index: number, total: number): number | null {
  if (touche !== 'ArrowDown' && touche !== 'ArrowUp') return null;
  if (total === 0) return -1;
  if (touche === 'ArrowDown') return index + 1 >= total ? 0 : index + 1;
  return index <= 0 ? total - 1 : index - 1;
}

/** Les ids réunis pour `aria-describedby`, sans les absents ; `undefined` s'il n'en reste aucun. */
export function idsDescription(...ids: readonly (string | undefined)[]): string | undefined {
  const presents = ids.filter((id): id is string => id !== undefined && id !== '');
  return presents.length === 0 ? undefined : presents.join(' ');
}
