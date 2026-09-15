import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { useLocation, useNavigationType } from 'react-router';

import { positionAuRetour } from './defilement';

/**
 * Remet le contenu en haut à chaque changement de chemin. Le contenu (`main`) est le seul élément
 * qui défile, et le navigateur ne le fait pas pour lui : sans ce retour, on arriverait au milieu du
 * volet suivant. Un changement de fragment ou de paramètres (Nouveau projet nettoie son adresse
 * après lecture) ne bouge pas. Avant la peinture, pour ne jamais montrer l'ancienne position.
 *
 * Revenir par l'historique (bouton précédent, « Revenir à … » après un lien d'hypothèse) rend la
 * position où l'on avait laissé ce volet : elle est notée à chaque défilement, par entrée
 * d'historique, en mémoire seulement.
 */
export function useRetourEnHaut(contenuRef: RefObject<HTMLElement | null>): void {
  const { pathname, key } = useLocation();
  const navigation = useNavigationType();
  const positions = useRef(new Map<string, number>());
  const cle = useRef(key);
  const cheminPrecedent = useRef<string | null>(null);

  useEffect(() => {
    const contenu = contenuRef.current;
    if (contenu === null) return;
    const noter = (): void => {
      positions.current.set(cle.current, contenu.scrollTop);
    };
    contenu.addEventListener('scroll', noter, { passive: true });
    return () => {
      contenu.removeEventListener('scroll', noter);
    };
  }, [contenuRef]);

  useLayoutEffect(() => {
    cle.current = key;
    if (cheminPrecedent.current === pathname) return;
    cheminPrecedent.current = pathname;
    const contenu = contenuRef.current;
    if (contenu !== null) {
      contenu.scrollTop = positionAuRetour(navigation, positions.current.get(key));
    }
  }, [contenuRef, pathname, key, navigation]);
}
