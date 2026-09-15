/** Un titre rendu par Astro (`render(entry).headings`). */
export interface TitreRendu {
  readonly depth: number;
  readonly slug: string;
  readonly text: string;
}

export interface EntreeSommaire {
  readonly ancre: string;
  readonly texte: string;
  /** 1 pour un intertitre (H2), 2 pour un sous-titre (H3). */
  readonly niveau: 1 | 2;
}

/** Le sommaire d'un guide : ses H2 et H3, dans l'ordre. Vide s'il n'y en a pas. */
export function sommaire(titres: readonly TitreRendu[]): EntreeSommaire[] {
  return titres
    .filter((titre) => titre.depth === 2 || titre.depth === 3)
    .map((titre) => ({ ancre: titre.slug, texte: titre.text, niveau: titre.depth === 2 ? 1 : 2 }));
}
