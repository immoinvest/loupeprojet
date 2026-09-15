import type { Categorie } from './categories';
import type { EntreeGuide } from './controles';

/** Une page sous `/guides/<slug>/` : la liste d'une catégorie ou un guide. */
export type PageGuides<T extends EntreeGuide> =
  | { readonly slug: string; readonly type: 'categorie'; readonly categorie: Categorie }
  | { readonly slug: string; readonly type: 'article'; readonly guide: T };

const FORMAT_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Les pages de `/guides/<slug>/`. Catégories et guides partagent ce niveau d'adresse : un slug mal
 * formé ou pris deux fois arrête le build en le nommant.
 */
export function cheminsGuides<T extends EntreeGuide>(
  categories: readonly Categorie[],
  guides: readonly T[],
): PageGuides<T>[] {
  const pages: PageGuides<T>[] = [
    ...categories.map((categorie) => ({
      slug: categorie.slug,
      type: 'categorie' as const,
      categorie,
    })),
    ...guides.map((guide) => ({ slug: guide.id, type: 'article' as const, guide })),
  ];
  const vus = new Set<string>();
  for (const page of pages) {
    if (!FORMAT_SLUG.test(page.slug)) {
      throw new Error(
        `Adresse de guide invalide : « ${page.slug} » (minuscules, chiffres et tirets)`,
      );
    }
    if (vus.has(page.slug)) {
      throw new Error(`Adresse /guides/${page.slug}/ prise deux fois (catégorie ou guide)`);
    }
    vus.add(page.slug);
  }
  return pages;
}
