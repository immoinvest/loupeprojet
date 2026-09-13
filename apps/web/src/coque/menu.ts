import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useLocation } from 'react-router';

/** Largeur à partir de laquelle la barre latérale est toujours visible (point de rupture `lg`). */
export const REQUETE_GRAND_ECRAN = '(min-width: 64rem)';

export interface Menu {
  readonly ouvert: boolean;
  readonly ouvrir: () => void;
  /** Ferme le tiroir et rend le focus au bouton de menu. */
  readonly fermer: () => void;
  readonly boutonRef: RefObject<HTMLButtonElement | null>;
  /** Contenu principal : il reçoit le focus quand une navigation referme le tiroir. */
  readonly contenuRef: RefObject<HTMLElement | null>;
}

/** Où va le focus quand le tiroir se ferme : bouton (fermeture), contenu (navigation), nulle part. */
type DestinationFocus = 'bouton' | 'contenu' | null;

/** `matchMedia` peut manquer (tests, navigateurs anciens) : on le lit comme optionnel. */
interface FenetreMedia {
  readonly matchMedia?: (requete: string) => MediaQueryList;
}

/** Empêche la page de défiler derrière le tiroir ; rend la fonction qui la libère. */
function figerLaPage(racine: HTMLElement): () => void {
  const avant = racine.style.overflow;
  racine.style.overflow = 'hidden';
  return () => {
    racine.style.overflow = avant;
  };
}

/** Tiroir de navigation des petits écrans : état, fermetures et effets sur la page. */
export function useMenu(): Menu {
  const [ouvert, setOuvert] = useState(false);
  const boutonRef = useRef<HTMLButtonElement>(null);
  const contenuRef = useRef<HTMLElement>(null);
  const destination = useRef<DestinationFocus>(null);
  // Dernier état affiché : une navigation qui referme un tiroir ouvert envoie le focus au contenu.
  const ouvertAffiche = useRef(false);
  const { key } = useLocation();

  const ouvrir = useCallback(() => {
    setOuvert(true);
  }, []);
  const fermer = useCallback(() => {
    destination.current = 'bouton';
    setOuvert(false);
  }, []);

  // Chaque navigation, même vers la page déjà affichée, referme le tiroir.
  useEffect(() => {
    if (ouvertAffiche.current) destination.current = 'contenu';
    setOuvert(false);
  }, [key]);

  useEffect(() => {
    ouvertAffiche.current = ouvert;
    if (ouvert) return figerLaPage(document.documentElement);
    const cibles = { bouton: boutonRef.current, contenu: contenuRef.current };
    const cible = destination.current === null ? null : cibles[destination.current];
    destination.current = null;
    cible?.focus();
    return undefined;
  }, [ouvert]);

  useEffect(() => {
    if (!ouvert) return undefined;
    const surTouche = (evenement: KeyboardEvent): void => {
      if (evenement.key === 'Escape') fermer();
    };
    document.addEventListener('keydown', surTouche);
    return () => {
      document.removeEventListener('keydown', surTouche);
    };
  }, [ouvert, fermer]);

  useEffect(() => {
    const fenetre: FenetreMedia = window;
    if (!ouvert || fenetre.matchMedia === undefined) return undefined;
    const requete = fenetre.matchMedia(REQUETE_GRAND_ECRAN);
    // Passé en grand écran, la barre latérale est visible : le tiroir n'a plus de raison d'être.
    const surChangement = (): void => {
      if (requete.matches) setOuvert(false);
    };
    surChangement();
    requete.addEventListener('change', surChangement);
    return () => {
      requete.removeEventListener('change', surChangement);
    };
  }, [ouvert]);

  return { ouvert, ouvrir, fermer, boutonRef, contenuRef };
}
