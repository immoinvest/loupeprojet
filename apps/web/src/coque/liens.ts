/**
 * Styles partagés des liens de la barre latérale (sections Analyser et Gérer, aide) : 14 px, pour
 * que les libellés et les noms de projets tiennent dans 224 px.
 */

export const classeLien = ({ isActive }: { isActive: boolean }): string =>
  `flex min-h-[44px] items-center gap-2.5 rounded-encart px-3 py-2.5 text-sm font-semibold ${
    isActive ? 'bg-accent-doux text-encre' : 'text-encre-2 hover:bg-accent-fond'
  }`;

/** L'action de création en tête d'une section : même forme qu'un lien, couleur d'accent. */
export const classeLienCreation = ({ isActive }: { isActive: boolean }): string =>
  `flex min-h-[44px] items-center gap-2.5 rounded-encart px-3 py-2.5 text-sm font-bold ${
    isActive ? 'bg-accent-doux text-accent' : 'text-accent hover:bg-accent-fond'
  }`;

export const CLASSE_ETIQUETTE =
  'px-3 pb-1.5 text-xs font-bold tracking-wider text-encre-4 uppercase';
