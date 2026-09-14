import { useLayoutEffect, type RefObject } from 'react';
import { useLocation } from 'react-router';

/**
 * Remet le contenu en haut à chaque changement de chemin. Le contenu (`main`) est le seul élément
 * qui défile, et le navigateur ne le fait pas pour lui : sans ce retour, on arriverait au milieu du
 * volet suivant. Un changement de fragment ou de paramètres (Nouveau projet nettoie son adresse
 * après lecture) ne bouge pas. Avant la peinture, pour ne jamais montrer l'ancienne position.
 */
export function useRetourEnHaut(contenuRef: RefObject<HTMLElement | null>): void {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    const contenu = contenuRef.current;
    if (contenu !== null) contenu.scrollTop = 0;
  }, [contenuRef, pathname]);
}
