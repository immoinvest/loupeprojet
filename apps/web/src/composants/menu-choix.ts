/**
 * Logique pure de la liste de choix (`MenuChoix.tsx`), motif WAI-ARIA « listbox » : déplacement
 * au clavier, recherche par lettre tapée, placement sous ou au-dessus du bouton.
 */

/** Touches qui déplacent l'option active ; sans boucle, comme une liste native. */
export function indexSuivant(actuel: number, touche: string, nombre: number): number | null {
  if (nombre === 0) return null;
  switch (touche) {
    case 'ArrowDown':
      return Math.min(actuel + 1, nombre - 1);
    case 'ArrowUp':
      return Math.max(actuel - 1, 0);
    case 'Home':
      return 0;
    case 'End':
      return nombre - 1;
    default:
      return null;
  }
}

function sansAccents(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Lettre tapée : la prochaine option (après l'active, en revenant au début) dont le libellé
 * commence par cette lettre, accents et majuscules ignorés (« e » trouve « Écarté »).
 */
export function indexParLettre(
  libelles: readonly string[],
  actuel: number,
  touche: string,
): number | null {
  // `KeyboardEvent.key` d'une lettre fait un caractère ; « ArrowDown », « Shift »… en font plusieurs.
  if (touche.length !== 1 || touche.trim() === '') return null;
  const lettre = sansAccents(touche);
  for (let pas = 1; pas <= libelles.length; pas += 1) {
    const index = (actuel + pas) % libelles.length;
    if (sansAccents(libelles[index] ?? '').startsWith(lettre)) return index;
  }
  return null;
}

/** Marge gardée entre la liste et le bord de l'écran, en pixels. */
const MARGE = 8;

/**
 * La liste s'ouvre sous le bouton ; au-dessus seulement si la place manque dessous et qu'il y en a
 * davantage au-dessus.
 */
export function placementListe(
  bouton: { readonly haut: number; readonly bas: number },
  hauteurListe: number,
  hauteurEcran: number,
): 'dessous' | 'dessus' {
  const dessous = hauteurEcran - bouton.bas - MARGE;
  const dessus = bouton.haut - MARGE;
  return dessous < hauteurListe && dessus > dessous ? 'dessus' : 'dessous';
}
