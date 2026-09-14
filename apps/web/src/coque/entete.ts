import { useLayoutEffect, type RefObject } from 'react';

/*
 * Mesures de l'en-tête collé d'un projet (ProjetLayout). Le CSS décide de ce qui reste en vue selon
 * la largeur : sous 768 px, `top` vaut −(début de la bande des volets) et seule la bande reste ;
 * au-delà, `top` vaut 0 et tout l'en-tête est collé. Les fonctions sont pures ; le hook n'est que
 * la colle avec ce que le navigateur mesure.
 */

/** Début de la bande des volets dans l'en-tête, en px : le `top` négatif de l'en-tête sous 768 px. */
export const VARIABLE_DECALAGE = '--decalage-entete';
/** Hauteur de la partie de l'en-tête qui reste en vue, en px : le `top` de la synthèse d'Hypothèses. */
export const VARIABLE_HAUTEUR = '--hauteur-entete-projet';

/** Lit le `top` calculé d'un élément collé (`-116px`, `0px`) ; vide ou `auto` → 0. */
export function lireDecalage(topCalcule: string): number {
  const valeur = Number.parseFloat(topCalcule);
  return Number.isNaN(valeur) ? 0 : valeur;
}

/** Hauteur de la partie en vue : la hauteur moins ce qu'un `top` négatif cache ; jamais négative. */
export function hauteurCollee(hauteur: number, top: number): number {
  return Math.max(0, hauteur + Math.min(0, top));
}

export function enPixels(valeur: number): string {
  return `${String(Math.round(valeur))}px`;
}

/** `ResizeObserver` peut manquer (jsdom, navigateurs anciens) : on le lit comme optionnel. */
interface FenetreObservation {
  readonly ResizeObserver?: typeof ResizeObserver;
}

/**
 * Publie sur le cadre du projet (le parent de l'en-tête) le début de la bande des volets et la
 * hauteur de la partie collée, à chaque changement de taille de l'en-tête. Le décalage est posé
 * avant de lire le `top` calculé, qui en dépend sous 768 px. Sans `ResizeObserver`, rien n'est
 * publié : les valeurs par défaut du CSS (`0px`) restent sûres.
 */
export function useMesuresEnTete(
  enTeteRef: RefObject<HTMLElement | null>,
  bandeRef: RefObject<HTMLElement | null>,
): void {
  useLayoutEffect(() => {
    const fenetre: FenetreObservation = window;
    const enTete = enTeteRef.current;
    const bande = bandeRef.current;
    const cadre = enTete?.parentElement ?? null;
    if (enTete === null || bande === null || cadre === null) return undefined;
    if (fenetre.ResizeObserver === undefined) return undefined;

    const mesurer = (): void => {
      const debutOnglets = bande.getBoundingClientRect().top - enTete.getBoundingClientRect().top;
      cadre.style.setProperty(VARIABLE_DECALAGE, enPixels(debutOnglets));
      const top = lireDecalage(getComputedStyle(enTete).top);
      cadre.style.setProperty(VARIABLE_HAUTEUR, enPixels(hauteurCollee(enTete.offsetHeight, top)));
    };
    const observateur = new fenetre.ResizeObserver(mesurer);
    observateur.observe(enTete);
    return () => {
      observateur.disconnect();
    };
  }, [enTeteRef, bandeRef]);
}
