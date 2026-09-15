/**
 * Styles partagés des liens de la barre latérale (sections Analyser, Gérer et Outils) : 14 px, pour
 * que les libellés et les noms de projets tiennent dans 224 px. Chaque destination porte une icône
 * bleue au repos et un libellé à l'encre : au doigt, où le survol n'existe pas, c'est ce qui dit
 * qu'une ligne se clique. Lignes de 38 px à la souris, 44 px au doigt.
 */

const HAUTEUR_LIGNE = 'min-h-[38px] pointer-coarse:min-h-11';

export const classeLien = ({ isActive }: { isActive: boolean }): string =>
  `flex ${HAUTEUR_LIGNE} items-center gap-2.5 rounded-encart px-3 py-2 text-sm font-semibold [&>svg]:shrink-0 [&>svg]:text-accent ${
    isActive ? 'bg-accent-doux text-accent-fonce' : 'text-encre survol-fond'
  }`;

/**
 * Un projet récent sous « Mes projets » : 13 px, gris, aligné sur le libellé de la ligne parente ;
 * son point de cash-flow tient la place de l'icône.
 */
export const classeSousLien = ({ isActive }: { isActive: boolean }): string =>
  `flex min-h-[34px] pointer-coarse:min-h-11 items-center gap-2.5 rounded-encart px-3 py-1.5 text-[13px] font-semibold ${
    isActive ? 'bg-accent-doux text-accent-fonce' : 'text-encre-2 survol-fond'
  }`;

/**
 * Ligne à deux cibles (« Mes projets » et son « + ») : le conteneur porte la forme et le
 * surlignage quand la liste est ouverte ; chaque lien garde sa propre recette de survol.
 */
export function classeLigneAvecAjout(active: boolean): string {
  return `flex items-center gap-0.5 rounded-encart ${active ? 'bg-accent-doux' : ''}`;
}

export const classeLibelleLigne = ({ isActive }: { isActive: boolean }): string =>
  `flex ${HAUTEUR_LIGNE} min-w-0 flex-1 items-center gap-2.5 rounded-encart px-3 py-2 text-sm font-semibold [&>svg]:shrink-0 [&>svg]:text-accent ${
    isActive ? 'text-accent-fonce' : 'text-encre survol-fond'
  }`;

/** Le nombre de la ligne (« 4 »), dans une pastille ; blanche sur la ligne surlignée. */
export function classeNombre(active: boolean): string {
  return `flex h-5 min-w-[22px] shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
    active ? 'bg-surface text-accent-fonce' : 'bg-bordure-douce text-encre-3'
  }`;
}

/**
 * Le « + » : petit bouton bordé de 30 px (44 px au doigt), secondaire à côté du libellé ; accent
 * plein quand on est sur la page de création.
 */
export const classeAjout = ({ isActive }: { isActive: boolean }): string =>
  `mr-1 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border pointer-coarse:mr-0 pointer-coarse:h-11 pointer-coarse:w-11 ${
    isActive
      ? 'border-accent bg-accent text-white'
      : 'border-accent-bordure bg-surface text-accent survol-fond-fort'
  }`;

/** Une section du menu : ses lignes presque jointives, sous leur titre. */
export const CLASSE_SECTION = 'flex flex-col gap-0.5';

/** Titre de section (« ANALYSER ») : encre-3, contraste de 4,8 pour 1 sur blanc (WCAG 1.4.3). */
export const CLASSE_ETIQUETTE =
  'px-3 pb-1.5 text-[11px] font-bold tracking-[0.08em] text-encre-3 uppercase';
