import { TEXTES_PARTAGE_PROJET } from '@/textes/partage';

/** Ce que le navigateur permet pour partager un projet. */
export interface CapacitesPartage {
  /** Écran tactile (pointeur grossier) : téléphone ou tablette. */
  readonly tactile: boolean;
  /** `navigator.share` existe. */
  readonly partageNatif: boolean;
}

export type ModePartage = 'natif' | 'copie';

/** Ce que la décision lit de la fenêtre, injecté pour être testé sans navigateur. */
export interface FenetrePartage {
  readonly matchMedia?: (requete: string) => { readonly matches: boolean };
  readonly navigator?: object;
}

/** Les données passées à `navigator.share`. */
export interface DonneesPartage {
  readonly title: string;
  readonly text: string;
  readonly url: string;
}

const REQUETE_TACTILE = '(pointer: coarse)';

export function capacitesDuNavigateur(fenetre: FenetrePartage | undefined): CapacitesPartage {
  const navigateur = fenetre?.navigator;
  return {
    tactile: fenetre?.matchMedia?.(REQUETE_TACTILE).matches ?? false,
    partageNatif:
      navigateur !== undefined && 'share' in navigateur && typeof navigateur.share === 'function',
  };
}

/**
 * La feuille de partage du téléphone sur écran tactile ; à la souris, un lien copié, plus utile que
 * la feuille de partage du système sur ordinateur.
 */
export function modePartage(capacites: CapacitesPartage): ModePartage {
  return capacites.tactile && capacites.partageNatif ? 'natif' : 'copie';
}

export function donneesPartage(nom: string, lien: string): DonneesPartage {
  return { title: nom, text: TEXTES_PARTAGE_PROJET.message(nom), url: lien };
}

/** La personne a fermé la feuille de partage sans choisir : rien à faire, surtout pas copier. */
export function estAnnulation(erreur: unknown): boolean {
  return (
    typeof erreur === 'object' &&
    erreur !== null &&
    'name' in erreur &&
    erreur.name === 'AbortError'
  );
}
