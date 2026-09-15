import { publies, type EntreeGuide } from './controles';

/** Les guides à lire ensuite : ceux de la même catégorie d'abord, puis les plus récents des autres. */
export function guidesLies<T extends EntreeGuide>(courant: T, tous: readonly T[], nombre = 3): T[] {
  const autres = publies(tous).filter((guide) => guide.id !== courant.id);
  const memeCategorie = autres.filter((guide) => guide.data.categorie === courant.data.categorie);
  const ailleurs = autres.filter((guide) => guide.data.categorie !== courant.data.categorie);
  return [...memeCategorie, ...ailleurs].slice(0, nombre);
}
