import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';

import {
  adresseDansProjet,
  cheminDepuisFragment,
  origineDepuisChemin,
  voletDeRepli,
} from '@/hypotheses/liens';

import { defilementPourCentrer } from './defilement';

/** Durée de la mise en évidence d'un champ ciblé (animation `.mise-en-evidence` de index.css). */
export const DUREE_MISE_EN_EVIDENCE_MS = 2000;

const minuteurs = new WeakMap<Element, number>();

/** Le premier élément de la page qui porte ce champ (`data-champ`), s'il est affiché. */
export function trouverChamp(racine: ParentNode, chemin: string): HTMLElement | null {
  for (const element of racine.querySelectorAll<HTMLElement>('[data-champ]')) {
    if (element.dataset.champ === chemin) return element;
  }
  return null;
}

/**
 * Amène un champ de la page en vue : centré dans le contenu qui défile, sous les éléments collés
 * (`data-colle`), focus sur sa saisie, mise en évidence deux secondes. `false` s'il n'est pas affiché.
 */
export function montrerChamp(racine: Document, chemin: string): boolean {
  const champ = trouverChamp(racine, chemin);
  if (champ === null) return false;

  const contenu = champ.closest('main');
  if (contenu !== null) {
    const hautContenu = contenu.getBoundingClientRect().top;
    const boite = champ.getBoundingClientRect();
    let masque = 0;
    for (const colle of contenu.querySelectorAll('[data-colle]')) {
      masque = Math.max(masque, colle.getBoundingClientRect().bottom - hautContenu);
    }
    contenu.scrollTop = defilementPourCentrer(
      { haut: boite.top - hautContenu, hauteur: boite.height },
      { defilement: contenu.scrollTop, hauteurVisible: contenu.clientHeight },
      masque,
    );
  }

  // La saisie d'abord (l'icône ⓘ du libellé la précède, les boutons − / + d'un compteur et les parts de
  // l'apport aussi), puis la tuile cochée d'un choix, la première tuile d'un choix vide, un bouton enfin
  // (régimes de Fiscalité).
  const saisie =
    champ.querySelector<HTMLElement>('input:not([type="radio"]), select, textarea') ??
    champ.querySelector<HTMLElement>('input[type="radio"]:checked') ??
    champ.querySelector<HTMLElement>('input[type="radio"]:not(:disabled)') ??
    champ.querySelector<HTMLElement>('button');
  (saisie ?? champ).focus({ preventScroll: true });

  // Relancer l'animation si le champ est déjà mis en évidence (deux clics rapprochés) : la lecture
  // de la boîte force le navigateur à prendre en compte le retrait de la classe.
  champ.classList.remove('mise-en-evidence');
  champ.getBoundingClientRect();
  champ.classList.add('mise-en-evidence');
  window.clearTimeout(minuteurs.get(champ));
  minuteurs.set(
    champ,
    window.setTimeout(() => {
      champ.classList.remove('mise-en-evidence');
    }, DUREE_MISE_EN_EVIDENCE_MS),
  );
  return true;
}

/**
 * Le fragment d'un volet de projet (« #hypotheses.location.loyerHc ») ouvre ce champ. S'il n'est
 * pas affiché ici (Revente sans loyer, par exemple), on passe à Hypothèses au même champ, en gardant
 * l'origine du lien. Un rendu plus tard suffit à laisser s'ouvrir un dépliant.
 */
export function useChampCible(): void {
  const location = useLocation();
  const naviguer = useNavigate();

  useEffect(() => {
    const chemin = cheminDepuisFragment(location.hash);
    if (chemin === null || montrerChamp(document, chemin)) return;
    const minuteur = window.setTimeout(() => {
      if (montrerChamp(document, chemin)) return;
      const courant = origineDepuisChemin(location.pathname);
      const repli =
        courant === null || courant === 'comparer' ? null : voletDeRepli(chemin, courant);
      const adresse = repli === null ? null : adresseDansProjet(location.pathname, repli);
      if (adresse !== null) {
        void naviguer(
          { pathname: adresse, hash: location.hash },
          { replace: true, state: location.state as unknown },
        );
      }
    }, 0);
    return () => {
      window.clearTimeout(minuteur);
    };
  }, [location, naviguer]);
}
