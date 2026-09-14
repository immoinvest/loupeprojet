import type { Changement, ReponseSynchro } from '@loupe/projets';

/** Erreurs traduites en codes stables. */
export type CodeErreurSynchro =
  'non_connecte' | 'invalide' | 'indisponible' | 'reseau' | 'inconnue';

export type ResultatSynchro<T> =
  | { readonly ok: true; readonly valeur: T }
  | { readonly ok: false; readonly code: CodeErreurSynchro };

/** Ce que l'appareil envoie : son curseur et un lot de changements. */
export interface DemandeSynchro {
  readonly depuis: number;
  readonly changements: readonly Changement[];
}

/** L'API de synchronisation ; une version réseau et une version mémoire (tests, aperçu). */
export interface ClientProjets {
  synchroniser(demande: DemandeSynchro): Promise<ResultatSynchro<ReponseSynchro>>;
}

/**
 * Ce que Mes projets affiche : `local` sans compte ; `en_cours` ; `a_jour` ; `hors_ligne` (réseau) ;
 * `indisponible` (API absente ou en panne) ; `limite` (projets refusés) ; `reconnexion` (session expirée).
 */
export type StatutSynchro =
  'local' | 'en_cours' | 'a_jour' | 'hors_ligne' | 'indisponible' | 'limite' | 'reconnexion';
