/**
 * Styles partagés des liens de la barre latérale (sections Analyser et Gérer, aide) : 14 px, pour
 * que les libellés et les noms de projets tiennent dans 224 px.
 */

export const classeLien = ({ isActive }: { isActive: boolean }): string =>
  `flex min-h-[44px] items-center gap-2.5 rounded-encart px-3 py-2.5 text-sm font-semibold ${
    isActive ? 'bg-accent-doux text-encre' : 'text-encre-2 survol-fond'
  }`;

/** L'action de création en tête d'une section : même forme qu'un lien, couleur d'accent. */
export const classeLienCreation = ({ isActive }: { isActive: boolean }): string =>
  `flex min-h-[44px] items-center gap-2.5 rounded-encart px-3 py-2.5 text-sm font-bold ${
    isActive ? 'bg-accent-doux text-accent' : 'text-accent survol-fond'
  }`;

/**
 * Ligne à deux cibles (« Mes projets · N » et son « + ») : le conteneur porte la forme et le
 * surlignage quand la liste est ouverte ; chaque lien garde sa propre recette de survol.
 */
export function classeLigneAvecAjout(active: boolean): string {
  return `flex min-h-[44px] items-stretch rounded-encart ${active ? 'bg-accent-doux' : ''}`;
}

export const classeLibelleLigne = ({ isActive }: { isActive: boolean }): string =>
  `flex min-w-0 flex-1 items-center gap-2.5 rounded-encart px-3 py-2.5 text-sm font-semibold ${
    isActive ? 'text-encre' : 'text-encre-2 survol-fond'
  }`;

/** Le « + » : carré de 44 px, accent ; accent plein quand on est sur la page de création. */
export function classeAjout(ligneActive: boolean): ({ isActive }: { isActive: boolean }) => string {
  return ({ isActive }) =>
    `flex w-11 shrink-0 items-center justify-center rounded-encart ${
      isActive
        ? 'bg-accent text-white'
        : `text-accent ${ligneActive ? 'survol-fond-fort' : 'survol-fond'}`
    }`;
}

export const CLASSE_ETIQUETTE =
  'px-3 pb-1.5 text-xs font-bold tracking-wider text-encre-4 uppercase';
